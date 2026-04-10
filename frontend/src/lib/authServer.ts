/**
 * authServer.ts — Logique d'authentification côté serveur
 *
 * Améliorations v2 :
 *  - Cache Redis des sessions (TTL 5 min) → plus de DB hit à chaque page
 *  - Protection brute-force intégrée (via bruteForce.ts)
 *  - Révocation immédiate du cache lors du logout
 */
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { type PoolClient } from 'pg'
import pool from './dbPortail'
import type { User, Role } from './types'
import { getRedisClient } from './serverCache'
import {
  checkBruteForce,
  recordFailedAttempt,
  recordSuccessfulLogin,
} from './bruteForce'

export type { User }
export const COOKIE_NAME      = 'portail_sid'
export const SESSION_TTL      = 8 * 60 * 60    // 8h en secondes
const SESSION_CACHE_TTL       = 5 * 60          // Cache Redis : 5 min
const sessionCacheKey = (t: string) => `session:${t}`

/* ── Types ────────────────────────────────────────────────────────────────── */
export interface DbUser {
  id:         number
  nom:        string
  prenom:     string
  email:      string
  role:       string
  dt:         string | null
  is_active:  boolean
  last_login: Date | null
}

export type SessionUser = User

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function makeToken(): string {
  return randomBytes(48).toString('hex')  // 96 chars hex
}

function makeAvatar(prenom: string, nom: string): string {
  return (prenom[0] + nom[0]).toUpperCase()
}

function toSessionUser(u: DbUser): SessionUser {
  return {
    id:     String(u.id),
    name:   `${u.prenom} ${u.nom}`,
    email:  u.email,
    role:   u.role as Role,
    avatar: makeAvatar(u.prenom, u.nom),
    ...(u.dt ? { dt: u.dt } : {}),
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   loginUser
══════════════════════════════════════════════════════════════════════════ */
export async function loginUser(
  email:      string,
  password:   string,
  ipAddress?: string,
  userAgent?: string,
): Promise<
  | { ok: true;  token: string; user: SessionUser }
  | { ok: false; reason: 'invalid_credentials' | 'account_locked' | 'account_disabled'; unlocksAt?: Date }
> {
  const normalizedEmail = email.toLowerCase().trim()

  /* ── 1. Vérification brute-force ── */
  const bf = await checkBruteForce(normalizedEmail)
  if (bf.blocked) {
    return { ok: false, reason: 'account_locked', unlocksAt: bf.unlocksAt }
  }

  const client = await pool.connect()
  try {
    /* ── 2. Charger l'utilisateur ── */
    const res = await client.query<DbUser & { password_hash: string }>(
      `SELECT id, nom, prenom, email, password_hash, role, dt, is_active, last_login
       FROM portail_users
       WHERE email = $1`,
      [normalizedEmail],
    )
    const row = res.rows[0]

    /* ── 3. Vérifier mot de passe ── */
    const valid = row && (await bcrypt.compare(password, row.password_hash))
    if (!valid) {
      await logAccess(client, row?.id ?? null, normalizedEmail, 'login_failed', ipAddress)
      const bf2 = await recordFailedAttempt(normalizedEmail)
      if (bf2.locked) {
        return { ok: false, reason: 'account_locked', unlocksAt: bf2.unlocksAt }
      }
      return { ok: false, reason: 'invalid_credentials' }
    }

    if (!row.is_active) {
      await logAccess(client, row.id, normalizedEmail, 'login_failed', ipAddress, 'compte désactivé')
      return { ok: false, reason: 'account_disabled' }
    }

    /* ── 4. Créer la session DB ── */
    const token     = makeToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL * 1000)

    await client.query(
      `INSERT INTO portail_sessions (token, user_id, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, row.id, expiresAt, ipAddress ?? null, userAgent ?? null],
    )

    /* ── 5. Mettre à jour last_login ── */
    await client.query(
      `UPDATE portail_users SET last_login = NOW() WHERE id = $1`,
      [row.id],
    )

    /* ── 6. Reset compteur brute-force ── */
    await recordSuccessfulLogin(normalizedEmail)

    /* ── 7. Cache Redis de la session ── */
    const sessionUser = toSessionUser(row)
    const r = getRedisClient()
    if (r) {
      try {
        await r.set(
          sessionCacheKey(token),
          JSON.stringify(sessionUser),
          'EX', SESSION_CACHE_TTL,
        )
      } catch { /* silencieux */ }
    }

    /* ── 8. Log ── */
    await logAccess(client, row.id, normalizedEmail, 'login', ipAddress)

    return { ok: true, token, user: sessionUser }
  } finally {
    client.release()
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   validateSession  — Cache Redis → DB (fallback)
══════════════════════════════════════════════════════════════════════════ */
export async function validateSession(token: string): Promise<SessionUser | null> {
  if (!token || token.length !== 96) return null

  const cacheKey = sessionCacheKey(token)
  const r        = getRedisClient()

  /* ── 1. Cache Redis (hit ~99% des cas après login) ── */
  if (r) {
    try {
      const cached = await r.get(cacheKey)
      if (cached) {
        // Renouveler le TTL sans toucher la DB
        await r.expire(cacheKey, SESSION_CACHE_TTL)
        return JSON.parse(cached) as SessionUser
      }
    } catch { /* Redis down → fallback DB */ }
  }

  /* ── 2. DB (premier accès ou cache expiré) ── */
  const client = await pool.connect()
  try {
    const res = await client.query<DbUser>(
      `SELECT u.id, u.nom, u.prenom, u.email, u.role, u.dt, u.is_active, u.last_login
       FROM portail_sessions s
       JOIN portail_users u ON u.id = s.user_id
       WHERE s.token = $1
         AND s.expires_at > NOW()
         AND u.is_active = true`,
      [token],
    )

    if (!res.rows[0]) return null
    const user = toSessionUser(res.rows[0])

    /* Repeupler le cache Redis */
    if (r) {
      try {
        await r.set(cacheKey, JSON.stringify(user), 'EX', SESSION_CACHE_TTL)
      } catch { /* silencieux */ }
    }

    return user
  } finally {
    client.release()
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   logoutUser — Révoque session DB + cache Redis
══════════════════════════════════════════════════════════════════════════ */
export async function logoutUser(token: string, userId?: string): Promise<void> {
  if (!token) return

  /* ── Supprimer du cache Redis immédiatement ── */
  const r = getRedisClient()
  if (r) {
    try { await r.del(sessionCacheKey(token)) } catch { /* silencieux */ }
  }

  const client = await pool.connect()
  try {
    await client.query(`DELETE FROM portail_sessions WHERE token = $1`, [token])
    if (userId) {
      const u = await client.query(
        `SELECT email FROM portail_users WHERE id = $1`, [userId],
      )
      if (u.rows[0]) {
        await logAccess(client, Number(userId), u.rows[0].email, 'logout')
      }
    }
  } finally {
    client.release()
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Utilitaires
══════════════════════════════════════════════════════════════════════════ */
export async function purgeExpiredSessions(): Promise<number> {
  const client = await pool.connect()
  try {
    const res = await client.query(`DELETE FROM portail_sessions WHERE expires_at < NOW()`)
    return res.rowCount ?? 0
  } finally {
    client.release()
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

async function logAccess(
  client:     PoolClient,
  userId:     number | null,
  email:      string,
  action:     string,
  ipAddress?: string,
  detail?:    string,
) {
  try {
    await client.query(
      `INSERT INTO portail_access_logs (user_id, email, action, ip_address, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, email, action, ipAddress ?? null, detail ?? null],
    )
  } catch { /* Log non bloquant */ }
}
