/**
 * POST /api/auth/login
 * Authentifie l'utilisateur, crée une session, pose un cookie HttpOnly.
 * Protection brute-force intégrée dans loginUser().
 */
import { NextRequest, NextResponse } from 'next/server'
import { loginUser, COOKIE_NAME, SESSION_TTL } from '@/lib/authServer'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 })
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   ?? req.headers.get('x-real-ip')
                   ?? 'unknown'
    const userAgent = req.headers.get('user-agent') ?? undefined

    const result = await loginUser(email, password, ipAddress, userAgent)

    /* ── Échec ── */
    if (!result.ok) {
      if (result.reason === 'account_locked') {
        const unlockMsg = result.unlocksAt
          ? ` Réessayez après ${result.unlocksAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`
          : ''
        return NextResponse.json(
          { error: `Compte temporairement bloqué après trop de tentatives.${unlockMsg}`, reason: 'locked' },
          { status: 429 },
        )
      }
      if (result.reason === 'account_disabled') {
        return NextResponse.json(
          { error: 'Ce compte a été désactivé. Contactez votre administrateur.' },
          { status: 403 },
        )
      }
      // invalid_credentials — message générique (ne pas révéler si l'email existe)
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect.' },
        { status: 401 },
      )
    }

    /* ── Succès ── */
    const res = NextResponse.json({ user: result.user })
    res.cookies.set(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   SESSION_TTL,
      path:     '/',
    })
    return res
  } catch (err) {
    console.error('[/api/auth/login]', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
