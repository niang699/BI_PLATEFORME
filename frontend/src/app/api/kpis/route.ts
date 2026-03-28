/**
 * GET /api/kpis
 * KPIs globaux Facturation & Recouvrement depuis sen_ods (mv_recouvrement)
 *
 * Colonnes sen_ods :
 *   "PERIODE_FACTURATION" (text, format MM/YYYY)  "DR", "UO" (uppercase, quoted)
 *   chiffre_affaire, montant_regle, impaye, taux_recouvrement, statut_facture (lowercase)
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbOds'

export async function GET() {
  const client = await pool.connect().catch(() => null)
  if (!client) {
    return NextResponse.json({ error: 'DB indisponible' }, { status: 503 })
  }

  try {
    /* ── Dernière période significative (format MM/YYYY, > 50K lignes) ────── */
    const kpiRes = await client.query(`
      WITH best_periode AS (
        SELECT "PERIODE_FACTURATION"
        FROM   public.mv_recouvrement
        WHERE  "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
          AND  CAST(SPLIT_PART("PERIODE_FACTURATION", '/', 2) AS int) BETWEEN 2010 AND 2030
        GROUP  BY "PERIODE_FACTURATION"
        HAVING COUNT(*) > 50000
        ORDER  BY TO_DATE("PERIODE_FACTURATION", 'MM/YYYY') DESC
        LIMIT  1
      )
      SELECT
        COUNT(*)::int                                                     AS nb_factures,
        COALESCE(SUM(chiffre_affaire), 0)::float8                        AS ca_total,
        COALESCE(SUM(montant_regle),   0)::float8                        AS encaissement_total,
        COALESCE(SUM(impaye),          0)::float8                        AS impaye_mensuel,
        CASE
          WHEN SUM(chiffre_affaire) > 0
          THEN ROUND((SUM(montant_regle) * 100.0
               / NULLIF(SUM(chiffre_affaire), 0))::numeric, 1)
          ELSE 0
        END::float8                                                       AS taux_recouvrement,
        bp."PERIODE_FACTURATION"                                          AS derniere_periode
      FROM   public.mv_recouvrement r
      CROSS  JOIN best_periode bp
      WHERE  r."PERIODE_FACTURATION" = bp."PERIODE_FACTURATION"
      GROUP  BY bp."PERIODE_FACTURATION"
    `)

    /* ── Impayés cumulés (toutes périodes, hors soldées) ─────────────────── */
    const impayesRes = await client.query(`
      SELECT
        COALESCE(SUM(impaye), 0)::float8   AS impaye_cumul,
        COUNT(DISTINCT "DR")::int          AS nb_dr
      FROM public.mv_recouvrement
      WHERE statut_facture != 'Soldée'
    `)

    const row    = kpiRes.rows[0]     ?? {}
    const impRow = impayesRes.rows[0] ?? {}

    return NextResponse.json({
      nb_factures:        row.nb_factures        ?? 0,
      ca_total:           row.ca_total            ?? 0,
      encaissement_total: row.encaissement_total  ?? 0,
      impaye_mensuel:     row.impaye_mensuel       ?? 0,
      impaye_cumul:       impRow.impaye_cumul      ?? 0,
      taux_recouvrement:  row.taux_recouvrement    ?? 0,
      derniere_periode:   row.derniere_periode     ?? '',
      nb_dr:              impRow.nb_dr             ?? 0,
      source:             'sen_ods · mv_recouvrement',
      timestamp:          new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/kpis] Erreur SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    client.release()
  }
}
