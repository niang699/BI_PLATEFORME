/**
 * auth.ts — Client-side auth helpers
 * La session est désormais gérée via un cookie HttpOnly côté serveur.
 * Ce fichier expose uniquement des fonctions appelables depuis le navigateur.
 */
import type { SessionUser } from './authServer'

// Re-export du type pour compatibilité avec les composants existants
export type User = SessionUser

const SESSION_KEY = 'seneau_user_cache'   // cache mémoire local (non critique)

/* ── Login — appel API ────────────────────────────────────────────────────── */
export async function login(
  email: string,
  password: string,
): Promise<{ user: User } | { error: string; reason?: string } | null> {
  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Erreur.', reason: data.reason }
    if (typeof window !== 'undefined' && data.user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.user))
    }
    return { user: data.user }
  } catch {
    return { error: 'Erreur réseau. Vérifiez votre connexion.' }
  }
}

/* ── Logout — appel API ───────────────────────────────────────────────────── */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch { /* silencieux */ }
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

/* ── Utilisateur courant ──────────────────────────────────────────────────── */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  return raw ? JSON.parse(raw) : null
}

/**
 * Valide la session côté serveur et met à jour le cache local.
 * À appeler dans les layouts protégés.
 */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    if (!res.ok) {
      if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    const { user } = await res.json()
    if (typeof window !== 'undefined' && user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    }
    return user ?? null
  } catch {
    return null
  }
}
