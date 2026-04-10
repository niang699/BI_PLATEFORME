'use client'
import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '@/lib/auth'
import TopBar from '@/components/TopBar'
import { UserPlus, Pencil, Ban, Check, X, RefreshCw, Shield, Eye, BarChart2, Users } from 'lucide-react'

/* ── Constantes ─────────────────────────────────────────────────────────── */
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_GREEN = '#96C11E'
const C_RED   = '#D85C5C'

const ROLES: { value: string; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'super_admin',   label: 'Super Admin',   color: '#7C3AED', icon: <Shield size={11} /> },
  { value: 'admin_metier',  label: 'Admin Métier',  color: C_NAVY,    icon: <Shield size={11} /> },
  { value: 'analyste',      label: 'Analyste',      color: '#0369A1', icon: <BarChart2 size={11} /> },
  { value: 'lecteur_dt',    label: 'Lecteur DR',    color: '#065F46', icon: <Eye size={11} /> },
  { value: 'dt',            label: 'Directeur DT',  color: '#92400E', icon: <Users size={11} /> },
]

const DR_LIST = [
  'Direction Regionale DAKAR 1',
  'Direction Regionale DAKAR 2',
  'Direction Regionale THIES 1',
  'Direction Regionale THIES 2',
  'Direction Regionale SAINT LOUIS',
  'Direction Regionale ZIGUINCHOR',
  'Direction Regionale RUFISQUE',
  'Direction Regionale KAOLACK',
  'Direction Regionale TAMBACOUNDA',
  'Direction Regionale KOLDA',
  'Direction Regionale LOUGA',
  'Direction Regionale FATICK',
  'Direction Regionale DIOURBEL',
  'Direction Regionale MATAM',
  'Direction Regionale SEDHIOU',
  'Direction Regionale KEDOUGOU',
]

interface DbUser {
  id: number; nom: string; prenom: string; email: string
  role: string; dt: string | null; is_active: boolean
  created_at: string; last_login: string | null
}

const EMPTY_FORM = { nom: '', prenom: '', email: '', password: '', role: 'lecteur_dt', dt: '', is_active: true }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find(x => x.value === role)
  if (!r) return <span>{role}</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: r.color + '18', color: r.color, fontFamily: F_BODY,
    }}>
      {r.icon}{r.label}
    </span>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── Modal Formulaire ────────────────────────────────────────────────────── */
