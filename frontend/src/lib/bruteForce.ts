/**
 * bruteForce.ts — Protection contre les attaques par force brute
 *
 * Stratégie :
 *  - Redis (principal) : compteurs atomiques ultra-rapides
 *  - DB Portail_DATA   : fallback si Redis indisponible
 *
 * Règles :
 *  - MAX_ATTEMPTS = 5 tentatives échouées dans une fenêtre de 15 min
 *  - LOCKOUT      = blocage 15 min après dépassement
 *  - Reset        = automatique à la prochaine connexion réussie
 */
import pool from './dbPortail'
import { getRedisClient } from './serverCache'

const MAX_ATTEMPTS     = 5
const WINDOW_SECONDS   = 15 * 60   // fenêtre de comptage : 15 min
const LOCKOUT_SECONDS  = 15 * 60   // durée de blocage   : 15 min

const keyAttempts = (email: string) => `bf:attempts:${email.toLowerCase()}`
const keyLocked   = (email: string) => `bf:locked:${email.toLowerCase()}`

/* ── Types ────────────────────────────────────────────────────────────────── */
export interface BruteForceStatus {
  blocked:           boolean
  remainingAttempts: number
  unlocksAt?:        Date
}

/* ══════════════════════════════════════════════════════════════════════════
   checkBruteForce — à appeler AVANT de vérifier le mot de passe
══════════════════════════════════════════════════════════════════════════ */
export async function checkBruteForce(email: string): Promise<BruteForceStatus> {
  const r = getRedisClient()

  /* ── Redis ── */
  if (r) {
    try {
      const locked = await r.get(keyLocked(email))
      if (locked) {
        const ttl = await r.ttl(keyLocked(email))
        return {
          blocked:           true,
          remainingAttempts: 0,
          unlocksAt:         new Date(Date.now() + Math.max(ttl, 0) * 1000),
        }
      }
      const raw      = await r.get(keyAttempts(email))
      const attempts = parseInt(raw ?? '0', 10)
      return { blocked: false, remainingAttempts: MAX_ATTEMPTS - attempts }
    } catch { /* Redis down → fallback DB */ }
  }

  /* ── Fallback DB ── */
  const client = await pool.connect()
  try {
    const res = await client.query<{
      failed_attempts: number; locked_until: Date | null
    }>(
      `SELECT failed_attempts, locked_until
       FROM portail_users WHERE email = $1`,
      [email.toLowerCase()],
    )
    const row = res.rows[0]
    if (!row) return { blocked: false, remainingAttempts: MAX_ATTEMPTS }

    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return { blocked: true, remainingAttempts: 0, unlocksAt: new Date(row.locked_until) }
    }
    const attempts = row.failed_attempts ?? 0
    return { blocked: false, remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempts) }
  } finally {
    client.release()
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   recordFailedAttempt — à appeler après un échec de mot de passe
══════════════════════════════════════════════════════════════════════════ */
export async function recordFailedAttempt(email: string): Promise<{
  attempts: number
  locked:   boolean
  unlocksAt?: Date
}> {
  const r = getRedisClient()

  /* ── Redis ── */
  if (r) {
    try {
      const attempts = await r.incr(keyAttempts(email))

      // Initialiser la fenêtre au premier échec
      if (attempts === 1) await r.expire(keyAttempts(email), WINDOW_SECONDS)

      if (attempts >= MAX_ATTEMPTS) {
        // Verrouiller le compte
        await r.set(keyLocked(email), '1', 'EX', LOCKOUT_SECONDS)
        await r.del(keyAttempts(email))
        const unlocksAt = new Date(Date.now() + LOCKOUT_SECONDS * 1000)
        return { attempts, locked: true, unlocksAt }
      }

      return { attempts, locked: false }
    } catch { /* Redis down → fallback DB */ }
  }

  /* ── Fallback DB ── */
  const client = await pool.connect()
  try {
    const res = await client.query<{
      failed_attempts: number; locked_until: Date | null
    }>(
      `UPDATE portail_users
       SET
         failed_attempts = COALESCE(failed_attempts, 0) + 1,
         locked_until = CASE
           WHEN COALESCE(failed_attempts, 0) + 1 >= $2
           THEN NOW() + ($3 || ' seconds')::INTERVAL
           ELSE locked_until
         END
       WHERE email = $1
       RETURNING failed_attempts, locked_until`,
      [email.toLowerCase(), MAX_ATTEMPTS, LOCKOUT_SECONDS],
    )
    const row     = res.rows[0]
    const locked  = !!row?.locked_until && new Date(row.locked_until) > new Date()
    return {
      attempts:  row?.failed_attempts ?? 1,
      locked,
      ...(locked ? { unlocksAt: new Date(row!.locked_until!) } : {}),
    }
  } finally {
    client.release()
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   recordSuccessfulLogin — à appeler après une connexion réussie
══════════════════════════════════════════════════════════════════════════ */
export async function recordSuccessfulLogin(email: string): Promise<void> {
  const r = getRedisClient()

  /* ── Redis ── */
  if (r) {
    try {
      await r.del(keyAttempts(email), keyLocked(email))
    } catch { /* silencieux */ }
  }

  /* ── DB (reset fallback) ── */
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE portail_users
       SET failed_attempts = 0, locked_until = NULL
       WHERE email = $1`,
      [email.toLowerCase()],
    )
  } catch { /* silencieux */ } finally {
    client.release()
  }
}
