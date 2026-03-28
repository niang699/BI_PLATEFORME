/**
 * GET /api/carte/ca-manquant/jamais-facturees
 *
 * Prises actives (API_CLIENT) sans AUCUNE facture dans mv_recouvrement
 * pour l'année entière. Signal critique : raccordement non relevé,
 * compteur défaillant, fraude potentielle.
 *
 * Retourne :
 *   - par_uo  : [ { uo, nb_prises, ca_manquant_estime } ] trié DESC
 *   - total   : nb total + CA estimé
 *   - annee
 *
 * Cache 30 min
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

async function fetchJamaisFacturees(qs: string) {
  const sp    = new URLSearchParams(qs)
  const annee = parseInt(sp.get('annee') ?? '2025', 10)
  const dr    = sp.get('dr') ?? null

  const drCond   = dr ? `AND "DR" = $2` : ''
  const params   = dr ? [annee, dr] : [annee]

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000')

    const res = await client.query(`
      WITH
      /* ── PDI ayant AU MOINS UNE facture dans l'année ── */
      fact_year AS (
        SELECT DISTINCT "PDI_REFERENCE"
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          AND chiffre_affaire > 0
          AND "PDI_REFERENCE" IS NOT NULL
          ${drCond}
      ),

      /* ── Parc actif ── */
      parc AS (
        SELECT "PDI_REFERENCE", "UO"
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif'
          AND "PDI_REFERENCE" IS NOT NULL
          AND "UO" IS NOT NULL
      ),

      /* ── Prises actives jamais facturées dans l'année ── */
      jamais AS (
        SELECT p."PDI_REFERENCE", p."UO"
        FROM parc p
        LEFT JOIN fact_year f ON p."PDI_REFERENCE" = f."PDI_REFERENCE"
        WHERE f."PDI_REFERENCE" IS NULL
      ),

      /* ── CA moyen par UO pour estimer le manque ── */
      ca_uo AS (
        SELECT "UO", AVG(chiffre_affaire) AS ca_moy, COUNT(DISTINCT "PDI_REFERENCE")::int AS nb_factures
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          AND chiffre_affaire > 0
          AND "UO" IS NOT NULL
          ${drCond}
        GROUP BY "UO"
      ),

      /* ── Nombre de bimestres dans l'année (pour multiplier le CA annuel estimé) ── */
      nb_bim AS (
        SELECT COALESCE(
          MAX(CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)/2.0)::int), 6
        ) AS nb
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          ${drCond}
      )

      SELECT
        j."UO"                                                         AS uo,
        COUNT(*)::int                                                   AS nb_prises,
        COALESCE(u.nb_factures, 0)                                     AS nb_obs_stratum,
        /* CA annuel estimé = CA moyen/facture × nb bimestres disponibles */
        ROUND(
          COUNT(*) * COALESCE(u.ca_moy, 0) * (SELECT nb FROM nb_bim)
        )::float8                                                       AS ca_manquant_annuel,
        CASE
          WHEN u.nb_factures >= 20 THEN 'haute'
          WHEN u.nb_factures >= 5  THEN 'acceptable'
          ELSE                          'indicatif'
        END                                                             AS fiabilite
      FROM jamais j
      LEFT JOIN ca_uo u ON j."UO" = u."UO"
      GROUP BY j."UO", u.ca_moy, u.nb_factures, (SELECT nb FROM nb_bim)
      ORDER BY nb_prises DESC
    `, params)

    const total_prises = res.rows.reduce((s: number, r: { nb_prises: number }) => s + r.nb_prises, 0)
    const total_ca     = res.rows.reduce((s: number, r: { ca_manquant_annuel: number }) => s + (r.ca_manquant_annuel ?? 0), 0)

    return {
      par_uo: res.rows,
      total_prises,
      total_ca,
      annee,
      filters: { annee, dr },
      timestamp: new Date().toISOString(),
    }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`ca_jamais:${qs}`, () => fetchJamaisFacturees(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant/jamais-facturees]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
