/**
 * GET  /api/admin/access        — retourne la matrice d'accès courante (rapport × rôle)
 * PUT  /api/admin/access        — sauvegarde la matrice modifiée par le super_admin
 *
 * Format GET response:
 *   { access: Record<reportId, Role[]> }
 *
 * Format PUT body:
 *   { access: Record<reportId, Role[]> }
 *
 * Accès GET  : super_admin, admin_metier
 * Accès PUT  : super_admin uniquement
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbPortail'
import { validateSession, COOKIE_NAME } from '@/lib/authServer'
import type { Role } from '@/lib/types'

const VALID_ROLES: Role[] = ['super_admin', 'admin_metier', 'analyste', 'lecteur_dt', 'dt']

async function getAuthedUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return validateSession(token)
}

/* ── GET — matrice courante ──────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user || !['super_admin', 'admin_metier'].includes(user.role))
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  const client = await pool.connect()
  try {
    const res = await client.query<{ report_id: string; role: string; granted: boolean }>(
      `SELECT report_id, role, granted
       FROM portail_report_access
       ORDER BY report_id, role`
    )

    // Grouper par report_id → Role[]
    const access: Record<string, Role[]> = {}
    for (const row of res.rows) {
      if (!access[row.report_id]) access[row.report_id] = []
      if (row.granted) access[row.report_id].push(row.role as Role)
    }

    return NextResponse.json({ access })
  } finally {
    client.release()
  }
}

/* ── PUT — sauvegarder la matrice ───────────────────────────────────────── */
export async function PUT(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user || user.role !== 'super_admin')
    return NextResponse.json({ error: 'Seul le Super Admin peut modifier les accès.' }, { status: 403 })

  let body: { access: Record<string, Role[]> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { access } = body
  if (!access || typeof access !== 'object')
    return NextResponse.json({ error: 'Champ "access" manquant ou invalide.' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lire l'état actuel pour le log d'audit
    const currentRes = await client.query<{ report_id: string; role: string; granted: boolean }>(
      `SELECT report_id, role, granted FROM portail_report_access`
    )
    const currentMap: Record<string, Record<string, boolean>> = {}
    for (const row of currentRes.rows) {
      if (!currentMap[row.report_id]) currentMap[row.report_id] = {}
      currentMap[row.report_id][row.role] = row.granted
    }

    // Construire toutes les lignes à upsert
    const upsertRows: { reportId: string; role: Role; granted: boolean }[] = []
    for (const [reportId, grantedRoles] of Object.entries(access)) {
      for (const role of VALID_ROLES) {
        upsertRows.push({ reportId, role, granted: grantedRoles.includes(role) })
      }
    }

    if (upsertRows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Aucune ligne à sauvegarder.' }, { status: 400 })
    }

    // Upsert en batch
    for (const row of upsertRows) {
      await client.query(
        `INSERT INTO portail_report_access (report_id, role, granted, updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_id, role) DO UPDATE
           SET granted    = EXCLUDED.granted,
               updated_at = NOW(),
               updated_by = EXCLUDED.updated_by`,
        [row.reportId, row.role, row.granted, user.id]
      )
    }

    // Log d'audit — uniquement les changements effectifs
    let changeCount = 0
    for (const row of upsertRows) {
      const oldVal = currentMap[row.reportId]?.[row.role]
      if (oldVal !== undefined && oldVal !== row.granted) {
        await client.query(
          `INSERT INTO portail_access_change_log
             (changed_by, change_type, report_id, role, old_value, new_value)
           VALUES ($1, 'role_access', $2, $3, $4, $5)`,
          [user.id, row.reportId, row.role, oldVal, row.granted]
        )
        changeCount++
      }
    }

    await client.query('COMMIT')

    return NextResponse.json({
      ok: true,
      saved: upsertRows.length,
      changed: changeCount,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[/api/admin/access PUT]', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  } finally {
    client.release()
  }
}
