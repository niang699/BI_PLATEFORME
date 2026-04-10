/**
 * GET /api/data-quality/history?days=7|30|90
 * Retourne l'évolution journalière des scores DQ
 */
import { NextRequest, NextResponse } from 'next/server'
import { getHistory } from '@/lib/dqHistory'

export async function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get('days')
  const days = raw === '30' ? 30 : raw === '90' ? 90 : 7

  try {
    const rows = await getHistory(days as 7 | 30 | 90)
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}
