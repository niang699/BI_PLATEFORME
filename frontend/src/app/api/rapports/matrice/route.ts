/**
 * GET /api/rapports/matrice — Pivot DR × UO × Bimestres
 * Cache TTL 1h : données sen_ods mises à jour 1x/jour.
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { parseFilters, buildCteQuery } from '@/lib/rapportFilters'
import { withCache, TTL_1H } from '@/lib/serverCache'

async function fetchData(qs: string) {
  const sp = new URLSearchParams(qs)
  const f  = parseFilters(sp)
  // La matrice ignore le filtre bimestre — on affiche toutes les colonnes
  const { cte, params } = buildCteQuery({ ...f, bimestre: null })

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 120000')
    const res = await client.query(`
      ${cte}

      -- Détail UO par bimestre
      SELECT
        "DR"  AS dr,
        "UO"  AS uo,
        bv    AS bimestre,
        av    AS annee,
        COALESCE(SUM(chiffre_affaire), 0)::float8 AS ca,
        COALESCE(SUM(montant_regle),   0)::float8 AS enc,
        COALESCE(SUM(impaye),          0)::float8 AS imp
      FROM base
      WHERE "DR" IS NOT NULL AND "UO" IS NOT NULL
      GROUP BY "DR", "UO", bv, av

      UNION ALL

      -- Totaux DR par bimestre (uo = NULL)
      SELECT
        "DR"  AS dr,
        NULL  AS uo,
        bv    AS bimestre,
        av    AS annee,
        COALESCE(SUM(chiffre_affaire), 0)::float8 AS ca,
        COALESCE(SUM(montant_regle),   0)::float8 AS enc,
        COALESCE(SUM(impaye),          0)::float8 AS imp
      FROM base
      WHERE "DR" IS NOT NULL
      GROUP BY "DR", bv, av

      ORDER BY dr, uo NULLS FIRST, annee, bimestre
    `, params)

    const bimSet = new Set<number>()
    for (const r of res.rows) bimSet.add(Number(r.bimestre))
    const bimestres = [...bimSet].sort((a, b) => a - b)

    const anneeRef = f.annee ?? (res.rows[0]?.annee ? Number(res.rows[0].annee) : null)

    return {
      annee: anneeRef,
      bimestres,
      rows: res.rows.map(r => ({
        dr:       String(r.dr),
        uo:       r.uo ? String(r.uo) : null,
        bimestre: Number(r.bimestre),
        ca:       Number(r.ca),
        enc:      Number(r.enc),
        imp:      Number(r.imp),
        taux:     Number(r.ca) > 0 ? Math.round(Number(r.enc) * 1000 / Number(r.ca)) / 10 : 0,
      })),
      source: 'sen_ods · mv_recouvrement',
    }
  } finally { client.release() }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`rapports_matrice:${qs}`, () => fetchData(qs), TTL_1H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rapports/matrice] SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
