/**
 * GET /api/filtres — Listes déroulantes
 * Cache TTL 24h (sans ?dr) / 1h (avec ?dr cascade) : métadonnées stables.
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache, TTL_1H, TTL_24H } from '@/lib/serverCache'

async function fetchDrUnites(dr: string) {
  const client = await pool.connect()
  try {
    const uoRes = await client.query(
      `SELECT DISTINCT "UO" AS uo
       FROM   public.mv_recouvrement
       WHERE  "DR" = $1 AND "UO" IS NOT NULL
       ORDER  BY "UO"
       LIMIT  200`,
      [dr]
    )
    return { unites: uoRes.rows.map(r => r.uo as string) }
  } finally { client.release() }
}

async function fetchAllFiltres() {
  const client = await pool.connect()
  try {
    const [perRes, drRes, uoRes, statRes, anneesRes, catRes, groupeRes, branchRes, typeRes] =
      await Promise.all([
        client.query(`
          SELECT "PERIODE_FACTURATION" AS p
          FROM   public.mv_recouvrement
          WHERE  "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
            AND  CAST(SPLIT_PART("PERIODE_FACTURATION", '/', 2) AS int) BETWEEN 2010 AND 2030
          GROUP  BY "PERIODE_FACTURATION"
          ORDER  BY TO_DATE("PERIODE_FACTURATION", 'MM/YYYY') DESC
          LIMIT  24
        `),
        client.query(`
          SELECT DISTINCT "DR" AS dr
          FROM   public.mv_recouvrement
          WHERE  "DR" IS NOT NULL ORDER BY "DR"
        `),
        client.query(`
          SELECT DISTINCT "UO" AS uo
          FROM   public.mv_recouvrement
          WHERE  "UO" IS NOT NULL ORDER BY "UO" LIMIT 200
        `),
        client.query(`
          SELECT DISTINCT statut_facture AS statut
          FROM   public.mv_recouvrement
          WHERE  statut_facture IS NOT NULL ORDER BY statut_facture
        `),
        client.query(`
          SELECT DISTINCT CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) AS annee
          FROM   public.mv_recouvrement
          WHERE  "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
            AND  CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) BETWEEN 2010 AND 2030
          ORDER  BY annee DESC
        `),
        client.query(`
          SELECT DISTINCT categorie_rgp AS categorie
          FROM   public.mv_recouvrement
          WHERE  categorie_rgp IS NOT NULL ORDER BY categorie_rgp
        `),
        client.query(`
          SELECT DISTINCT "GROUPE_FACTURATION" AS groupe
          FROM   public.mv_recouvrement
          WHERE  "GROUPE_FACTURATION" IS NOT NULL ORDER BY "GROUPE_FACTURATION"
        `),
        client.query(`
          SELECT DISTINCT "CAT_BRANCHEMENT" AS cat
          FROM   public.mv_recouvrement
          WHERE  "CAT_BRANCHEMENT" IS NOT NULL ORDER BY "CAT_BRANCHEMENT" LIMIT 50
        `),
        client.query(`
          SELECT DISTINCT "TYPE_FACTURE" AS type
          FROM   public.mv_recouvrement
          WHERE  "TYPE_FACTURE" IS NOT NULL ORDER BY "TYPE_FACTURE"
        `),
      ])

    return {
      periodes:               perRes.rows.map(r => r.p),
      directions:             drRes.rows.map(r => r.dr as string),
      unites:                 uoRes.rows.map(r => r.uo as string),
      statuts:                statRes.rows.map(r => r.statut as string),
      annees:                 anneesRes.rows.map(r => r.annee as number),
      bimestres:              [1, 2, 3, 4, 5, 6],
      categories_rgp:         catRes.rows.map(r => r.categorie as string),
      groupes_facturation:    groupeRes.rows.map(r => r.groupe as string),
      categories_branchement: branchRes.rows.map(r => r.cat as string),
      types_facture:          typeRes.rows.map(r => r.type as string),
      source: 'sen_ods · mv_recouvrement',
    }
  } finally { client.release() }
}

export async function GET(req: NextRequest) {
  const dr = req.nextUrl.searchParams.get('dr')

  try {
    if (dr) {
      const data = await withCache(`filtres_dr:${dr}`, () => fetchDrUnites(dr), TTL_1H)
      return NextResponse.json(data)
    }
    const data = await withCache('filtres_all', fetchAllFiltres, TTL_24H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/filtres] Erreur SQL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
