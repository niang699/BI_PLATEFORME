/**
 * Cache serveur TTL — hybride mémoire + fichier disque
 *
 * Mémoire  : ultra-rapide, perdu au redémarrage
 * Disque   : persiste entre les redémarrages (JSON dans .cache/)
 *
 * Ordre de lecture : mémoire → disque → DB
 * Les données sen_ods/sen_dwh sont mises à jour 1x/jour max.
 */
import fs   from 'fs'
import path from 'path'

interface Entry { data: unknown; exp: number }

/* ── Mémoire ── */
const MEM = new Map<string, Entry>()

/* ── Disque ── */
const CACHE_DIR = path.join(process.cwd(), '.cache')
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

function cacheFile(key: string): string {
  // sanitize key → nom de fichier valide
  return path.join(CACHE_DIR, key.replace(/[^a-z0-9_:.-]/gi, '_') + '.json')
}

function readDisk<T>(key: string): T | null {
  try {
    const file = cacheFile(key)
    if (!fs.existsSync(file)) return null
    const entry: Entry = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Date.now() >= entry.exp) { fs.unlinkSync(file); return null }
    return entry.data as T
  } catch { return null }
}

function writeDisk(key: string, entry: Entry): void {
  try { fs.writeFileSync(cacheFile(key), JSON.stringify(entry)) }
  catch { /* disque plein ou permission → silencieux */ }
}

/* ── TTLs ── */
export const TTL_1H  = 60 * 60 * 1000
export const TTL_24H = 24 * 60 * 60 * 1000

/**
 * Retourne la valeur en cache (mémoire puis disque) si fraîche,
 * sinon exécute `fn`, met en cache le résultat et le retourne.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = TTL_1H,
): Promise<T> {
  const now = Date.now()

  /* 1. Mémoire */
  const memHit = MEM.get(key)
  if (memHit && now < memHit.exp) return memHit.data as T

  /* 2. Disque */
  const diskHit = readDisk<T>(key)
  if (diskHit !== null) {
    // Repeupler la mémoire depuis le disque
    const diskEntry = JSON.parse(fs.readFileSync(cacheFile(key), 'utf8')) as Entry
    MEM.set(key, diskEntry)
    return diskHit
  }

  /* 3. Source (DB) */
  const data = await fn()
  const entry: Entry = { data, exp: now + ttlMs }
  MEM.set(key, entry)
  writeDisk(key, entry)
  return data
}

/** Vide tout le cache (mémoire + fichiers disque) ou par préfixe. */
export function clearCache(prefix?: string): number {
  let n = 0
  /* Mémoire */
  if (!prefix) { n = MEM.size; MEM.clear() }
  else {
    for (const k of MEM.keys()) if (k.startsWith(prefix)) { MEM.delete(k); n++ }
  }
  /* Disque */
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!prefix || f.startsWith(prefix.replace(/[^a-z0-9_:.-]/gi, '_'))) {
        fs.unlinkSync(path.join(CACHE_DIR, f)); n++
      }
    }
  } catch { /* ignore */ }
  return n
}

/** Statistiques du cache. */
export function cacheStats() {
  const now = Date.now()
  const entries: { key: string; ttlSec: number; source: 'mem' | 'disk' }[] = []
  for (const [k, v] of MEM) {
    if (v.exp > now) entries.push({ key: k, ttlSec: Math.round((v.exp - now) / 1000), source: 'mem' })
  }
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      const raw = fs.readFileSync(path.join(CACHE_DIR, f), 'utf8')
      const e: Entry = JSON.parse(raw)
      const key = f.replace('.json', '')
      if (e.exp > now && !entries.find(x => x.key.replace(/[^a-z0-9_:.-]/gi, '_') === key))
        entries.push({ key, ttlSec: Math.round((e.exp - now) / 1000), source: 'disk' })
    }
  } catch { /* ignore */ }
  return { size: entries.length, entries }
}
