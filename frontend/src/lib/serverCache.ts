/**
 * Cache serveur — Redis (principal) + Mémoire (fallback)
 *
 * Ordre de lecture :
 *   1. Mémoire  (ultra-rapide, process local)
 *   2. Redis    (partagé, persiste aux redémarrages)
 *   3. DB       (source de vérité)
 *
 * Si Redis n'est pas disponible → fallback silencieux sur la mémoire.
 * Le serveur continue de fonctionner sans Redis.
 */
import Redis from 'ioredis'

/* ═══════════════════════════ CONNEXION REDIS ════════════════════════════════ */

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout:       2000,
      lazyConnect:          true,
      enableOfflineQueue:   false,
    })
    redis.on('error', () => { /* silencieux — fallback mémoire */ })
    return redis
  } catch {
    return null
  }
}

/* ═══════════════════════════ CACHE MÉMOIRE (fallback) ══════════════════════ */

interface MemEntry { data: unknown; exp: number }
const MEM = new Map<string, MemEntry>()

/* ════════════════════════════ TTLs EXPORTÉS ═════════════════════════════════ */

export const TTL_5M  =  5 * 60 * 1000
export const TTL_1H  = 60 * 60 * 1000
export const TTL_24H = 24 * 60 * 60 * 1000

/* ════════════════════════════ withCache ═════════════════════════════════════ */

/**
 * Retourne la valeur en cache si fraîche, sinon exécute `fn`,
 * met en cache le résultat et le retourne.
 *
 * Ordre : mémoire → Redis → DB (fn)
 */
export async function withCache<T>(
  key:   string,
  fn:    () => Promise<T>,
  ttlMs: number = TTL_1H,
): Promise<T> {
  const now    = Date.now()
  const ttlSec = Math.floor(ttlMs / 1000)

  /* ── 1. Mémoire ── */
  const memHit = MEM.get(key)
  if (memHit && now < memHit.exp) return memHit.data as T

  /* ── 2. Redis ── */
  const r = getRedis()
  if (r) {
    try {
      const raw = await r.get(key)
      if (raw) {
        const data = JSON.parse(raw) as T
        /* Repeupler la mémoire depuis Redis */
        MEM.set(key, { data, exp: now + ttlMs })
        return data
      }
    } catch { /* Redis indisponible → continue vers DB */ }
  }

  /* ── 3. Source (DB) ── */
  const data = await fn()

  /* Stocker en mémoire */
  MEM.set(key, { data, exp: now + ttlMs })

  /* Stocker dans Redis (si disponible) */
  if (r) {
    try {
      await r.set(key, JSON.stringify(data), 'EX', ttlSec)
    } catch { /* silencieux */ }
  }

  return data
}

/* ════════════════════════════ clearCache ════════════════════════════════════ */

/** Accès direct au client Redis (pour usages hors withCache). */
export { getRedis as getRedisClient }

/** Vide le cache mémoire + Redis (tout ou par préfixe). */
export async function clearCache(prefix?: string): Promise<number> {
  let n = 0

  /* Mémoire */
  if (!prefix) {
    n = MEM.size
    MEM.clear()
  } else {
    Array.from(MEM.keys()).forEach(k => {
      if (k.startsWith(prefix)) { MEM.delete(k); n++ }
    })
  }

  /* Redis */
  const r = getRedis()
  if (r) {
    try {
      const pattern = prefix ? `${prefix}*` : '*'
      const keys    = await r.keys(pattern)
      if (keys.length > 0) {
        await r.del(...keys)
        n += keys.length
      }
    } catch { /* silencieux */ }
  }

  return n
}

/* ════════════════════════════ cacheStats ════════════════════════════════════ */

/** Statistiques du cache (mémoire + Redis). */
export async function cacheStats() {
  const now     = Date.now()
  const memKeys = Array.from(MEM.entries())
    .filter(([, v]) => v.exp > now)
    .map(([k, v]) => ({ key: k, ttlSec: Math.round((v.exp - now) / 1000), source: 'mem' as const }))

  let redisKeys: { key: string; ttlSec: number; source: 'redis' }[] = []
  const r = getRedis()
  if (r) {
    try {
      const keys = await r.keys('*')
      const ttls = await Promise.all(keys.map(k => r.ttl(k)))
      redisKeys  = keys.map((k, i) => ({ key: k, ttlSec: ttls[i], source: 'redis' as const }))
    } catch { /* silencieux */ }
  }

  return {
    size:      memKeys.length + redisKeys.length,
    redis_ok:  r !== null,
    entries:   [...memKeys, ...redisKeys],
  }
}
