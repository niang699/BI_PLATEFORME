/**
 * GET  /api/admin/users        — liste tous les utilisateurs
 * POST /api/admin/users        — créer un utilisateur
 * PUT  /api/admin/users?id=X   — modifier un utilisateur
 * DELETE /api/admin/users?id=X — désactiver (soft delete)
 *
 * Accès réservé aux rôles : super_admin, admin_metier
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbPortail'
import { validateSession, hashPassword, COOKIE_NAME } from '@/lib/authServer'

const ALLOWED_ROLES = ['super_admin', 'admin_metier']

async function getAuthedUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const user = await validateSession(token)
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null
  return user
}

/* ── GET — liste ─────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const auth = await getAuthedUser(req)
  if (!auth) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT id, nom, prenom, email, role, dt, is_active, created_at, last_login
      FROM portail_users
      ORDER BY is_active DESC, role, nom, prenom
    `)
    return NextResponse.json({ users: res.rows })
  } finally {
    client.release()
  }
}

/* ── POST — créer ────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const auth = await getAuthedUser(req)
  if (!auth) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  const { nom, prenom, email, password, role, dt } = await req.json()
  if (!nom || !prenom || !email || !password || !role) {
    return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 })
  }

  const VALID_ROLES = ['super_admin', 'admin_metier', 'analyste', 'lecteur_dt', 'dt']
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 })
  }

  const hash = await hashPassword(password)
  const client = await pool.connect()
  try {
    const res = await client.query(
      `INSERT INTO portail_users (nom, prenom, email, password_hash, role, dt, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nom, prenom, email, role, dt, is_active, created_at`,
      [nom, prenom, email.toLowerCase().trim(), hash, role, dt || null, auth.id],
    )
    // Log
    await client.query(
      `INSERT INTO portail_access_logs (user_id, email, action, detail)
       VALUES ($1, $2, 'user_created', $3)`,
      [auth.id, auth.email, `Créé: ${email}`],
    )
    return NextResponse.json({ user: res.rows[0] }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    client.release()
  }
}

/* ── PUT — modifier ──────────────────────────────────────────────────────── */
export async function PUT(req: NextRequest) {
  const auth = await getAuthedUser(req)
  if (!auth) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis.' }, { status: 400 })

  const body = await req.json()
  const fields: string[] = []
  const values: unknown[] = []
  let i = 1

  if (body.nom)      { fields.push(`nom=$${i++}`);       values.push(body.nom) }
  if (body.prenom)   { fields.push(`prenom=$${i++}`);    values.push(body.prenom) }
  if (body.role)     { fields.push(`role=$${i++}`);      values.push(body.role) }
  if ('dt' in body)  { fields.push(`dt=$${i++}`);        values.push(body.dt || null) }
  if ('is_active' in body) { fields.push(`is_active=$${i++}`); values.push(body.is_active) }
  if (body.password) { fields.push(`password_hash=$${i++}`); values.push(await hashPassword(body.password)) }

  if (!fields.length) return NextResponse.json({ error: 'Aucun champ à modifier.' }, { status: 400 })

  values.push(id)
  const client = await pool.connect()
  try {
    const res = await client.query(
      `UPDATE portail_users SET ${fields.join(', ')} WHERE id=$${i}
       RETURNING id, nom, prenom, email, role, dt, is_active`,
      values,
    )
    if (!res.rows[0]) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    await client.query(
      `INSERT INTO portail_access_logs (user_id, email, action, detail)
       VALUES ($1, $2, 'user_updated', $3)`,
      [auth.id, auth.email, `Modifié user #${id}`],
    )
    return NextResponse.json({ user: res.rows[0] })
  } finally {
    client.release()
  }
}

/* ── DELETE — désactiver ──────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const auth = await getAuthedUser(req)
  if (!auth) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis.' }, { status: 400 })
  if (id === auth.id) return NextResponse.json({ error: 'Impossible de désactiver votre propre compte.' }, { status: 400 })

  const client = await pool.connect()
  try {
    // Soft delete : is_active = false + révocation des sessions
    await client.query(`UPDATE portail_users SET is_active = false WHERE id = $1`, [id])
    await client.query(`DELETE FROM portail_sessions WHERE user_id = $1`, [id])
    await client.query(
      `INSERT INTO portail_access_logs (user_id, email, action, detail)
       VALUES ($1, $2, 'user_disabled', $3)`,
      [auth.id, auth.email, `Désactivé user #${id}`],
    )
    return NextResponse.json({ ok: true })
  } finally {
    client.release()
  }
}
