/**
 * GET  /api/cache        — statistiques du cache serveur
 * DELETE /api/cache      — vide tout le cache
 * DELETE /api/cache?prefix=rapports  — vide seulement les rapports
 */
import { NextRequest, NextResponse } from 'next/server'
import { cacheStats, clearCache } from '@/lib/serverCache'

export async function GET() {
  return NextResponse.json(cacheStats())
}

export async function DELETE(req: NextRequest) {
  const prefix = req.nextUrl.searchParams.get('prefix') ?? undefined
  const n = clearCache(prefix)
  return NextResponse.json({
    cleared: n,
    message: prefix ? `Cache "${prefix}*" vidé (${n} entrées)` : `Cache complet vidé (${n} entrées)`,
  })
}
