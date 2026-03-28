import { NextResponse } from 'next/server'
import pool from '@/lib/dbOds'

export async function GET() {
  const client = await pool.connect().catch(() => null)
  if (!client) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 })
  try {
    const r = await client.query(`SELECT * FROM public.mv_recouvrement LIMIT 1`)
    return NextResponse.json(r.rows)
  } finally { client.release() }
}
