/**
 * GET /api/carte/filtres
 * Retourne les valeurs distinctes disponibles pour les filtres de la carte :
 *   annees, drs, statuts_facture, groupes_facturation
 * Cache 1h (valeurs peu volatiles)
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache, TTL_1H } from '@/lib/serverCache'

async function fetchFiltres() {
  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000') // 5 min pour cette requête analytique

    const [resAnnees, resDRs, resStatuts, resGroupes] = await Promise.all([
      client.query(`
        SELECT DISTINCT
          CAST(SPLIT_PART("PERIODE_FACTURATION", '/', 2) AS int) AS annee
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
        ORDER BY annee DESC
      `),
      client.query(`
        SELECT DISTINCT "DR" AS dr
        FROM public.mv_recouvrement
        WHERE "DR" IS NOT NULL AND "DR" <> ''
        ORDER BY 1
      `),
      client.query(`
        SELECT DISTINCT statut_facture AS statut
        FROM public.mv_recouvrement
        WHERE statut_facture IS NOT NULL AND statut_facture <> ''
        ORDER BY 1
      `),
      client.query(`
        SELECT DISTINCT "GROUPE_FACTURATION" AS groupe
        FROM public.mv_recouvrement
        WHERE "GROUPE_FACTURATION" IS NOT NULL AND "GROUPE_FACTURATION" <> ''
        ORDER BY 1
      `),
    ])

    return {
      annees:   resAnnees.rows.map(r => Number(r.annee)),
      drs:      resDRs.rows.map(r => String(r.dr)),
      statuts:  resStatuts.rows.map(r => String(r.statut)),
      groupes:  resGroupes.rows.map(r => String(r.groupe)),
    }
  } finally {
    client.release()
  }
}

export async function GET() {
  try {
    const data = await withCache('carte_filtres', fetchFiltres, TTL_1H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/filtres]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
