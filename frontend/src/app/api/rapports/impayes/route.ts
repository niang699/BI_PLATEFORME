/**
 * GET /api/rapports/impayes — Impayés
 * Cache TTL 1h : données sen_ods mises à jour 1x/jour.
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { parseFilters, buildCteQuery } from '@/lib/rapportFilters'
import { withCache, TTL_1H } from '@/lib/serverCache'

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
        COUNT(*)::int AS nb,
        COALESCE(SUM(chiffre_affaire),0)::float8 AS ca,
        COALESCE(SUM(impaye),0)::float8 AS imp
      FROM base WHERE impaye > 0

      UNION ALL

      SELECT 'dr', "DR",
        COUNT(*)::int, COALESCE(SUM(chiffre_affaire),0)::float8, COALESCE(SUM(impaye),0)::float8
      FROM base WHERE impaye > 0 AND "DR" IS NOT NULL
      GROUP BY "DR"

      UNION ALL

      SELECT 'statut', statut_facture,
        COUNT(*)::int, COALESCE(SUM(chiffre_affaire),0)::float8, COALESCE(SUM(impaye),0)::float8
      FROM base WHERE impaye > 0 AND statut_facture IS NOT NULL
      GROUP BY statut_facture

      UNION ALL

      SELECT 'groupe', "GROUPE_FACTURATION",
        COUNT(*)::int, COALESCE(SUM(chiffre_affaire),0)::float8, COALESCE(SUM(impaye),0)::float8
      FROM base WHERE impaye > 0 AND "GROUPE_FACTURATION" IS NOT NULL
      GROUP BY "GROUPE_FACTURATION"

      UNION ALL

      SELECT 'branchement', "CAT_BRANCHEMENT",
        COUNT(*)::int, NULL::float8, COALESCE(SUM(impaye),0)::float8
      FROM base WHERE impaye > 0 AND "CAT_BRANCHEMENT" IS NOT NULL
      GROUP BY "CAT_BRANCHEMENT"

      ORDER BY t, imp DESC NULLS LAST
    `, params)

    const rows = res.rows
    const g    = rows.find(r => r.t === 'global') ?? {}
    const gCa  = Number(g.ca ?? 0)
    const gImp = Number(g.imp ?? 0)

    const mkRow = (r: Record<string, unknown>) => ({
      label:        String(r.lbl ?? ''),
      nb_factures:  Number(r.nb),
      ca_total:     r.ca != null ? Number(r.ca) : undefined,
      impaye_total: Number(r.imp),
      taux_impaye:  r.ca != null && Number(r.ca) > 0
        ? Math.round(Number(r.imp) * 1000 / Number(r.ca)) / 10
        : undefined,
    })

    return {
      filters: f,
      global: {
        nb_factures:  Number(g.nb ?? 0),
        impaye_total: gImp,
        ca_total:     gCa,
        taux_impaye:  gCa > 0 ? Math.round(gImp * 1000 / gCa) / 10 : 0,
      },
      par_dr:          rows.filter(r => r.t === 'dr').map(mkRow),
      par_statut:      rows.filter(r => r.t === 'statut').map(mkRow),
      par_groupe:      rows.filter(r => r.t === 'groupe').map(mkRow),
      par_branchement: rows.filter(r => r.t === 'branchement').map(mkRow),
      source: 'sen_ods · mv_recouvrement',
    }
  } finally { client.release() }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`rapports_impayes:${qs}`, () => fetchData(qs), TTL_1H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rapports/impayes] SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
