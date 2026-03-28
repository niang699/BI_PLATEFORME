/**
 * GET /api/carte/ca-manquant/tournees
 *
 * Pour chaque tournée de relevé (CODE_TOURNEE d'API_CLIENT),
 * calcule le nombre de prises actives non facturées et
 * le CA manquant estimé.
 *
 * Retourne :
 *   - tournees : [ { tournee, uo, nb_non_fact, nb_total, taux_non_fact, ca_manquant_estime } ] tri DESC nb_non_fact
 *   - total    : { nb_tournees_defaillantes, nb_non_fact, ca }
 *
 * Cache 30 min
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

async function fetchTournees(qs: string) {
  const sp       = new URLSearchParams(qs)
  const annee    = parseInt(sp.get('annee') ?? '2025', 10)
  const bimestre = sp.get('bimestre') ? parseInt(sp.get('bimestre')!, 10) : null
  const dr       = sp.get('dr') ?? null

  /* ── Construire les paramètres dynamiques ── */
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
      /* ── Parc actif avec tournée ── */
      parc AS (
        SELECT "PDI_REFERENCE", "UO", "CODE_TOURNEE"
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif'
          AND "PDI_REFERENCE" IS NOT NULL
          AND "CODE_TOURNEE"  IS NOT NULL
          AND "UO"            IS NOT NULL
          ${drCondClient}
      ),

      /* ── PDIs facturés sur la période ── */
      fact AS (
        SELECT DISTINCT "PDI_REFERENCE"
        FROM public.mv_recouvrement
        WHERE ${recWhere}
      ),

      /* ── Non facturés par tournée ── */
      non_fact AS (
        SELECT p."PDI_REFERENCE", p."UO", p."CODE_TOURNEE"
        FROM parc p
        LEFT JOIN fact f ON p."PDI_REFERENCE" = f."PDI_REFERENCE"
        WHERE f."PDI_REFERENCE" IS NULL
      ),

      /* ── Taille totale du parc par tournée×UO ── */
      parc_tournee AS (
        SELECT "CODE_TOURNEE", "UO", COUNT(*)::int AS nb_total
        FROM parc
        GROUP BY "CODE_TOURNEE", "UO"
      ),

      /* ── CA moyen par UO pour estimer le manque ── */
      ca_uo AS (
        SELECT "UO", AVG(chiffre_affaire) AS ca_moy
        FROM public.mv_recouvrement
        WHERE ${recWhere}
        GROUP BY "UO"
      )

      SELECT
        n."CODE_TOURNEE"                                                           AS tournee,
        n."UO"                                                                     AS uo,
        COUNT(*)::int                                                              AS nb_non_fact,
        COALESCE(pt.nb_total, 0)                                                   AS nb_total,
        ROUND(COUNT(*) * COALESCE(u.ca_moy, 0))::float8                           AS ca_manquant_estime,
        CASE
          WHEN COALESCE(pt.nb_total, 0) > 0
            THEN ROUND(COUNT(*) * 100.0 / pt.nb_total)::int
          ELSE 0
        END                                                                        AS taux_non_fact
      FROM non_fact n
      LEFT JOIN parc_tournee pt ON  n."CODE_TOURNEE" = pt."CODE_TOURNEE"
                                AND n."UO"           = pt."UO"
      LEFT JOIN ca_uo u ON n."UO" = u."UO"
      GROUP BY n."CODE_TOURNEE", n."UO", pt.nb_total, u.ca_moy
      ORDER BY nb_non_fact DESC
      LIMIT 30
    `, params)

    const total_non_fact = res.rows.reduce((s: number, r: { nb_non_fact: number }) => s + r.nb_non_fact, 0)
    const total_ca       = res.rows.reduce((s: number, r: { ca_manquant_estime: number }) => s + (r.ca_manquant_estime ?? 0), 0)

    return {
      tournees: res.rows,
      total: {
        nb_tournees_defaillantes: res.rows.length,
        nb_non_fact: total_non_fact,
        ca: total_ca,
      },
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
    const data = await withCache(`ca_tournees:${qs}`, () => fetchTournees(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant/tournees]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
