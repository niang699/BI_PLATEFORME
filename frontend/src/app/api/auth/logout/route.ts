/**
 * POST /api/auth/logout
 * Révoque la session côté serveur, efface le cookie
 */
import { NextRequest, NextResponse } from 'next/server'
import { logoutUser, validateSession, COOKIE_NAME } from '@/lib/authServer'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (token) {
    // Récupère le user pour le log avant suppression
    const user = await validateSession(token)
    await logoutUser(token, user?.id)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    maxAge:   0,
    path:     '/',
  })
  return res
}
