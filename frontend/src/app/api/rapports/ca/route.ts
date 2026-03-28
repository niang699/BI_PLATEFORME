/**
 * GET /api/rapports/ca — Détail CA
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
      SELECT 'groupe'::text AS dim, COALESCE("GROUPE_FACTURATION",'—') AS lbl,
        COUNT(*)::int AS nb, COALESCE(SUM(chiffre_affaire),0)::float8 AS ca,
        COALESCE(SUM(montant_regle),0)::float8 AS enc, COALESCE(SUM(impaye),0)::float8 AS imp
      FROM base WHERE "GROUPE_FACTURATION" IS NOT NULL
      GROUP BY "GROUPE_FACTURATION"

      UNION ALL

      SELECT 'type', COALESCE("TYPE_FACTURE",'—'),
        COUNT(*)::int, COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),0)::float8, COALESCE(SUM(impaye),0)::float8
      FROM base WHERE "TYPE_FACTURE" IS NOT NULL
      GROUP BY "TYPE_FACTURE"

      UNION ALL

      SELECT 'branchement', COALESCE("CAT_BRANCHEMENT",'—'),
        COUNT(*)::int, COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),0)::float8, COALESCE(SUM(impaye),0)::float8
      FROM base WHERE "CAT_BRANCHEMENT" IS NOT NULL
      GROUP BY "CAT_BRANCHEMENT"

      UNION ALL

      SELECT 'dr', COALESCE("DR",'—'),
        COUNT(*)::int, COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),0)::float8, COALESCE(SUM(impaye),0)::float8
      FROM base WHERE "DR" IS NOT NULL
      GROUP BY "DR"

      ORDER BY dim, ca DESC
    `, params)

    const mk = (r: Record<string, unknown>) => ({
      label:             String(r.lbl),
      nb_factures:       Number(r.nb),
      ca_total:          Number(r.ca),
      encaissement:      Number(r.enc),
      impaye:            Number(r.imp),
      taux_recouvrement: Number(r.ca) > 0 ? Math.round(Number(r.enc) * 1000 / Number(r.ca)) / 10 : 0,
    })

    const by = (dim: string) => res.rows.filter(r => r.dim === dim).map(mk)
    return {
      filters: f,
      par_groupe:      by('groupe'),
      par_type:        by('type'),
      par_branchement: by('branchement'),
      par_dr:          by('dr'),
      source: 'sen_ods · mv_recouvrement',
    }
  } finally { client.release() }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`rapports_ca:${qs}`, () => fetchData(qs), TTL_1H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rapports/ca] SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
