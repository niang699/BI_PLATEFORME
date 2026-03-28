/**
 * GET /api/carte/ca-manquant/anciennete/details
 *
 * Détail paginé des prises actives non facturées, avec catégorie d'ancienneté.
 *
 * Params :
 *   annee     – année (défaut 2025)
 *   dr        – direction régionale (optionnel)
 *   categorie – jamais | 3plus | 2bim | 1bim | all  (défaut: jamais)
 *   uo        – filtre UO exact (optionnel)
 *   search    – filtre PDI_REFERENCE ILIKE (optionnel)
 *   page      – numéro de page (défaut 1)
 *   limit     – lignes/page (défaut 50, max 5000 pour export)
 *
 * Retourne : { rows, total, page, pages, limit, annee, filters }
 *
 * Cache 5 min (courte durée : beaucoup de combinaisons possibles)
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_5M       = 5 * 60 * 1000
const DEFAULT_LIMIT = 50
const MAX_LIMIT     = 5000

async function fetchDetails(qs: string) {
  const sp        = new URLSearchParams(qs)
  const annee     = parseInt(sp.get('annee') ?? '2025', 10)
  const dr        = sp.get('dr') ?? null
  const categorie = sp.get('categorie') ?? 'jamais'
  const uo        = sp.get('uo') ?? null
  const search    = (sp.get('search') ?? '').trim()
  const page      = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit     = Math.min(MAX_LIMIT, Math.max(10, parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10)))
  const offset    = (page - 1) * limit

  /* ── Construction des paramètres SQL ── */
  const params: (number | string)[] = [annee]

  /* DR — même index pour mv_recouvrement ET API_CLIENT */
  let drParamIdx = 0
  if (dr) {
    params.push(dr)
    drParamIdx = params.length
  }
  const drCondRec    = drParamIdx ? `AND "DR" = $${drParamIdx}` : ''
  const drCondClient = drParamIdx ? `AND "DR" = $${drParamIdx}` : ''

  /* Filtres sur la CTE "filtered" */
  const filteredConds: string[] = []

  if (categorie && categorie !== 'all') {
    params.push(categorie)
    filteredConds.push(`categorie = $${params.length}`)
  }
  if (uo) {
    params.push(uo)
    filteredConds.push(`"UO" = $${params.length}`)
  }
  if (search) {
    params.push(`%${search.toUpperCase()}%`)
    filteredConds.push(`UPPER("PDI_REFERENCE") LIKE $${params.length}`)
  }

  const filteredWhere = filteredConds.length
    ? 'WHERE ' + filteredConds.join(' AND ')
    : ''

  /* Pagination */
  params.push(limit);  const limitIdx  = params.length
  params.push(offset); const offsetIdx = params.length

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000')

    const res = await client.query(`
      WITH
      /* ── Bimestres facturés par PDI ── */
      bim_fact AS (
        SELECT
          "PDI_REFERENCE",
          COUNT(DISTINCT
            CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)/2.0)::int
          )::int AS nb_bim_factures
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          AND chiffre_affaire > 0
          AND "PDI_REFERENCE" IS NOT NULL
          ${drCondRec}
        GROUP BY "PDI_REFERENCE"
      ),

      /* ── Nombre de bimestres disponibles dans l'année ── */
      max_bim AS (
        SELECT COALESCE(
          MAX(CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)/2.0)::int), 6
        ) AS nb
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          ${drCondRec}
      ),

      /* ── Parc actif ── */
      parc AS (
        SELECT "PDI_REFERENCE", "UO", COALESCE("CODE_TOURNEE", '—') AS tournee
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif'
          AND "PDI_REFERENCE" IS NOT NULL
          AND "UO" IS NOT NULL
          ${drCondClient}
      ),

      /* ── Absence + catégorisation ── */
      absence AS (
        SELECT
          p."PDI_REFERENCE",
          p."UO",
          p.tournee                                    AS code_tournee,
          COALESCE(f.nb_bim_factures, 0)              AS nb_bim_factures,
          (SELECT nb FROM max_bim)                    AS nb_bim_total,
          (SELECT nb FROM max_bim) - COALESCE(f.nb_bim_factures, 0) AS nb_bim_absents,
          CASE
            WHEN COALESCE(f.nb_bim_factures, 0) = 0                            THEN 'jamais'
            WHEN (SELECT nb FROM max_bim) - COALESCE(f.nb_bim_factures,0) >= 3 THEN '3plus'
            WHEN (SELECT nb FROM max_bim) - COALESCE(f.nb_bim_factures,0) = 2  THEN '2bim'
            ELSE                                                                     '1bim'
          END AS categorie
        FROM parc p
        LEFT JOIN bim_fact f ON p."PDI_REFERENCE" = f."PDI_REFERENCE"
        WHERE COALESCE(f.nb_bim_factures, 0) < (SELECT nb FROM max_bim)
      ),

      /* ── Filtre dynamique ── */
      filtered AS (
        SELECT * FROM absence
        ${filteredWhere}
      )

      /* ── Résultat paginé avec total ── */
      SELECT
        "PDI_REFERENCE",
        "UO",
        code_tournee,
        nb_bim_factures,
        nb_bim_total,
        nb_bim_absents,
        categorie,
        COUNT(*) OVER() AS total_count
      FROM filtered
      ORDER BY nb_bim_absents DESC, categorie, "PDI_REFERENCE"
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params)

    const total = res.rows.length > 0 ? Number(res.rows[0].total_count) : 0
    const pages = Math.max(1, Math.ceil(total / limit))

    return {
      rows: res.rows.map(r => ({
        pdi_reference:  r.PDI_REFERENCE,
        uo:             r.UO,
        code_tournee:   r.code_tournee,
        nb_bim_factures: r.nb_bim_factures,
        nb_bim_total:   r.nb_bim_total,
        nb_bim_absents: r.nb_bim_absents,
        categorie:      r.categorie,
      })),
      total,
      page,
      pages,
      limit,
      annee,
      filters: { annee, dr, categorie, uo: uo ?? null, search: search || null },
      timestamp: new Date().toISOString(),
    }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`ca_anc_details:${qs}`, () => fetchDetails(qs), TTL_5M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant/anciennete/details]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
