/**
 * GET /api/carte/ca-manquant/diametres
 *
 * Segmentation des prises actives non facturées
 * par diamètre de compteur (colonne "diametre" de API_CLIENT).
 *
 * Catégories : DN≤15 | DN20 | DN25 | DN32 | DN≤50 | DN>50 | Inconnu
 *
 * Retourne :
 *   - par_categorie : [ { categorie, nb_non_fact, nb_parc, taux_non_fact, ca_manquant_estime } ]
 *   - total         : { nb_non_fact, ca }
 *
 * Cache 30 min
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

/* Extrait un entier du champ diametre (peut être "15", "DN15", "1/2 pouce"…) */
const DIAM_CAT_SQL = `
  CASE
    WHEN "diametre" IS NULL OR TRIM("diametre") = '' OR "diametre" !~ '[0-9]'
      THEN 'Inconnu'
    WHEN (regexp_replace("diametre", '[^0-9]', '', 'g'))::numeric <= 15
      THEN 'DN≤15'
    WHEN (regexp_replace("diametre", '[^0-9]', '', 'g'))::numeric <= 20
      THEN 'DN20'
    WHEN (regexp_replace("diametre", '[^0-9]', '', 'g'))::numeric <= 25
      THEN 'DN25'
    WHEN (regexp_replace("diametre", '[^0-9]', '', 'g'))::numeric <= 32
      THEN 'DN32'
    WHEN (regexp_replace("diametre", '[^0-9]', '', 'g'))::numeric <= 50
      THEN 'DN≤50'
    ELSE 'DN>50'
  END
`

async function fetchDiametres(qs: string) {
  const sp       = new URLSearchParams(qs)
  const annee    = parseInt(sp.get('annee') ?? '2025', 10)
  const bimestre = sp.get('bimestre') ? parseInt(sp.get('bimestre')!, 10) : null
  const dr       = sp.get('dr') ?? null

  const params: (number | string)[] = [annee]
  const extraRec: string[] = []

  if (bimestre !== null) {
    params.push(bimestre)
    extraRec.push(`CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)/2.0)::int = $${params.length}`)
  }
  let drParamIdx = 0
  if (dr) {
    params.push(dr)
    drParamIdx = params.length
    extraRec.push(`"DR" = $${drParamIdx}`)
  }

  const recWhere = [
    `"PERIODE_FACTURATION" LIKE '__/____'`,
    `CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1`,
    `chiffre_affaire > 0`,
    `"PDI_REFERENCE" IS NOT NULL`,
    ...extraRec,
  ].join('\n          AND ')

  const drCondClient = drParamIdx ? `AND "DR" = $${drParamIdx}` : ''

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000')

    const res = await client.query(`
      WITH
      /* ── Parc actif catégorisé par diamètre ── */
      parc AS (
        SELECT
          "PDI_REFERENCE",
          "UO",
          ${DIAM_CAT_SQL} AS categorie
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif'
          AND "PDI_REFERENCE" IS NOT NULL
          ${drCondClient}
      ),

      /* ── PDIs facturés sur la période ── */
      fact AS (
        SELECT DISTINCT "PDI_REFERENCE"
        FROM public.mv_recouvrement
        WHERE ${recWhere}
      ),

      /* ── Non facturés ── */
      non_fact AS (
        SELECT p."PDI_REFERENCE", p."UO", p.categorie
        FROM parc p
        LEFT JOIN fact f ON p."PDI_REFERENCE" = f."PDI_REFERENCE"
        WHERE f."PDI_REFERENCE" IS NULL
      ),

      /* ── Taille du parc par catégorie ── */
      parc_cat AS (
        SELECT categorie, COUNT(*)::int AS nb_parc
        FROM parc
        GROUP BY categorie
      ),

      /* ── CA moyen par UO ── */
      ca_uo AS (
        SELECT "UO", AVG(chiffre_affaire) AS ca_moy
        FROM public.mv_recouvrement
        WHERE ${recWhere}
        GROUP BY "UO"
      ),

      /* ── Agréger non-facturés + CA par catégorie ── */
      agg AS (
        SELECT
          n.categorie,
          COUNT(*)::int                                    AS nb_non_fact,
          ROUND(SUM(COALESCE(u.ca_moy, 0)))::float8       AS ca_manquant_estime
        FROM non_fact n
        LEFT JOIN ca_uo u ON n."UO" = u."UO"
        GROUP BY n.categorie
      )

      SELECT
        a.categorie,
        a.nb_non_fact,
        COALESCE(pc.nb_parc, 0)                                              AS nb_parc,
        CASE WHEN COALESCE(pc.nb_parc, 0) > 0
          THEN ROUND(a.nb_non_fact * 100.0 / pc.nb_parc)::int
          ELSE 0
        END                                                                  AS taux_non_fact,
        a.ca_manquant_estime
      FROM agg a
      LEFT JOIN parc_cat pc ON pc.categorie = a.categorie
      ORDER BY a.nb_non_fact DESC
    `, params)

    const total_non_fact = res.rows.reduce((s: number, r: { nb_non_fact: number }) => s + r.nb_non_fact, 0)
    const total_ca       = res.rows.reduce((s: number, r: { ca_manquant_estime: number }) => s + (r.ca_manquant_estime ?? 0), 0)

    return {
      par_categorie: res.rows,
      total: { nb_non_fact: total_non_fact, ca: total_ca },
      annee,
      filters: { annee, bimestre, dr },
      timestamp: new Date().toISOString(),
    }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`ca_diametres:${qs}`, () => fetchDiametres(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant/diametres]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
