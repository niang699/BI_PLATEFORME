/**
 * GET /api/carte/ca-manquant/anciennete
 *
 * Pour chaque prise active non facturée sur le bimestre cible,
 * calcule le nombre de bimestres de l'année où elle est absente.
 *
 * Retourne :
 *   - distribution : [ { categorie, nb_prises, pct } ]
 *   - par_uo       : [ { uo, nb_jamais, nb_2_plus, nb_1, ca_moy } ]
 *
 * Cache 30 min
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

async function fetchAnciennete(qs: string) {
  const sp       = new URLSearchParams(qs)
  const annee    = parseInt(sp.get('annee') ?? '2025', 10)
  const dr       = sp.get('dr') ?? null

  const drCond   = dr ? `AND "DR" = $2` : ''
  const params   = dr ? [annee, dr] : [annee]

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000')

    const res = await client.query(`
      WITH
      /* ── Bimestres facturés par PDI sur l'année ── */
      bim_fact AS (
        SELECT
          "PDI_REFERENCE",
          COUNT(DISTINCT
            CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)/2.0)::int
          )::int AS nb_bim_factures
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          AND chiffre_affaire > 0
          AND "PDI_REFERENCE" IS NOT NULL
          ${drCond}
        GROUP BY "PDI_REFERENCE"
      ),

      /* ── Nombre de bimestres disponibles dans l'année ── */
      max_bim AS (
        SELECT COALESCE(
          MAX(CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)/2.0)::int), 6
        ) AS nb
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          ${drCond}
      ),

      /* ── Parc actif par UO ── */
      parc AS (
        SELECT "PDI_REFERENCE", "UO"
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif'
          AND "PDI_REFERENCE" IS NOT NULL
          AND "UO" IS NOT NULL
      ),

      /* ── CA moyen par UO (pour estimer le manque à gagner) ── */
      ca_uo AS (
        SELECT "UO", AVG(chiffre_affaire) AS ca_moy
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          AND chiffre_affaire > 0
          AND "UO" IS NOT NULL
          ${drCond}
        GROUP BY "UO"
      ),

      /* ── Jointure : nb bimestres absents par prise ── */
      absence AS (
        SELECT
          p."PDI_REFERENCE",
          p."UO",
          COALESCE(f.nb_bim_factures, 0) AS nb_bim_factures,
          (SELECT nb FROM max_bim) - COALESCE(f.nb_bim_factures, 0) AS nb_bim_absents
        FROM parc p
        LEFT JOIN bim_fact f ON p."PDI_REFERENCE" = f."PDI_REFERENCE"
        WHERE COALESCE(f.nb_bim_factures, 0) < (SELECT nb FROM max_bim)
      ),

      /* ── Catégorisation ── */
      cat AS (
        SELECT
          "PDI_REFERENCE", "UO", nb_bim_absents,
          CASE
            WHEN nb_bim_factures = 0 THEN 'jamais'
            WHEN nb_bim_absents  >= 3 THEN '3plus'
            WHEN nb_bim_absents  =  2 THEN '2bim'
            ELSE                          '1bim'
          END AS categorie
        FROM absence
      )

      /* ── Résultats ── */
      SELECT
        c.categorie,
        c."UO"                                                        AS uo,
        COUNT(*)::int                                                  AS nb_prises,
        ROUND(COUNT(*) * COALESCE(u.ca_moy, 0))::float8               AS ca_manquant_estime
      FROM cat c
      LEFT JOIN ca_uo u ON c."UO" = u."UO"
      GROUP BY c.categorie, c."UO", u.ca_moy
      ORDER BY c.categorie, nb_prises DESC
    `, params)

    /* ── Agréger distribution globale ── */
    const distMap: Record<string, { nb: number; ca: number }> = {}
    const uoMap:   Record<string, { uo: string; jamais: number; bim3plus: number; bim2: number; bim1: number; ca: number }> = {}

    for (const r of res.rows) {
      const cat = r.categorie as string
      if (!distMap[cat]) distMap[cat] = { nb: 0, ca: 0 }
      distMap[cat].nb += r.nb_prises
      distMap[cat].ca += r.ca_manquant_estime

      if (!uoMap[r.uo]) uoMap[r.uo] = { uo: r.uo, jamais: 0, bim3plus: 0, bim2: 0, bim1: 0, ca: 0 }
      uoMap[r.uo][cat === 'jamais' ? 'jamais' : cat === '3plus' ? 'bim3plus' : cat === '2bim' ? 'bim2' : 'bim1'] += r.nb_prises
      uoMap[r.uo].ca += r.ca_manquant_estime
    }

    const totalPrises = Object.values(distMap).reduce((s, v) => s + v.nb, 0)

    const LABELS: Record<string, string> = {
      jamais: 'Jamais facturé cette année',
      '3plus': '3+ bimestres absents',
      '2bim':  '2 bimestres absents',
      '1bim':  '1 bimestre absent',
    }
    const ORDRE = ['jamais', '3plus', '2bim', '1bim']

    const distribution = ORDRE.map(cat => ({
      categorie: cat,
      label:     LABELS[cat],
      nb_prises: distMap[cat]?.nb ?? 0,
      ca:        distMap[cat]?.ca ?? 0,
      pct:       totalPrises > 0 ? Math.round((distMap[cat]?.nb ?? 0) / totalPrises * 10) / 10 : 0,
    }))

    const par_uo = Object.values(uoMap)
      .sort((a, b) => (b.jamais + b.bim3plus) - (a.jamais + a.bim3plus))
      .slice(0, 15)

    return {
      distribution,
      par_uo,
      total_prises: totalPrises,
      annee,
      filters: { annee, dr },
      timestamp: new Date().toISOString(),
    }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`ca_anciennete:${qs}`, () => fetchAnciennete(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant/anciennete]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
