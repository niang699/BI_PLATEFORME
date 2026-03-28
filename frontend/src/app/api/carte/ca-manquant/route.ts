/**
 * GET /api/carte/ca-manquant
 *
 * Estimation du CA manquant par UO — approche sans JOIN coûteux
 *
 * Stratégie :
 *  1. Agréger mv_recouvrement par UO → nb_pdi_facturés + CA moyen
 *  2. Agréger API_CLIENT par UO      → nb_actifs
 *  3. Joindre sur UO (petits résultats) → jamais de JOIN sur PDI_REFERENCE
 *
 * CA = AVG(chiffre_affaire) par facture, par UO (depuis mv_recouvrement)
 * Cache 30 min par combinaison de filtres
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

async function fetchCaManquant(qs: string) {
  const sp       = new URLSearchParams(qs)
  const annee    = parseInt(sp.get('annee') ?? '2025', 10)
  const bimestre = sp.get('bimestre') ? parseInt(sp.get('bimestre')!, 10) : null
  const dr       = sp.get('dr') ?? null

  /* Conditions sur mv_recouvrement */
  const conds: string[] = [
    `"PERIODE_FACTURATION" LIKE '__/____'`,
    `CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1`,
    `chiffre_affaire > 0`,
    `"UO" IS NOT NULL`,
    `"PDI_REFERENCE" IS NOT NULL`,
  ]
  const params: unknown[] = [annee]
  let pi = 2

  if (bimestre) {
    conds.push(`CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)/2.0)::int = $${pi}`)
    params.push(bimestre); pi++
  }
  if (dr) {
    conds.push(`"DR" = $${pi}`)
    params.push(dr); pi++
  }

  const where = conds.join(' AND ')

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000')

    const res = await client.query(`
      WITH
      /* ── 1. Agrégation mv_recouvrement par UO (1 seul scan) ─────────────── */
      fact_uo AS (
        SELECT
          "UO",
          COUNT(DISTINCT "PDI_REFERENCE")::int      AS nb_pdi_factures,
          AVG(chiffre_affaire)                      AS ca_moy
        FROM public.mv_recouvrement
        WHERE ${where}
        GROUP BY "UO"
      ),

      /* ── 2. Agrégation API_CLIENT par UO (scan simple, pas de JOIN PDI) ─── */
      parc_uo AS (
        SELECT "UO", COUNT(*)::int AS nb_actifs
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif' AND "UO" IS NOT NULL
        GROUP BY "UO"
      )

      /* ── 3. Jointure sur UO (résultats petits après GROUP BY) ──────────── */
      SELECT
        p."UO"                                                              AS uo,
        GREATEST(0, p.nb_actifs - COALESCE(f.nb_pdi_factures, 0))::int     AS nb_prises_non_fact,
        ROUND(COALESCE(f.ca_moy, 0))::float8                               AS ca_median_par_prise,
        ROUND(
          GREATEST(0, p.nb_actifs - COALESCE(f.nb_pdi_factures, 0))
          * COALESCE(f.ca_moy, 0)
        )::float8                                                           AS ca_manquant_estime,
        COALESCE(f.nb_pdi_factures, 0)                                     AS nb_obs_stratum,
        CASE
          WHEN f.nb_pdi_factures >= 20 THEN 'haute'
          WHEN f.nb_pdi_factures >= 5  THEN 'acceptable'
          ELSE                              'indicatif'
        END                                                                 AS fiabilite
      FROM parc_uo p
      LEFT JOIN fact_uo f ON p."UO" = f."UO"
      WHERE f.ca_moy IS NOT NULL
        AND GREATEST(0, p.nb_actifs - COALESCE(f.nb_pdi_factures, 0)) > 0
      ORDER BY ca_manquant_estime DESC
    `, params)

    const total_ca_manquant     = res.rows.reduce((s: number, r: { ca_manquant_estime: number }) => s + (r.ca_manquant_estime ?? 0), 0)
    const total_prises_non_fact = res.rows.reduce((s: number, r: { nb_prises_non_fact: number }) => s + (r.nb_prises_non_fact ?? 0), 0)

    return {
      rows: res.rows,
      total_ca_manquant,
      total_prises_non_fact,
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
    const data = await withCache(`ca_manquant:${qs}`, () => fetchCaManquant(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
