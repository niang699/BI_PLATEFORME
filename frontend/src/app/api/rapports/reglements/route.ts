/**
 * GET /api/rapports/reglements — Aging + statuts
 * Cache TTL 1h : données sen_ods mises à jour 1x/jour.
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { parseFilters, buildCteQuery } from '@/lib/rapportFilters'
import { withCache, TTL_1H } from '@/lib/serverCache'

const AGG_AGING = `
  COUNT(*)::int AS nb,
  COALESCE(SUM(chiffre_affaire),0)::float8 AS ca,
  COALESCE(SUM(montant_regle),  0)::float8 AS regle,
  COALESCE(SUM(j),   0)::float8 AS aj,
  COALESCE(SUM(jp15),0)::float8 AS aj15,
  COALESCE(SUM(jp30),0)::float8 AS aj30,
  COALESCE(SUM(jp45),0)::float8 AS aj45,
  COALESCE(SUM(jp60),0)::float8 AS aj60,
  COALESCE(SUM(jp75),0)::float8 AS aj75,
  COALESCE(SUM(jp90),0)::float8 AS aj90,
  COALESCE(SUM(js90),0)::float8 AS ajs90
`

async function fetchData(qs: string) {
  const sp = new URLSearchParams(qs)
  const f  = parseFilters(sp)
  const { cte, params } = buildCteQuery(f)

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 120000')
    const res = await client.query(`
      ${cte}
      SELECT 'global'::text AS t, NULL::text AS lbl,
        ${AGG_AGING}, NULL::float8 AS imp
      FROM base

      UNION ALL

      SELECT 'dr', "DR",
        ${AGG_AGING}, NULL::float8
      FROM base WHERE "DR" IS NOT NULL
      GROUP BY "DR"

      UNION ALL

      SELECT 'statut', statut_facture,
        COUNT(*)::int, COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),0)::float8,
        NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
        COALESCE(SUM(impaye),0)::float8
      FROM base WHERE statut_facture IS NOT NULL
      GROUP BY statut_facture

      ORDER BY t, regle DESC NULLS LAST
    `, params)

    const rows = res.rows
    const gRow = rows.find(r => r.t === 'global') ?? {}

    const mkAging = (r: Record<string, unknown>) => ({
      dr:          r.lbl ? String(r.lbl) : undefined,
      nb_factures: Number(r.nb),
      ca_total:    Number(r.ca),
      total_regle: Number(r.regle),
      a_j:    Number(r.aj),  a_jp15: Number(r.aj15), a_jp30: Number(r.aj30),
      a_jp45: Number(r.aj45), a_jp60: Number(r.aj60), a_jp75: Number(r.aj75),
      a_jp90: Number(r.aj90), a_js90: Number(r.ajs90),
    })

    return {
      filters: f,
      global: mkAging(gRow),
      par_dr: rows.filter(r => r.t === 'dr').map(mkAging),
      par_statut: rows.filter(r => r.t === 'statut').map(r => ({
        statut_facture: String(r.lbl),
        nb_factures:    Number(r.nb),
        ca_total:       Number(r.ca),
        montant_regle:  Number(r.regle),
        impaye:         Number(r.imp),
      })),
      source: 'sen_ods · mv_recouvrement',
    }
  } finally { client.release() }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`rapports_reglements:${qs}`, () => fetchData(qs), TTL_1H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rapports/reglements] SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
