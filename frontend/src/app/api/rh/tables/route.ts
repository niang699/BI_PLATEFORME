/**
 * GET /api/rh/tables — diagnostic : liste les tables disponibles dans sen_dwh
 * À supprimer après identification des bons noms de tables
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbDwh'

export async function GET() {
  const client = await pool.connect().catch(e => { throw new Error('Connexion impossible: ' + e.message) })
  try {
    const res = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `)
    return NextResponse.json({ tables: res.rows })
  } finally {
    client.release()
  }
}
