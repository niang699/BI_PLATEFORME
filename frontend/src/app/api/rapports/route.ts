/**
 * GET /api/rapports — Récapitulatif
 * Cache TTL 1h : données sen_ods mises à jour 1x/jour.
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { parseFilters, buildCteQuery, buildPrevFilters } from '@/lib/rapportFilters'
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
      SELECT 'kpi' AS t,
        NULL::text AS lbl, NULL::int AS bv, NULL::int AS av,
        COUNT(*)::int                                AS nb_factures,
        COALESCE(SUM(chiffre_affaire),0)::float8     AS ca,
        COALESCE(SUM(montant_regle),  0)::float8     AS enc,
        COALESCE(SUM(impaye),         0)::float8     AS imp,
        COUNT(DISTINCT "DR")::int                    AS extra
      FROM base

      UNION ALL

      SELECT 'dr', "DR", NULL, NULL,
        COUNT(*)::int,
        COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),  0)::float8,
        COALESCE(SUM(impaye),         0)::float8,
        NULL
      FROM base
      WHERE "DR" IS NOT NULL
      GROUP BY "DR"

      UNION ALL

      SELECT 'bim', NULL, bv, av,
        COUNT(*)::int,
        COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),  0)::float8,
        NULL, NULL
      FROM base
      GROUP BY bv, av
      ORDER BY t, bv, av
    `, params)

    const rows = res.rows
    const kpi  = rows.find(r => r.t === 'kpi') ?? {}
    const ca   = Number(kpi.ca  ?? 0)
    const enc  = Number(kpi.enc ?? 0)
    const taux = ca > 0 ? Math.round(enc * 1000 / ca) / 10 : 0

    let kpis_prev: Record<string, number> | null = null
    let prev_label: string | null = null

    const prevCtx = buildPrevFilters(f)
    if (prevCtx) {
      const { cte: ctePrev, params: paramsPrev } = buildCteQuery(prevCtx.filters)
      const resPrev = await client.query(`
        ${ctePrev}
        SELECT
          COUNT(*)::int                             AS nb_factures,
          COALESCE(SUM(chiffre_affaire),0)::float8  AS ca,
          COALESCE(SUM(montant_regle),  0)::float8  AS enc,
          COALESCE(SUM(impaye),         0)::float8  AS imp
        FROM base
      `, paramsPrev)

      if (resPrev.rows.length) {
        const p    = resPrev.rows[0]
        const pCa  = Number(p.ca  ?? 0)
        const pEnc = Number(p.enc ?? 0)
        kpis_prev = {
          nb_factures:       Number(p.nb_factures ?? 0),
          ca_total:          pCa,
          encaissement:      pEnc,
          impaye:            Number(p.imp ?? 0),
          taux_recouvrement: pCa > 0 ? Math.round(pEnc * 1000 / pCa) / 10 : 0,
        }
        prev_label = prevCtx.label
      }
    }

    const mkDr = (r: Record<string, unknown>) => ({
      dr:                String(r.lbl ?? ''),
      nb_factures:       Number(r.nb_factures),
      ca_total:          Number(r.ca),
      encaissement:      Number(r.enc),
      impaye:            Number(r.imp),
      taux_recouvrement: Number(r.ca) > 0 ? Math.round(Number(r.enc) * 1000 / Number(r.ca)) / 10 : 0,
    })

    const mkBim = (r: Record<string, unknown>) => ({
      bimestre:          Number(r.bv),
      annee:             Number(r.av),
      nb_factures:       Number(r.nb_factures),
      ca_total:          Number(r.ca),
      encaissement:      Number(r.enc),
      taux_recouvrement: Number(r.ca) > 0 ? Math.round(Number(r.enc) * 1000 / Number(r.ca)) / 10 : 0,
    })

    return {
      filters: f,
      kpis: {
        nb_factures:       Number(kpi.nb_factures ?? 0),
        ca_total:          ca,
        encaissement:      enc,
        impaye:            Number(kpi.imp ?? 0),
        taux_recouvrement: taux,
        nb_dr:             Number(kpi.extra ?? 0),
      },
      kpis_prev,
      prev_label,
      par_dr: rows.filter(r => r.t === 'dr').sort((a, b) => {
        const ta = Number(a.ca) > 0 ? Number(a.enc) / Number(a.ca) : 0
        const tb = Number(b.ca) > 0 ? Number(b.enc) / Number(b.ca) : 0
        return tb - ta
      }).map(mkDr),
      par_bimestre: rows.filter(r => r.t === 'bim').map(mkBim),
      source: 'sen_ods · mv_recouvrement',
    }
  } finally { client.release() }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`rapports:${qs}`, () => fetchData(qs), TTL_1H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rapports] SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
