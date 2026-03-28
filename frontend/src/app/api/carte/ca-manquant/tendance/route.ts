/**
 * GET /api/carte/ca-manquant/tendance
 *
 * Évolution du CA manquant estimé par bimestre pour une année donnée.
 * Retourne 6 points (bim 1-6) avec :
 *   bimestre, ca_manquant_total, nb_prises_non_fact, ca_moy_global
 *
 * Cache 30 min par (annee, dr)
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

const BIM_LABELS: Record<number, string> = {
  1: 'Jan–Fév', 2: 'Mar–Avr', 3: 'Mai–Jun',
  4: 'Jul–Aoû', 5: 'Sep–Oct', 6: 'Nov–Déc',
}

async function fetchTendance(qs: string) {
  const sp    = new URLSearchParams(qs)
  const annee = parseInt(sp.get('annee') ?? '2025', 10)
  const dr    = sp.get('dr') ?? null

  const drCond   = dr ? `AND "DR" = $2` : ''
  const drParams = dr ? [annee, dr] : [annee]

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000')

    /* Calcul par bimestre : pour chaque bimestre calculer CA manquant */
    const res = await client.query(`
      WITH
      /* Parc actif global par UO (inchangé par bimestre) */
      parc_uo AS (
        SELECT "UO", COUNT(*)::int AS nb_actifs
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif' AND "UO" IS NOT NULL
        GROUP BY "UO"
      ),
      /* Factures par bimestre × UO */
      fact_bim AS (
        SELECT
          CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) / 2.0)::int AS bimestre,
          "UO",
          COUNT(DISTINCT "PDI_REFERENCE")::int AS nb_pdi_fact,
          AVG(chiffre_affaire)                 AS ca_moy
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          AND chiffre_affaire > 0
          AND "UO" IS NOT NULL
          AND "PDI_REFERENCE" IS NOT NULL
          ${drCond}
        GROUP BY bimestre, "UO"
      ),
      /* Jointure UO × bimestre → CA manquant par UO et bimestre */
      detail AS (
        SELECT
          f.bimestre,
          GREATEST(0, p.nb_actifs - f.nb_pdi_fact)::int  AS nb_non_fact,
          GREATEST(0, p.nb_actifs - f.nb_pdi_fact) * f.ca_moy AS ca_manquant
        FROM fact_bim f
        INNER JOIN parc_uo p ON p."UO" = f."UO"
        WHERE f.ca_moy IS NOT NULL
      )
      SELECT
        bimestre,
        SUM(nb_non_fact)::int                     AS nb_prises_non_fact,
        ROUND(SUM(ca_manquant))::float8            AS ca_manquant_total,
        ROUND(AVG(ca_manquant / NULLIF(nb_non_fact,0)))::float8 AS ca_moy_global
      FROM detail
      WHERE nb_non_fact > 0
      GROUP BY bimestre
      ORDER BY bimestre
    `, drParams)

    /* Compléter les bimestres manquants avec zéros */
    const byBim: Record<number, { nb_prises_non_fact: number; ca_manquant_total: number; ca_moy_global: number }> = {}
    for (const r of res.rows) {
      byBim[r.bimestre] = {
        nb_prises_non_fact: r.nb_prises_non_fact ?? 0,
        ca_manquant_total:  r.ca_manquant_total  ?? 0,
        ca_moy_global:      r.ca_moy_global      ?? 0,
      }
    }

    const points = Array.from({ length: 6 }, (_, i) => {
      const bim = i + 1
      return {
        bimestre: bim,
        label:    BIM_LABELS[bim],
        ...(byBim[bim] ?? { nb_prises_non_fact: 0, ca_manquant_total: 0, ca_moy_global: 0 }),
      }
    })

    return { points, annee, filters: { annee, dr }, timestamp: new Date().toISOString() }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`ca_tendance:${qs}`, () => fetchTendance(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant/tendance]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