function UserModal({ user, onClose, onSaved }: {
  user: DbUser | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!user
  const [form, setForm] = useState(
    isEdit
      ? { nom: user.nom, prenom: user.prenom, email: user.email, password: '', role: user.role, dt: user.dt ?? '', is_active: user.is_active }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const needsDr = ['lecteur_dt', 'admin_metier', 'dt'].includes(form.role)

  const save = async () => {
    setErr(''); setSaving(true)
    try {
      const url = isEdit ? `/api/admin/users?id=${user!.id}` : '/api/admin/users'
      const method = isEdit ? 'PUT' : 'POST'
      const body: Record<string, unknown> = { ...form }
      if (isEdit && !form.password) delete body.password
      if (!needsDr) body.dt = null

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erreur.'); setSaving(false); return }
      onSaved()
    } catch { setErr('Erreur réseau.'); setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(31,59,114,.22)', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{ fontFamily: F_TITLE, fontSize: 18, fontWeight: 800, color: C_NAVY }}>
            {isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(31,59,114,.4)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Prénom" value={form.prenom} onChange={v => setForm(p => ({ ...p, prenom: v }))} />
            <Field label="Nom" value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} />
          </div>
          <Field label="Email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} type="email" disabled={isEdit} />
          <Field label={isEdit ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'} value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} type="password" />

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Rôle</span>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>

          {needsDr && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Direction Régionale</span>
              <select value={form.dt ?? ''} onChange={e => setForm(p => ({ ...p, dt: e.target.value }))} style={inputStyle}>
                <option value="">— Sélectionner —</option>
                {DR_LIST.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )}

          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <span style={{ fontFamily: F_BODY, fontSize: 13, color: C_NAVY, fontWeight: 600 }}>Compte actif</span>
            </label>
          )}

          {err && (
            <div style={{ padding: '10px 14px', background: 'rgba(216,92,92,.08)', borderRadius: 10, border: '1px solid rgba(216,92,92,.2)', color: C_RED, fontSize: 12, fontWeight: 600, fontFamily: F_BODY }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={onClose} style={{ ...btnBase, background: '#f1f5f9', color: C_NAVY }}>Annuler</button>
            <button onClick={save} disabled={saving} style={{ ...btnBase, background: `linear-gradient(135deg,${C_NAVY},#2B50A0)`, color: '#fff', opacity: saving ? .7 : 1 }}>
              {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer' : 'Créer le compte')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }
const inputStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #e8edf5', fontSize: 13, fontFamily: F_BODY, color: C_NAVY, background: '#f8fafc', outline: 'none', width: '100%' }
const btnBase: React.CSSProperties = { padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: F_BODY }

function Field({ label, value, onChange, type = 'text', disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <span style={labelStyle}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ ...inputStyle, opacity: disabled ? .6 : 1 }} />
    </label>
  )
}

/* ══════════════════════════ PAGE PRINCIPALE ═════════════════════════════ */
export default function UsersAdminPage() {
  const currentUser = getCurrentUser()
  const [users,   setUsers]   = useState<DbUser[]>([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')
  const [modal,   setModal]   = useState<'create' | DbUser | null>(null)
  const [search,  setSearch]  = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [confirmDisable, setConfirmDisable] = useState<DbUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) { setErr('Accès refusé ou erreur serveur.'); setLoading(false); return }
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch { setErr('Erreur réseau.') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const disableUser = async (u: DbUser) => {
    await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' })
    setConfirmDisable(null)
    load()
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.email.toLowerCase().includes(q) || u.nom.toLowerCase().includes(q) || u.prenom.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const stats = {
    total:   users.length,
    actifs:  users.filter(u => u.is_active).length,
    admins:  users.filter(u => ['super_admin','admin_metier'].includes(u.role)).length,
  }

  if (!currentUser || !['super_admin','admin_metier'].includes(currentUser.role)) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: F_BODY }}>
        <div style={{ textAlign: 'center', color: 'rgba(31,59,114,.45)' }}>
          <Shield size={40} style={{ marginBottom: 12, opacity: .4 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>Accès non autorisé</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f4f6fb', fontFamily: F_BODY }}>
      <TopBar title="Gestion des Accès" subtitle="Utilisateurs & Permissions" />

      <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

        {/* ── KPI cards ── */}
        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { label: 'Total comptes', value: stats.total, color: C_NAVY },
            { label: 'Comptes actifs', value: stats.actifs, color: C_GREEN },
            { label: 'Administrateurs', value: stats.admins, color: '#7C3AED' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 22px', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: F_TITLE, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Barre filtres + bouton créer ── */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 20px', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            placeholder="Rechercher par nom ou email…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: '8px 14px', borderRadius: 10, border: '1px solid #e8edf5', fontSize: 13, fontFamily: F_BODY, color: C_NAVY, outline: 'none' }}
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e8edf5', fontSize: 12, fontFamily: F_BODY, color: C_NAVY, background: '#f8fafc', cursor: 'pointer' }}>
            <option value="all">Tous les rôles</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={load} style={{ ...btnBase, background: '#f1f5f9', color: C_NAVY, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} />Actualiser
          </button>
          <button onClick={() => setModal('create')} style={{ ...btnBase, background: `linear-gradient(135deg,${C_NAVY},#2B50A0)`, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={14} />Nouvel utilisateur
          </button>
        </div>

        {/* ── Tableau ── */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 4, height: 18, borderRadius: 99, background: C_NAVY, display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }}>
              {filtered.length} utilisateur{filtered.length > 1 ? 's' : ''}
            </span>
          </div>

          {loading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(31,59,114,.4)', fontSize: 13 }}>
              Chargement…
            </div>
          )}
          {!loading && err && (
            <div style={{ padding: '20px 24px', color: C_RED, fontSize: 13, fontWeight: 600 }}>{err}</div>
          )}
          {!loading && !err && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Utilisateur','Email','Rôle','Direction','Statut','Dernière connexion','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.06em', background: '#f8fafc', borderBottom: '1px solid #e8edf5' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: u.is_active ? 1 : .5 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${C_NAVY},#2B50A0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: F_TITLE, flexShrink: 0 }}>
                          {(u.prenom[0] + u.nom[0]).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY }}>{u.prenom} {u.nom}</div>
                          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }}>#{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(31,59,114,.65)', fontFamily: F_BODY }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(31,59,114,.55)', fontFamily: F_BODY, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.dt ?? <span style={{ opacity: .4 }}>Global</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.is_active
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#15803d', background: 'rgba(22,163,74,.1)', padding: '2px 8px', borderRadius: 99 }}><Check size={10} />Actif</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: C_RED, background: 'rgba(216,92,92,.1)', padding: '2px 8px', borderRadius: 99 }}><X size={10} />Inactif</span>
                      }
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }}>{fmtDate(u.last_login)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setModal(u)} title="Modifier"
                          style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #e8edf5', background: '#fff', cursor: 'pointer', color: C_NAVY, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, fontFamily: F_BODY }}>
                          <Pencil size={11} />Modifier
                        </button>
                        {u.is_active && u.email !== currentUser?.email && (
                          <button onClick={() => setConfirmDisable(u)} title="Désactiver"
                            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(216,92,92,.3)', background: 'rgba(216,92,92,.06)', cursor: 'pointer', color: C_RED, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, fontFamily: F_BODY }}>
                            <Ban size={11} />Désactiver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(31,59,114,.35)', fontSize: 13, fontFamily: F_BODY }}>Aucun utilisateur trouvé</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal créer/modifier ── */}
      {modal && modal !== 'create' && (
        <UserModal user={modal as DbUser} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
      {modal === 'create' && (
        <UserModal user={null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}

      {/* ── Confirm désactivation ── */}
      {confirmDisable && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 24px 80px rgba(31,59,114,.22)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE, marginBottom: 10 }}>Confirmer la désactivation</div>
            <p style={{ fontSize: 13, color: 'rgba(31,59,114,.65)', fontFamily: F_BODY, lineHeight: 1.6, marginBottom: 20 }}>
              Le compte de <strong>{confirmDisable.prenom} {confirmDisable.nom}</strong> sera désactivé et toutes ses sessions seront révoquées immédiatement.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDisable(null)} style={{ ...btnBase, background: '#f1f5f9', color: C_NAVY }}>Annuler</button>
              <button onClick={() => disableUser(confirmDisable)} style={{ ...btnBase, background: C_RED, color: '#fff' }}>Désactiver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
