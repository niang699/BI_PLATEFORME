/**
 * GET /api/kpis/directions
 * KPIs agrégés par Direction Régionale (DR) — dernière période significative
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbOds'

export async function GET() {
  const client = await pool.connect().catch(() => null)
  if (!client) {
    return NextResponse.json({ error: 'DB indisponible' }, { status: 503 })
  }

  try {
    const res = await client.query(`
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
        r."DR"                                                               AS dr,
        COUNT(*)::int                                                        AS nb_factures,
        COALESCE(SUM(chiffre_affaire), 0)::float8                           AS ca_total,
        COALESCE(SUM(montant_regle),   0)::float8                           AS encaissement,
        COALESCE(SUM(impaye),          0)::float8                           AS impaye,
        CASE
          WHEN SUM(chiffre_affaire) > 0
          THEN ROUND((SUM(montant_regle) * 100.0
               / NULLIF(SUM(chiffre_affaire), 0))::numeric, 1)
          ELSE 0
        END::float8                                                          AS taux_recouvrement,
        bp."PERIODE_FACTURATION"                                             AS periode
      FROM   public.mv_recouvrement r
      CROSS  JOIN best_periode bp
      WHERE  r."PERIODE_FACTURATION" = bp."PERIODE_FACTURATION"
        AND  r."DR" IS NOT NULL
      GROUP  BY r."DR", bp."PERIODE_FACTURATION"
      ORDER  BY taux_recouvrement DESC
    `)

    return NextResponse.json({ data: res.rows, source: 'sen_ods · mv_recouvrement' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/kpis/directions] Erreur SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    client.release()
  }
}
