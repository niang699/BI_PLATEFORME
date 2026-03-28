/**
 * GET /api/carte/points
 * Points individuels dans la bbox visible — max 2 000 résultats
 * Source : API_CLIENT (sen_ods) — statut actif uniquement
 *
 * Params :
 *   minLat, maxLat, minLng, maxLng  — bounding box (requis)
 *   uo                              — filtre secteur (optionnel)
 *   profil                          — filtre profil type ILIKE (optionnel)
 *   limit                           — max points (défaut 2000, max 5000)
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const minLat = parseFloat(sp.get('minLat') ?? '')
  const maxLat = parseFloat(sp.get('maxLat') ?? '')
  const minLng = parseFloat(sp.get('minLng') ?? '')
  const maxLng = parseFloat(sp.get('maxLng') ?? '')

  if ([minLat, maxLat, minLng, maxLng].some(isNaN)) {
    return NextResponse.json(
      { error: 'bbox manquante (minLat, maxLat, minLng, maxLng)' },
      { status: 400 }
    )
  }

  const uo     = sp.get('uo')
  const profil = sp.get('profil')
  const limit  = Math.min(parseInt(sp.get('limit') ?? '2000', 10), 5000)

  const conditions: string[] = [
    `"STATUT" = 'actif'`,
    `"COORD_X" ~ '^-?[0-9]+[.,]?[0-9]*$'`,
    `"COORD_Y" ~ '^-?[0-9]+[.,]?[0-9]*$'`,
    `REPLACE("COORD_X",',','.')::float BETWEEN $1 AND $2`,
    `REPLACE("COORD_Y",',','.')::float BETWEEN $3 AND $4`,
  ]
  const params: (string | number)[] = [minLat, maxLat, minLng, maxLng]

  if (uo)     { params.push(uo);            conditions.push(`"UO"          = $${params.length}`) }
  if (profil) { params.push(`%${profil}%`); conditions.push(`"PROFIL_TYPE" ILIKE $${params.length}`) }

  params.push(limit + 1)
  const limitIdx = params.length

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 15000')

    const res = await client.query(`
      SELECT
        "ID_CLIENT"::text                                     AS id,
        "REFERENCE_CLIENT"                                    AS ref,
        "NOM_CLIENT"                                          AS nom,
        "PRENOM_CLIENT"                                       AS prenom,
        "PROFIL_TYPE"                                         AS profil,
        "UO"                                                  AS uo,
        "CODE_UO"                                             AS code_uo,
        "CODE_TOURNEE"                                        AS tournee,
        "ADRESSE_CLIENT"                                      AS adresse,
        "TELEPHONE_CLIENT"                                    AS telephone,
        "NUMERO_COMPTEUR"                                     AS compteur,
        "DIAMETRE_COMPTEUR"                                   AS diametre,
        REPLACE("COORD_X", ',', '.')::float                   AS lat,
        REPLACE("COORD_Y", ',', '.')::float                   AS lng
      FROM "API_CLIENT"
      WHERE ${conditions.join(' AND ')}
      LIMIT $${limitIdx}
    `, params)

    const capped = res.rows.length > limit
    const points = res.rows.slice(0, limit)

    return NextResponse.json({
      points,
      count:  points.length,
      capped,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/points]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    client.release()
  }
}
