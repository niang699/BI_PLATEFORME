/**
 * GET /api/carte/overview
 * Agrégation par UO/Secteur — source : mv_carte_secteurs (géo) × mv_recouvrement (finance)
 *
 * Filtres (tous optionnels) :
 *   annee              — défaut 2025
 *   bimestre           — 1 à 6 (jan-fév=1 … nov-déc=6)
 *   dr                 — Direction Régionale
 *   statut_facture     — ex. 'regle', 'impaye', 'partiel'
 *   groupe_facturation — ex. 'Clients Privés', 'Gros Consommateurs'
 *
 * Cache 30 min par combinaison de filtres
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

async function fetchOverview(qs: string) {
  const sp       = new URLSearchParams(qs)
  const annee    = parseInt(sp.get('annee') ?? '2025', 10)
  const bimestre = sp.get('bimestre') ? parseInt(sp.get('bimestre')!, 10) : null
  const dr       = sp.get('dr')     ?? null
  const statut   = sp.get('statut') ?? null
  const groupes  = sp.getAll('groupe').filter(Boolean)

  const client = await pool.connect()
  try {
    /* ── Vérification MV géo ── */
    const mvExists = await client.query(`
      SELECT 1 FROM pg_matviews
      WHERE matviewname = 'mv_carte_secteurs' AND ispopulated = true
    `)

    if (!mvExists.rowCount || mvExists.rowCount === 0) {
      // Fallback brut — API_CLIENT seul, sans données financières
      await client.query('SET statement_timeout = 300000')
      const res = await client.query(`
        SELECT
          "UO"  AS uo, "CODE_UO" AS code_uo,
          COUNT(*)::int AS nb_total, 0 AS nb_sans_facture,
          COUNT(DISTINCT "CODE_TOURNEE")::int AS nb_tournees,
          ROUND(AVG(CASE WHEN "COORD_X" ~ '^-?[0-9]+[.,]?[0-9]*$'
            AND REPLACE("COORD_X",',','.')::float BETWEEN 10 AND 17
            THEN REPLACE("COORD_X",',','.')::float END)::numeric,6) AS lat,
          ROUND(AVG(CASE WHEN "COORD_Y" ~ '^-?[0-9]+[.,]?[0-9]*$'
            AND REPLACE("COORD_Y",',','.')::float BETWEEN -18 AND -10
            THEN REPLACE("COORD_Y",',','.')::float END)::numeric,6) AS lng,
          0 AS nb_factures, 0 AS ca_total, 0 AS enc_total,
          0 AS imp_total,   0 AS volume_total, 0 AS taux_recouvrement
        FROM "API_CLIENT"
        WHERE "UO" IS NOT NULL AND "STATUT" = 'actif'
        GROUP BY "UO", "CODE_UO"
        HAVING AVG(CASE WHEN "COORD_X" ~ '^-?[0-9]+[.,]?[0-9]*$'
          AND REPLACE("COORD_X",',','.')::float BETWEEN 10 AND 17
          THEN REPLACE("COORD_X",',','.')::float END) IS NOT NULL
        ORDER BY nb_total DESC
      `)
      return { secteurs: res.rows, annee, timestamp: new Date().toISOString() }
    }

    /* ── Filtres dynamiques sur mv_recouvrement ── */
    await client.query('SET statement_timeout = 300000')
    const conditions: string[] = [
      `"PERIODE_FACTURATION" LIKE '__/____'`,
      `CAST(SPLIT_PART("PERIODE_FACTURATION", '/', 2) AS int) = $1`,
      `"UO" IS NOT NULL`,
    ]
    const params: unknown[] = [annee]
    let pi = 2

    // Bimestre : mois 1-2 → bim 1, mois 3-4 → bim 2, etc.
    if (bimestre) {
      conditions.push(`CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) / 2.0)::int = $${pi}`)
      params.push(bimestre); pi++
    }
    if (dr) {
      conditions.push(`"DR" = $${pi}`)
      params.push(dr); pi++
    }
    if (statut) {
      conditions.push(`statut_facture = $${pi}`)
      params.push(statut); pi++
    }
    if (groupes.length > 0) {
      conditions.push(`"GROUPE_FACTURATION" = ANY($${pi}::text[])`)
      params.push(groupes); pi++
    }

    const where = conditions.join(' AND ')

    const res = await client.query(`
      WITH
      -- PDI distincts ayant au moins une facture dans la période filtrée
      pdi_fact AS (
        SELECT DISTINCT "PDI_REFERENCE"
        FROM public.mv_recouvrement
        WHERE ${where}
          AND "PDI_REFERENCE" IS NOT NULL
      ),
      -- UOs ayant au moins une activité dans le périmètre filtré (même WHERE que recap/pdi_fact)
      -- Garantit l'alignement DR / bimestre / statut / groupe sur les comptages clients
      uo_filtre AS (
        SELECT DISTINCT "UO"
        FROM public.mv_recouvrement
        WHERE ${where}
      ),
      -- Comptage PDI actifs par UO depuis API_CLIENT (source de vérité, live)
      -- INNER JOIN uo_filtre : seuls les UOs actifs dans le périmètre sont comptés
      -- Évite d'inflater nb_sans_facture_filtre avec des clients hors DR/bimestre sélectionné
      clients_uo AS (
        SELECT
          c."UO",
          COUNT(*)::int                                               AS nb_total_live,
          COUNT(*) FILTER (WHERE f."PDI_REFERENCE" IS NOT NULL)::int AS nb_avec_facture,
          COUNT(*) FILTER (WHERE f."PDI_REFERENCE" IS NULL)::int     AS nb_sans_facture_filtre
        FROM "API_CLIENT" c
        INNER JOIN uo_filtre u ON c."UO" = u."UO"
        LEFT JOIN  pdi_fact  f ON c."PDI_REFERENCE" = f."PDI_REFERENCE"
        WHERE c."STATUT" = 'actif' AND c."UO" IS NOT NULL
        GROUP BY c."UO"
      ),
      -- Agrégats financiers depuis mv_recouvrement (inchangé)
      recap AS (
        SELECT
          "UO",
          COUNT(*)::int                                         AS nb_factures,
          COALESCE(SUM(chiffre_affaire), 0)::float8             AS ca_total,
          COALESCE(SUM(montant_regle),   0)::float8             AS enc_total,
          COALESCE(SUM(impaye),          0)::float8             AS imp_total,
          COALESCE(SUM(volume),          0)::float8             AS volume_total,
          ROUND(
            COALESCE(SUM(montant_regle), 0)::numeric
            / NULLIF(SUM(chiffre_affaire), 0) * 100, 1
          )::float8                                             AS taux_recouvrement
        FROM public.mv_recouvrement
        WHERE ${where}
        GROUP BY "UO"
      )
      SELECT
        g.uo, g.code_uo,
        g.nb_total, g.nb_sans_facture, g.nb_tournees,
        g.lat, g.lng,
        COALESCE(r.nb_factures,             0)  AS nb_factures,
        COALESCE(cf.nb_total_live,          g.nb_total) AS nb_total_live,
        COALESCE(cf.nb_avec_facture,        0)  AS nb_avec_facture,
        COALESCE(cf.nb_sans_facture_filtre, 0)  AS nb_sans_facture_filtre,
        COALESCE(r.ca_total,             0)  AS ca_total,
        COALESCE(r.enc_total,            0)  AS enc_total,
        COALESCE(r.imp_total,            0)  AS imp_total,
        COALESCE(r.volume_total,         0)  AS volume_total,
        COALESCE(r.taux_recouvrement,    0)  AS taux_recouvrement
      FROM mv_carte_secteurs g
      LEFT JOIN recap     r  ON g.uo = r."UO"
      LEFT JOIN clients_uo cf ON g.uo = cf."UO"
      ORDER BY g.nb_total DESC
    `, params)

    return {
      secteurs:  res.rows,
      annee,
      filters: { annee, bimestre, dr, statut, groupes },
      timestamp: new Date().toISOString(),
    }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`carte_overview:${qs}`, () => fetchOverview(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/overview]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
