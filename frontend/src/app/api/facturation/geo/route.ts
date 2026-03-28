/**
 * GET /api/facturation/geo
 * Points géolocalisés issus de mv_recouvrement_geo (sen_ods)
 * Croisement mv_recouvrement × API_CLIENT via PDI_REFERENCE
 *
 * Params (tous optionnels) :
 *   minLat, maxLat, minLng, maxLng — bbox (requis si zoom ≥ seuil)
 *   annee    — ex. 2025
 *   bimestre — 1-6
 *   dr       — Direction Régionale
 *   uo       — Unité Organisationnelle
 *   statut   — 'regle' | 'impaye' | 'partiel'
 *   limit    — max 5000 (défaut 2000)
 *
 * Retourne : points[], count, capped, stats (ca_total, impaye, taux_moy)
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'

const MAX_LIMIT = 5000
const DEF_LIMIT = 2000

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const minLat = parseFloat(sp.get('minLat') ?? '')
  const maxLat = parseFloat(sp.get('maxLat') ?? '')
  const minLng = parseFloat(sp.get('minLng') ?? '')
  const maxLng = parseFloat(sp.get('maxLng') ?? '')
  const hasBbox = [minLat, maxLat, minLng, maxLng].every(v => !isNaN(v))

  const annee    = sp.get('annee')    ? parseInt(sp.get('annee')!)    : null
  const bimestre = sp.get('bimestre') ? parseInt(sp.get('bimestre')!) : null
  const dr       = sp.get('dr')       ?? null
  const uo       = sp.get('uo')       ?? null
  const statut   = sp.get('statut')   ?? null
  const limit    = Math.min(parseInt(sp.get('limit') ?? String(DEF_LIMIT)), MAX_LIMIT)

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 30000')

    const conditions: string[] = [
      'lat IS NOT NULL',
      'lng IS NOT NULL',
    ]
    const params: unknown[] = []
    let pi = 1

    // Filtre bbox
    if (hasBbox) {
      conditions.push(`lat BETWEEN $${pi} AND $${pi + 1}`)
      conditions.push(`lng BETWEEN $${pi + 2} AND $${pi + 3}`)
      params.push(minLat, maxLat, minLng, maxLng)
      pi += 4
    }

    // Filtre année
    if (annee) {
      conditions.push(`"PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'`)
      conditions.push(`CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $${pi}`)
      params.push(annee)
      pi++
    }

    // Filtre bimestre (1=jan-fév, 2=mar-avr, …)
    if (bimestre && annee) {
      const mois = [(bimestre - 1) * 2 + 1, (bimestre - 1) * 2 + 2]
      conditions.push(
        `CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) = ANY($${pi}::int[])`
      )
      params.push(mois)
      pi++
    }

    // Filtre DR
    if (dr) {
      conditions.push(`"DR" = $${pi}`)
      params.push(dr)
      pi++
    }

    // Filtre UO
    if (uo) {
      conditions.push(`"UO" = $${pi}`)
      params.push(uo)
      pi++
    }

    // Filtre statut facture
    if (statut) {
      conditions.push(`"statut_facture" = $${pi}`)
      params.push(statut)
      pi++
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // Requête principale — points
    const resPoints = await client.query(`
      SELECT
        "REFERENCE_FACTURE"   AS id,
        "REFERENCE_CLIENT"    AS ref_client,
        "PDI_REFERENCE"       AS pdi,
        "DR"                  AS dr,
        "UO"                  AS uo,
        "PERIODE_FACTURATION" AS periode,
        "statut_facture"      AS statut,
        "categorie_rgp"       AS categorie,
        "CODE_TOURNEE"        AS tournee,
        "ADRESSE_TECHNIQUE"   AS adresse,
        chiffre_affaire::float8  AS ca,
        montant_regle::float8    AS regle,
        impaye::float8           AS impaye,
        taux_recouvrement::float8 AS taux,
        lat::float8,
        lng::float8
      FROM mv_recouvrement_geo
      ${where}
      ORDER BY impaye DESC NULLS LAST
      LIMIT ${limit + 1}
    `, params)

    const capped = resPoints.rows.length > limit
    const points = resPoints.rows.slice(0, limit)

    // Stats agrégées sur la totalité du filtre (sans bbox pour la carte stats)
    const conditionsStats = conditions.filter(c => !c.includes('lat BETWEEN') && !c.includes('lng BETWEEN'))
    const paramsStats = hasBbox ? params.slice(4) : params
    const whereStats = conditionsStats.length ? `WHERE ${conditionsStats.join(' AND ')}` : ''

    const resStats = await client.query(`
      SELECT
        COUNT(*)::int                                           AS nb_total,
        COUNT(*) FILTER (WHERE lat IS NOT NULL)::int           AS nb_geo,
        COALESCE(SUM(chiffre_affaire),0)::float8               AS ca_total,
        COALESCE(SUM(montant_regle),0)::float8                 AS enc_total,
        COALESCE(SUM(impaye),0)::float8                        AS imp_total,
        ROUND(
          COALESCE(SUM(montant_regle),0)::numeric
          / NULLIF(SUM(chiffre_affaire),0) * 100, 1
        )::float8                                              AS taux_moy
      FROM mv_recouvrement_geo
      ${whereStats}
    `, paramsStats)

    const stats = resStats.rows[0] ?? {}

    return NextResponse.json({
      points,
      count:  points.length,
      capped,
      stats: {
        nb_total:  Number(stats.nb_total  ?? 0),
        nb_geo:    Number(stats.nb_geo    ?? 0),
        ca_total:  Number(stats.ca_total  ?? 0),
        enc_total: Number(stats.enc_total ?? 0),
        imp_total: Number(stats.imp_total ?? 0),
        taux_moy:  Number(stats.taux_moy  ?? 0),
      },
      source: 'sen_ods · mv_recouvrement_geo',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/facturation/geo]', msg)

    // Fallback si la MV n'existe pas encore
    if (msg.includes('mv_recouvrement_geo') && msg.includes('does not exist')) {
      return NextResponse.json({
        error: 'mv_recouvrement_geo non créée — exécuter sql/mv_recouvrement_geo.sql',
        hint:  'Voir sql/mv_recouvrement_geo.sql pour les instructions',
        points: [], count: 0, capped: false,
        stats: { nb_total: 0, nb_geo: 0, ca_total: 0, enc_total: 0, imp_total: 0, taux_moy: 0 },
      }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    client.release()
  }
}
