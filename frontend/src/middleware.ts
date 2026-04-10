/**
 * middleware.ts — Protection serveur des routes privées
 * Exécuté avant chaque requête sur /dashboard/* et /viewer/*
 * Redirige vers /login si le cookie de session est absent
 *
 * Note : le middleware Next.js tourne sur Edge Runtime (pas de pg).
 * Il vérifie uniquement la présence du cookie — la validation DB
 * complète est faite dans /api/auth/me (appelé par dashboard/layout.tsx).
 */
import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME     = 'portail_sid'
const PROTECTED_PATHS = ['/dashboard', '/viewer']
const PUBLIC_PATHS    = ['/login', '/api/auth/login']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Routes publiques → toujours laisser passer
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Routes protégées → vérifier cookie
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || token.length !== 96) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/viewer/:path*'],
}
