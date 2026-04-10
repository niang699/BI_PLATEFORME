/**
 * Persistance de l'historique des scores Data Quality
 * Table auto-créée : public.dq_scores_history (sen_dwh)
 */
import pool from '@/lib/dbDwh'

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS public.dq_scores_history (
    id           SERIAL PRIMARY KEY,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    score_global NUMERIC(5,1) NOT NULL,
    completude   NUMERIC(5,1),
    exactitude   NUMERIC(5,1),
    coherence    NUMERIC(5,1),
    fraicheur    NUMERIC(5,1),
    unicite      NUMERIC(5,1),
    conformite   NUMERIC(5,1)
  )
`

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  const client = await pool.connect()
  try {
    await client.query(CREATE_TABLE)
    tableReady = true
  } finally {
    client.release()
  }
}

export interface DqSnapshot {
  score_global: number
  completude:   number
  exactitude:   number
  coherence:    number
  fraicheur:    number
  unicite:      number
  conformite:   number
}

export interface DqHistoryRow {
  date:         string   // YYYY-MM-DD
  score_global: number
  completude:   number
  exactitude:   number
  coherence:    number
  fraicheur:    number
  unicite:      number
  conformite:   number
}

/** Persiste un snapshot — fire-and-forget, n'échoue jamais */
export async function saveSnapshot(snap: DqSnapshot): Promise<void> {
  try {
    await ensureTable()
    const client = await pool.connect()
    try {
      await client.query(`
        INSERT INTO public.dq_scores_history
          (score_global, completude, exactitude, coherence, fraicheur, unicite, conformite)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [snap.score_global, snap.completude, snap.exactitude,
          snap.coherence,    snap.fraicheur,  snap.unicite, snap.conformite])
    } finally {
      client.release()
    }
  } catch {
    // Silencieux — l'historique ne doit pas casser le calcul principal
  }
}

/** Retourne un point par jour (moyenne si plusieurs calculs/jour) */
export async function getHistory(days: 7 | 30 | 90): Promise<DqHistoryRow[]> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const { rows } = await client.query<DqHistoryRow>(`
      SELECT
        TO_CHAR(recorded_at AT TIME ZONE 'Africa/Dakar', 'YYYY-MM-DD') AS date,
        ROUND(AVG(score_global)::numeric, 1) AS score_global,
        ROUND(AVG(completude)::numeric,   1) AS completude,
        ROUND(AVG(exactitude)::numeric,   1) AS exactitude,
        ROUND(AVG(coherence)::numeric,    1) AS coherence,
        ROUND(AVG(fraicheur)::numeric,    1) AS fraicheur,
        ROUND(AVG(unicite)::numeric,      1) AS unicite,
        ROUND(AVG(conformite)::numeric,   1) AS conformite
      FROM public.dq_scores_history
      WHERE recorded_at >= NOW() - INTERVAL '${days} days'
      GROUP BY 1
      ORDER BY 1 ASC
    `)
    return rows
  } finally {
    client.release()
  }
}
