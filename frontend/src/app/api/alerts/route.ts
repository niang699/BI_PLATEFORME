/**
 * GET  /api/alerts          — liste des alertes (réelles, depuis platform_alerts)
 * GET  /api/alerts?unread=1 — seulement non lues
 * GET  /api/alerts?count=1  — seulement le compteur non lues
 * PATCH /api/alerts         — { id: number | 'all' } marquer comme lu
 */
import { NextRequest, NextResponse } from 'next/server'
import { listAlerts, countUnread, markRead } from '@/lib/alertsDb'
import { withCache, TTL_1H } from '@/lib/serverCache'

export async function GET(req: NextRequest) {
  const unreadOnly = req.nextUrl.searchParams.get('unread') === '1'
  const countOnly  = req.nextUrl.searchParams.get('count')  === '1'

  try {
    if (countOnly) {
      // Pas de cache sur le compteur — doit être immédiat après markRead
      const n = await countUnread()
      return NextResponse.json({ unread: n })
    }

    const cacheKey = `platform_alerts:${unreadOnly ? 'unread' : 'all'}`
    const data = await withCache(cacheKey, () => listAlerts(unreadOnly), TTL_1H)
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/alerts GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number | 'all' }
    if (body.id === undefined) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    await markRead(body.id)
    const unread = await countUnread()
    return NextResponse.json({ ok: true, unread })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/alerts PATCH]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
