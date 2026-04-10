/**
 * Couche d'accès aux données — table scheduled_reports (sen_dwh)
 * Auto-création de la table au premier appel.
 */
import pool from '@/lib/dbDwh'

export type ReportFrequence = 'daily' | 'weekly' | 'monthly'
export type ReportFormat    = 'xlsx' | 'html' | 'pdf'
export type ReportId        = 'recouvrement' | 'facturation' | 'rh'

export interface ScheduledReport {
  id:              number
  name:            string
  rapport_id:      ReportId
  filtres:         Record<string, string>
  format:          ReportFormat
  frequence:       ReportFrequence
  cron_expr:       string
  destinataires:   string[]
  sujet:           string
  actif:           boolean
  derniere_exec:   string | null
  dernier_statut:  'ok' | 'error' | null
  created_by:      string
  created_at:      string
}

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS public.scheduled_reports (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    rapport_id      VARCHAR(50)  NOT NULL,
    filtres         JSONB        NOT NULL DEFAULT '{}',
    format          VARCHAR(10)  NOT NULL DEFAULT 'xlsx',
    frequence       VARCHAR(20)  NOT NULL DEFAULT 'monthly',
    cron_expr       VARCHAR(50)  NOT NULL,
    destinataires   TEXT[]       NOT NULL DEFAULT '{}',
    sujet           VARCHAR(300) NOT NULL,
    actif           BOOLEAN      NOT NULL DEFAULT true,
    derniere_exec   TIMESTAMPTZ,
    dernier_statut  VARCHAR(10),
    created_by      VARCHAR(100) NOT NULL DEFAULT 'admin',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
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

export async function listPlans(): Promise<ScheduledReport[]> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT * FROM public.scheduled_reports ORDER BY created_at DESC`
    )
    return r.rows.map(toScheduledReport)
  } finally {
    client.release()
  }
}

export async function getPlan(id: number): Promise<ScheduledReport | null> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT * FROM public.scheduled_reports WHERE id = $1`, [id]
    )
    return r.rows[0] ? toScheduledReport(r.rows[0]) : null
  } finally {
    client.release()
  }
}

export async function createPlan(data: Omit<ScheduledReport, 'id' | 'created_at' | 'derniere_exec' | 'dernier_statut'>): Promise<ScheduledReport> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const r = await client.query(`
      INSERT INTO public.scheduled_reports
        (name, rapport_id, filtres, format, frequence, cron_expr, destinataires, sujet, actif, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      data.name, data.rapport_id, JSON.stringify(data.filtres),
      data.format, data.frequence, data.cron_expr,
      data.destinataires, data.sujet, data.actif, data.created_by,
    ])
    return toScheduledReport(r.rows[0])
  } finally {
    client.release()
  }
}

export async function updatePlan(id: number, data: Partial<Omit<ScheduledReport, 'id' | 'created_at'>>): Promise<ScheduledReport | null> {
  await ensureTable()
  const fields: string[] = []
  const values: unknown[] = []
  let i = 1

  const map: Record<string, string> = {
    name: 'name', rapport_id: 'rapport_id', filtres: 'filtres',
    format: 'format', frequence: 'frequence', cron_expr: 'cron_expr',
    destinataires: 'destinataires', sujet: 'sujet', actif: 'actif',
    derniere_exec: 'derniere_exec', dernier_statut: 'dernier_statut',
  }

  for (const [key, col] of Object.entries(map)) {
    if (key in data) {
      const val = (data as Record<string, unknown>)[key]
      fields.push(`${col} = $${i++}`)
      values.push(key === 'filtres' ? JSON.stringify(val) : val)
    }
  }

  if (!fields.length) return getPlan(id)
  values.push(id)

  const client = await pool.connect()
  try {
    const r = await client.query(
      `UPDATE public.scheduled_reports SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    return r.rows[0] ? toScheduledReport(r.rows[0]) : null
  } finally {
    client.release()
  }
}

export async function deletePlan(id: number): Promise<boolean> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const r = await client.query(
      `DELETE FROM public.scheduled_reports WHERE id = $1`, [id]
    )
    return (r.rowCount ?? 0) > 0
  } finally {
    client.release()
  }
}

export async function getActivePlans(): Promise<ScheduledReport[]> {
  await ensureTable()
  const client = await pool.connect()
  try {
    const r = await client.query(
      `SELECT * FROM public.scheduled_reports WHERE actif = true ORDER BY id`
    )
    return r.rows.map(toScheduledReport)
  } finally {
    client.release()
  }
}

function toScheduledReport(row: Record<string, unknown>): ScheduledReport {
  return {
    id:             row.id as number,
    name:           row.name as string,
    rapport_id:     row.rapport_id as ReportId,
    filtres:        (row.filtres as Record<string, string>) ?? {},
    format:         row.format as ReportFormat,
    frequence:      row.frequence as ReportFrequence,
    cron_expr:      row.cron_expr as string,
    destinataires:  (row.destinataires as string[]) ?? [],
    sujet:          row.sujet as string,
    actif:          row.actif as boolean,
    derniere_exec:  row.derniere_exec ? String(row.derniere_exec) : null,
    dernier_statut: (row.dernier_statut as 'ok' | 'error' | null) ?? null,
    created_by:     row.created_by as string,
    created_at:     String(row.created_at),
  }
}
