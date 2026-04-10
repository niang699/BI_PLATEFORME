/**
 * GET /api/auth/me
 * Valide le cookie de session et retourne l'utilisateur courant
 */
import { NextRequest, NextResponse } from 'next/server'
import { validateSession, COOKIE_NAME } from '@/lib/authServer'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const user = await validateSession(token)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({ user })
}
