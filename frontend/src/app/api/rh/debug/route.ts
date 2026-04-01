/**
 * GET /api/rh/debug
 * Diagnostic : identifier pourquoi l'effectif = 0
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbDwh'

async function safe(client: import('pg').PoolClient, sql: string) {
  try { return (await client.query(sql)).rows }
  catch (e) { return [{ error: String(e) }] }
}

export async function GET() {
  const client = await pool.connect()
  try {
    const [
      colonnesPersonnel,
      colonnesDtm,
      dateSortieVals,
      typeContratVals,
      sexeVals,
      joinCount,
      effSansFiltre,
    ] = await Promise.all([
      /* 1. Colonnes de dim_personnel */
      safe(client, `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'dwh_rh' AND table_name = 'dim_personnel'
        ORDER BY ordinal_position
      `),

      /* 2. Colonnes de dtm_drht_collaborateur */
      safe(client, `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'dwh_rh' AND table_name = 'dtm_drht_collaborateur'
        ORDER BY ordinal_position
      `),

      /* 3. Top 5 valeurs de date_sortie */
      safe(client, `
        SELECT date_sortie::text AS val, COUNT(*)::int AS n
        FROM dwh_rh.dim_personnel
        GROUP BY date_sortie ORDER BY n DESC LIMIT 5
      `),

      /* 4. Top 5 valeurs de type_contrat */
      safe(client, `
        SELECT type_contrat AS val, COUNT(*)::int AS n
        FROM dwh_rh.dim_personnel
        GROUP BY type_contrat ORDER BY n DESC LIMIT 5
      `),

      /* 5. Top 5 valeurs de sexe */
      safe(client, `
        SELECT sexe AS val, COUNT(*)::int AS n
        FROM dwh_rh.dim_personnel
        GROUP BY sexe ORDER BY n DESC LIMIT 5
      `),

      /* 6. Nb matricules qui matchent entre les 2 tables */
      safe(client, `
        SELECT COUNT(DISTINCT d.matricule)::int AS join_match
        FROM dwh_rh.dtm_drht_collaborateur d
        JOIN dwh_rh.dim_personnel p ON d.matricule = p.matricule
      `),

      /* 7. Effectif sans AUCUN filtre (juste le JOIN) */
      safe(client, `
        SELECT COUNT(DISTINCT d.matricule)::int AS nb_sans_filtre
        FROM dwh_rh.dtm_drht_collaborateur d
        JOIN dwh_rh.dim_personnel p ON d.matricule = p.matricule
      `),
    ])

    return NextResponse.json({
      colonnes_dim_personnel:   colonnesPersonnel,
      colonnes_dtm_collaborateur: colonnesDtm,
      date_sortie_top5:         dateSortieVals,
      type_contrat_top5:        typeContratVals,
      sexe_top5:                sexeVals,
      join_matricule_match:     joinCount[0],
      effectif_sans_filtre:     effSansFiltre[0],
    })
  } finally {
    client.release()
  }
}
