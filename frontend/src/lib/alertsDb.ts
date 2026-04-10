/**
 * Couche d'accès aux données — table platform_alerts (sen_dwh)
 * Auto-création au premier appel.
 */
import pool from '@/lib/dbDwh'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface PlatformAlert {
  id:         number
  rule_id:    string        // identifiant de la règle (ex: 'taux_recouv_dr')
  severity:   AlertSeverity
  title:      string
  message:    string
  dr:         string | null // DR concernée (null = global)
  value:      number | null // valeur mesurée
  threshold:  number | null // seuil déclenché
  report_id:  string | null // lien vers un rapport
  read:       boolean
  created_at: string
}

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS public.platform_alerts (
    id          SERIAL PRIMARY KEY,
    rule_id     VARCHAR(80)  NOT NULL,
    severity    VARCHAR(20)  NOT NULL,
    title       VARCHAR(300) NOT NULL,
    message     TEXT         NOT NULL,
    dr          VARCHAR(200),
    value       FLOAT8,
    threshold   FLOAT8,
    report_id   VARCHAR(80),
    read        BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
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

function toAlert(row: Record<string, unknown>): PlatformAlert {
  return {
    id:         row.id as number,
    rule_id:    row.rule_id as string,
    severity:   row.severity as AlertSeverity,
    title:      row.title as string,
    message:    row.message as string,
    dr:         row.dr as string | null,
    value:      row.value != null ? Number(row.value) : null,
    threshold:  row.threshold != null ? Number(row.threshold) : null,
    report_id:  row.report_id as string | null,
    read:       Boolean(row.read),
    created_at: String(row.created_at),
  }
}

/** Récupère les alertes, les plus récentes en premier (max 200) */
export async function listAlerts(onlyUnread = false): Promise<PlatformAlert[]> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const where = onlyUnread ? 'WHERE read = false' : ''
    const r = await client.query(
      `SELECT * FROM public.platform_alerts ${where} ORDER BY created_at DESC LIMIT 200`
    )
    return r.rows.map(toAlert)
  } finally {
    client.release()
  }
}

/** Nombre d'alertes non lues */
export async function countUnread(): Promise<number> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT COUNT(*)::int AS n FROM public.platform_alerts WHERE read = false`
    )
    return r.rows[0]?.n ?? 0
  } finally {
    client.release()
  }
}

/** Marque une ou toutes les alertes comme lues */
export async function markRead(id: number | 'all'): Promise<void> {
  await ensureTable()
  const client = await pool.connect()
  try {
    if (id === 'all') {
      await client.query(`UPDATE public.platform_alerts SET read = true`)
    } else {
      await client.query(`UPDATE public.platform_alerts SET read = true WHERE id = $1`, [id])
    }
  } finally {
    client.release()
  }
}

/**
 * Insère une alerte seulement si aucune alerte non lue identique (même rule_id + dr)
 * n'a été créée dans les dernières 24h — évite le spam.
 */
export async function upsertAlert(
  data: Omit<PlatformAlert, 'id' | 'read' | 'created_at'>
): Promise<void> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const existing = await client.query(`
      SELECT id FROM public.platform_alerts
      WHERE rule_id = $1
        AND ($2::varchar IS NULL OR dr = $2)
        AND read = false
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `, [data.rule_id, data.dr])

    if (existing.rows.length > 0) return // déjà signalé récemment

    await client.query(`
      INSERT INTO public.platform_alerts (rule_id, severity, title, message, dr, value, threshold, report_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [data.rule_id, data.severity, data.title, data.message,
        data.dr, data.value, data.threshold, data.report_id])
  } finally {
    client.release()
  }
}

/** Purge les alertes lues de plus de 30 jours */
export async function purgeOldAlerts(): Promise<void> {
  await ensureTable()
  const client = await pool.connect()
  try {
    await client.query(
      `DELETE FROM public.platform_alerts WHERE read = true AND created_at < NOW() - INTERVAL '30 days'`
    )
  } finally {
    client.release()
  }
}
