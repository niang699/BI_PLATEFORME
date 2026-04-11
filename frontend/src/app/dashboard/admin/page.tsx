'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { fetchCurrentUser } from '@/lib/auth'
import { REPORTS } from '@/lib/mockData'
import type { User, Role } from '@/lib/types'
import TopBar from '@/components/TopBar'
import {
  RefreshCw, CheckCircle2, AlertCircle, Database,
  Users, Shield, BarChart3, Settings, ExternalLink,
  X, Lock, Save, UserPlus, Pencil, Ban, Check,
  Eye, BarChart2,
} from 'lucide-react'

/* ── Design tokens ─────────────────────────────────────────────────────────── */
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_GREEN = '#96C11E'
const C_PAGE  = '#f8fafc'

/* ── Constantes gestion utilisateurs ──────────────────────────────────────── */
const ROLES_FORM = [
  { value: 'super_admin',  label: 'Super Admin',  color: '#7C3AED', icon: <Shield size={11} /> },
  { value: 'admin_metier', label: 'Admin Métier', color: C_NAVY,    icon: <Shield size={11} /> },
  { value: 'analyste',     label: 'Analyste',     color: '#0369A1', icon: <BarChart2 size={11} /> },
  { value: 'lecteur_dt',   label: 'Lecteur DR',   color: '#065F46', icon: <Eye size={11} /> },
  { value: 'dt',           label: 'Directeur DT', color: '#92400E', icon: <Users size={11} /> },
]

const DR_LIST = [
  'Direction Regionale DAKAR 1','Direction Regionale DAKAR 2',
  'Direction Regionale THIES 1','Direction Regionale THIES 2',
  'Direction Regionale SAINT LOUIS','Direction Regionale ZIGUINCHOR',
  'Direction Regionale RUFISQUE','Direction Regionale KAOLACK',
  'Direction Regionale TAMBACOUNDA','Direction Regionale KOLDA',
  'Direction Regionale LOUGA','Direction Regionale FATICK',
  'Direction Regionale DIOURBEL','Direction Regionale MATAM',
  'Direction Regionale SEDHIOU','Direction Regionale KEDOUGOU',
]

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)',
  textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY,
}
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, border: 'none',
  fontSize: 13, fontFamily: F_BODY, color: C_NAVY,
  background: '#f0f4fb', outline: 'none', width: '100%',
}
const btnBase: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 10, border: 'none',
  cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: F_BODY,
}
const EMPTY_FORM = { nom: '', prenom: '', email: '', password: '', role: 'lecteur_dt', dt: '', is_active: true }

/* ── Field ─────────────────────────────────────────────────────────────────── */
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

/* ── ApiUserFull ────────────────────────────────────────────────────────────── */
interface ApiUserFull {
  id: number; nom: string; prenom: string; email: string
  role: Role; dt: string | null; is_active: boolean
  last_login: string | null; created_at: string
}
type ApiUser = ApiUserFull

/* ── UserModal ─────────────────────────────────────────────────────────────── */
function UserModal({ user, onClose, onSaved }: {
  user: ApiUserFull | null; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!user
  const [form, setForm] = useState(
    isEdit
      ? { nom: user.nom, prenom: user.prenom, email: user.email, password: '', role: user.role as string, dt: user.dt ?? '', is_active: user.is_active }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const needsDr = ['lecteur_dt', 'admin_metier', 'dt'].includes(form.role)

  const save = async () => {
    setErr(''); setSaving(true)
    try {
      const url    = isEdit ? `/api/admin/users?id=${user!.id}` : '/api/admin/users'
      const method = isEdit ? 'PUT' : 'POST'
      const body: Record<string, unknown> = { ...form }
      if (isEdit && !form.password) delete body.password
      if (!needsDr) body.dt = null
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erreur.'); setSaving(false); return }
      onSaved()
    } catch { setErr('Erreur réseau.'); setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(31,59,114,.18)', padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{ fontFamily: F_TITLE, fontSize: 18, fontWeight: 800, color: C_NAVY }}>
            {isEdit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(31,59,114,.35)', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Prénom" value={form.prenom} onChange={v => setForm(p => ({ ...p, prenom: v }))} />
            <Field label="Nom"    value={form.nom}    onChange={v => setForm(p => ({ ...p, nom: v }))} />
          </div>
          <Field label="Email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} type="email" disabled={isEdit} />
          <Field label={isEdit ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe'} value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} type="password" />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Rôle</span>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
              {ROLES_FORM.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {needsDr && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Direction Régionale</span>
              <select value={form.dt} onChange={e => setForm(p => ({ ...p, dt: e.target.value }))} style={inputStyle}>
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
            <div style={{ padding: '10px 14px', background: 'rgba(216,92,92,.07)', borderRadius: 8, color: '#b91c1c', fontSize: 12, fontWeight: 600 }}>
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

/* ── Role definitions ──────────────────────────────────────────────────────── */
const ROLES_DEF = [
  { key: 'super_admin'  as Role, label: 'Super Admin',  shortLabel: 'S.Admin', desc: 'Accès total — gestion users, paramètres système, tous les rapports', color: '#1F3B72', bg: 'rgba(31,59,114,.1)',  perms: { read: true,  create: true,  publish: true,  manageUsers: true,  admin: true  } },
  { key: 'admin_metier' as Role, label: 'Admin Métier', shortLabel: 'Admin',   desc: 'Lecture + création de rapports — périmètre DT assigné',              color: '#7C3AED', bg: 'rgba(124,58,237,.1)', perms: { read: true,  create: true,  publish: true,  manageUsers: false, admin: false } },
  { key: 'analyste'     as Role, label: 'Analyste',     shortLabel: 'Analyste',desc: 'Lecture + création — accès analytique complet sans publication',      color: '#0891B2', bg: 'rgba(8,145,178,.1)',  perms: { read: true,  create: true,  publish: false, manageUsers: false, admin: false } },
  { key: 'lecteur_dt'   as Role, label: 'Lecteur DT',   shortLabel: 'Lecteur', desc: 'Lecture seule — périmètre Direction Territoriale',                    color: '#059669', bg: 'rgba(5,150,105,.1)',  perms: { read: true,  create: false, publish: false, manageUsers: false, admin: false } },
  { key: 'dt'           as Role, label: 'Directeur DT', shortLabel: 'Dir. DT', desc: 'Lecture terrain — rapports releveurs et opérations DT',              color: '#D97706', bg: 'rgba(217,119,6,.1)',  perms: { read: true,  create: false, publish: false, manageUsers: false, admin: false } },
]

/* ── Category meta ─────────────────────────────────────────────────────────── */
const CAT_META: Record<string, { label: string; color: string; bg: string }> = {
  facturation: { label: 'Facturation',     color: '#0891B2', bg: 'rgba(8,145,178,.06)'  },
  production:  { label: 'Production',      color: '#059669', bg: 'rgba(5,150,105,.06)'  },
  sig:         { label: 'SIG',             color: '#7C3AED', bg: 'rgba(124,58,237,.06)' },
  maintenance: { label: 'Maintenance',     color: '#D97706', bg: 'rgba(217,119,6,.06)'  },
  rh:          { label: 'Ressources Hum.', color: '#E84040', bg: 'rgba(232,64,64,.06)'  },
}

/* ── Pages sidebar (pour la matrice nav) ──────────────────────────────────── */
const NAV_PAGES: { id: string; label: string; section: 'Navigation' | 'Accès rapide'; defaultRoles: Role[] }[] = [
  { id: 'nav_accueil',       label: 'Accueil',          section: 'Navigation',    defaultRoles: ['super_admin','admin_metier','analyste','lecteur_dt','dt'] },
  { id: 'nav_rapports',      label: 'Rapports',         section: 'Navigation',    defaultRoles: ['super_admin','admin_metier','analyste','lecteur_dt','dt'] },
  { id: 'nav_selfservice',   label: 'Self-Service BI',  section: 'Navigation',    defaultRoles: ['super_admin','admin_metier','analyste'] },
  { id: 'nav_hubia',         label: 'Hub IA JAMBAR',    section: 'Navigation',    defaultRoles: ['super_admin','admin_metier','analyste'] },
  { id: 'nav_agence360',     label: 'Mon Agence 360',   section: 'Navigation',    defaultRoles: ['super_admin','admin_metier','analyste','lecteur_dt','dt'] },
  { id: 'nav_gouvernance',   label: 'Data Gouvernance', section: 'Navigation',    defaultRoles: ['super_admin','admin_metier','analyste'] },
  { id: 'nav_alertes',       label: 'Alertes',          section: 'Navigation',    defaultRoles: ['super_admin','admin_metier','analyste','lecteur_dt','dt'] },
  { id: 'nav_admin',         label: 'Administration',   section: 'Navigation',    defaultRoles: ['super_admin','admin_metier'] },
  { id: 'quick_facturation', label: 'Facturation',      section: 'Accès rapide',  defaultRoles: ['super_admin','admin_metier','analyste','lecteur_dt','dt'] },
  { id: 'quick_score360',    label: 'Score 360°',       section: 'Accès rapide',  defaultRoles: ['super_admin','admin_metier','analyste','lecteur_dt','dt'] },
  { id: 'quick_releveurs',   label: 'Releveurs',        section: 'Accès rapide',  defaultRoles: ['super_admin','admin_metier','analyste','lecteur_dt','dt'] },
]

/* ── Shared styles ─────────────────────────────────────────────────────────── */
const card = { background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(31,59,114,.10)' } as const

const TH: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.35)',
  letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '12px 18px', textAlign: 'left',
  background: '#f7f9fd',
  fontFamily: F_BODY, whiteSpace: 'nowrap',
}
const TD: React.CSSProperties = {
  padding: '12px 18px', borderBottom: '1px solid #f2f5fb',
  fontSize: 12, color: '#334155', fontFamily: F_BODY,
}

type Tab = 'utilisateurs' | 'matrice' | 'rapports' | 'systeme'
type CacheStatus = 'idle' | 'loading' | 'ok' | 'error'

/* ── RoleBadge ─────────────────────────────────────────────────────────────── */
function RoleBadge({ role }: { role: Role }) {
  const def = ROLES_DEF.find(r => r.key === role) ?? ROLES_DEF[3]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 6,
      fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
      color: def.color, background: def.bg,
      letterSpacing: '.02em',
    }}>{def.label}</span>
  )
}

/* ── UserAvatar ────────────────────────────────────────────────────────────── */
function UserAvatar({ name, role }: { name: string; role: Role }) {
  const def = ROLES_DEF.find(r => r.key === role) ?? ROLES_DEF[3]
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      background: def.color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: F_BODY,
    }}>{initials || '?'}</div>
  )
}

/* ── KpiStat — style Gouvernance ──────────────────────────────────────────── */
function KpiStat({ icon, value, label, sub, color }: {
  icon: React.ReactNode; value: string; label: string; sub: string; color: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 14, padding: '18px 18px 16px',
        boxShadow: hov ? '0 6px 20px rgba(31,59,114,.12)' : '0 2px 10px rgba(31,59,114,.10)',
        transition: 'box-shadow .22s', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>{icon}</div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, fontFamily: "'Barlow Semi Condensed',sans-serif", color: C_NAVY }}>{value}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 6, color: 'var(--text-primary,#1F3B72)' }}>{label}</div>
      <div style={{ fontSize: 10, marginTop: 3, color: 'rgba(31,59,114,.4)' }}>{sub}</div>
    </div>
  )
}

/* ── SectionHeader ─────────────────────────────────────────────────────────── */
function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: F_TITLE, fontSize: 12, fontWeight: 800, color: C_NAVY, letterSpacing: '.07em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {right}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loaded,      setLoaded]      = useState(false)
  const [activeTab,   setActiveTab]   = useState<Tab>('utilisateurs')

  const [apiUsers,       setApiUsers]       = useState<ApiUser[]>([])
  const [usersLoading,   setUsersLoading]   = useState(false)
  const [usersError,     setUsersError]     = useState<string | null>(null)
  const [drawerUser,     setDrawerUser]     = useState<ApiUser | null>(null)
  const [modal,          setModal]          = useState<'create' | ApiUser | null>(null)
  const [search,         setSearch]         = useState('')
  const [roleFilter,     setRoleFilter]     = useState('all')
  const [confirmDisable, setConfirmDisable] = useState<ApiUser | null>(null)

  const [accessMatrix, setAccessMatrix] = useState<Record<string, Role[]>>(() =>
    Object.fromEntries(REPORTS.map(r => [r.id, [...r.accessRoles]]))
  )
  const [dbMatrix,     setDbMatrix]     = useState<Record<string, Role[]> | null>(null)
  const [matrixDirty,  setMatrixDirty]  = useState(false)
  const [savingMatrix, setSavingMatrix] = useState(false)
  const [saveOk,       setSaveOk]       = useState(false)
  const [saveErr,      setSaveErr]      = useState<string | null>(null)

  const [navMatrix, setNavMatrix] = useState<Record<string, Role[]>>(() =>
    Object.fromEntries(NAV_PAGES.map(p => [p.id, [...p.defaultRoles]]))
  )
  const [baseNavMatrix] = useState<Record<string, Role[]>>(() =>
    Object.fromEntries(NAV_PAGES.map(p => [p.id, [...p.defaultRoles]]))
  )
  const [navDirty, setNavDirty] = useState(false)

  const [cacheStatus, setCacheStatus] = useState<CacheStatus>('idle')
  const [cacheResult, setCacheResult] = useState<{ cleared: number; lastAt: string } | null>(null)
  const [cacheError,  setCacheError]  = useState<string | null>(null)

  useEffect(() => { fetchCurrentUser().then(u => { setCurrentUser(u); setLoaded(true) }) }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true); setUsersError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setApiUsers((await res.json()).users ?? [])
    } catch (e) { setUsersError(e instanceof Error ? e.message : 'Erreur') }
    finally { setUsersLoading(false) }
  }, [])

  const loadMatrix = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/access')
      if (!res.ok) return
      const data = await res.json()
      if (data.access) { setDbMatrix(data.access); setAccessMatrix(data.access) }
    } catch { /* fallback mockData */ }
  }, [])

  useEffect(() => {
    if (loaded && (currentUser?.role === 'super_admin' || currentUser?.role === 'admin_metier')) {
      loadUsers(); loadMatrix()
    }
  }, [loaded, currentUser, loadUsers, loadMatrix])

  const disableUser = async (u: ApiUser) => {
    await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' })
    setConfirmDisable(null); loadUsers()
  }

  const filteredUsers = apiUsers.filter(u => {
    const q = search.toLowerCase()
    return (!q || u.email.toLowerCase().includes(q) || u.nom.toLowerCase().includes(q) || u.prenom.toLowerCase().includes(q))
      && (roleFilter === 'all' || u.role === roleFilter)
  })

  function toggleCell(reportId: string, role: Role) {
    if (currentUser?.role !== 'super_admin') return
    setAccessMatrix(prev => {
      const roles = prev[reportId] ?? []
      return { ...prev, [reportId]: roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role] }
    })
    setMatrixDirty(true); setSaveOk(false); setSaveErr(null)
  }

  function toggleNavCell(pageId: string, role: Role) {
    if (currentUser?.role !== 'super_admin') return
    setNavMatrix(prev => {
      const roles = prev[pageId] ?? []
      return { ...prev, [pageId]: roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role] }
    })
    setNavDirty(true)
  }

  async function handleSaveMatrix() {
    setSavingMatrix(true); setSaveErr(null)
    try {
      const res = await fetch('/api/admin/access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access: accessMatrix }) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDbMatrix({ ...accessMatrix }); setMatrixDirty(false); setSaveOk(true)
      setTimeout(() => setSaveOk(false), 5000)
    } catch (e) { setSaveErr(e instanceof Error ? e.message : 'Erreur') }
    finally { setSavingMatrix(false) }
  }

  const handleRefreshCache = async () => {
    setCacheStatus('loading'); setCacheResult(null); setCacheError(null)
    try {
      const res = await fetch('/api/cache', { method: 'DELETE' })
      const data = await res.json()
      setCacheResult({ cleared: typeof data.cleared === 'number' ? data.cleared : 0, lastAt: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }) })
      setCacheStatus('ok'); setTimeout(() => setCacheStatus('idle'), 8000)
    } catch (e) { setCacheError(e instanceof Error ? e.message : 'Erreur'); setCacheStatus('error') }
  }

  if (!loaded) return (<><TopBar /><div style={{ flex: 1, background: C_PAGE }} /></>)

  if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin_metier') return (
    <>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C_PAGE, fontFamily: F_BODY }}>
        <div style={{ textAlign: 'center' }}>
          <Lock size={36} style={{ color: 'rgba(31,59,114,.2)', marginBottom: 16 }} />
          <h3 style={{ fontFamily: F_TITLE, fontSize: 18, fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>Accès restreint</h3>
          <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)' }}>Vous n&apos;avez pas les droits d&apos;administration.</p>
        </div>
      </div>
    </>
  )

  const totalUsers   = apiUsers.length
  const activeUsers  = apiUsers.filter(u => u.is_active).length
  const adminCount   = apiUsers.filter(u => u.role === 'super_admin' || u.role === 'admin_metier').length
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const baseMatrix   = dbMatrix ?? Object.fromEntries(REPORTS.map(r => [r.id, r.accessRoles]))
  const countChanges = REPORTS.reduce((acc, r) => {
    const orig = (baseMatrix[r.id] ?? []).slice().sort().join(',')
    const curr = (accessMatrix[r.id] ?? []).slice().sort().join(',')
    return acc + (orig !== curr ? 1 : 0)
  }, 0)
  const countNavChanges = NAV_PAGES.reduce((acc, p) => {
    const orig = (baseNavMatrix[p.id] ?? []).slice().sort().join(',')
    const curr = (navMatrix[p.id] ?? []).slice().sort().join(',')
    return acc + (orig !== curr ? 1 : 0)
  }, 0)
  const totalDirtyCount = countChanges + countNavChanges
  const reportsByCategory = REPORTS.reduce<Record<string, typeof REPORTS>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []; acc[r.category].push(r); return acc
  }, {})
  const drawerReports     = drawerUser ? REPORTS.map(r => ({ ...r, hasAccess: (accessMatrix[r.id] ?? []).includes(drawerUser.role) })) : []
  const drawerAccessCount = drawerReports.filter(r => r.hasAccess).length

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'utilisateurs', label: 'Utilisateurs',     icon: <Users size={14} /> },
    { key: 'matrice',      label: 'Matrice des rôles', icon: <Shield size={14} /> },
    { key: 'rapports',     label: 'Rapports',          icon: <BarChart3 size={14} /> },
    { key: 'systeme',      label: 'Système',           icon: <Settings size={14} /> },
  ]

  return (
    <>
      <TopBar />

      {/* ── Drawer accès utilisateur ──────────────────────────────────────── */}
      {drawerUser && (
        <>
          <div onClick={() => setDrawerUser(null)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(15,23,42,.25)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50, width: 380, background: '#fff', boxShadow: '-4px 0 32px rgba(31,59,114,.14)', display: 'flex', flexDirection: 'column', fontFamily: F_BODY }}>

            {/* Header */}
            <div style={{ padding: '20px 22px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <UserAvatar name={`${drawerUser.prenom} ${drawerUser.nom}`} role={drawerUser.role} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {drawerUser.prenom} {drawerUser.nom}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(31,59,114,.5)', marginTop: 2 }}>{drawerUser.email}</div>
              </div>
              <button onClick={() => setDrawerUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(31,59,114,.3)', padding: 4, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Role + compteur */}
            <div style={{ padding: '10px 22px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <RoleBadge role={drawerUser.role} />
              {drawerUser.dt && <span style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', fontWeight: 600 }}>{drawerUser.dt}</span>}
              <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: C_NAVY }}>
                <span style={{ fontFamily: F_TITLE, fontSize: 18 }}>{drawerAccessCount}</span>
                <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginLeft: 4 }}>/ {REPORTS.length} rapports</span>
              </div>
            </div>

            {/* Liste rapports */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {Object.entries(reportsByCategory).map(([cat, reports]) => {
                const catMeta  = CAT_META[cat] ?? { label: cat, color: C_NAVY, bg: '#f8fafc' }
                const catItems = reports.map(r => ({ ...r, hasAccess: (accessMatrix[r.id] ?? []).includes(drawerUser.role) }))
                const granted  = catItems.filter(r => r.hasAccess).length
                return (
                  <div key={cat}>
                    <div style={{ padding: '8px 22px', background: catMeta.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 12, borderRadius: 2, background: catMeta.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: catMeta.color, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_TITLE }}>{catMeta.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: catMeta.color }}>{granted}/{catItems.length}</span>
                    </div>
                    {catItems.map(r => (
                      <div key={r.id} style={{ padding: '9px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: r.hasAccess ? '#059669' : '#d1d5db' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: r.hasAccess ? C_NAVY : 'rgba(31,59,114,.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.title}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', marginTop: 1 }}>
                            {r.hasAccess ? 'Accès autorisé' : 'Non autorisé'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', background: '#f7f9fd' }}>
              <p style={{ fontSize: 11, color: 'rgba(31,59,114,.45)', margin: 0, lineHeight: 1.6 }}>
                Accès déterminés par le rôle <strong style={{ color: C_NAVY }}>{ROLES_DEF.find(r => r.key === drawerUser.role)?.label}</strong>.
                Modifiez le rôle dans l&apos;onglet <Link href="#" onClick={e => { e.preventDefault(); setDrawerUser(null) }} style={{ color: C_NAVY, fontWeight: 700 }}>Utilisateurs</Link>.
              </p>
            </div>
          </div>
        </>
      )}

      <div style={{ flex: 1, overflowY: 'auto', background: C_PAGE, fontFamily: F_BODY }}>

        {/* ══ HERO — blanc, ombre subtile (style Gouvernance) ══════════════════ */}
        <div style={{ background: '#fff', padding: '28px 32px 0', boxShadow: '0 1px 0 rgba(31,59,114,.08)' }}>

          {/* Titre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Settings size={20} color={C_NAVY} strokeWidth={1.8} />
            </div>
            <div>
              <h1 style={{ color: C_NAVY, fontSize: 20, fontWeight: 800, fontFamily: F_TITLE, lineHeight: 1.1, letterSpacing: '-.01em', margin: 0 }}>
                Administration SEN&apos;EAU
              </h1>
              <p style={{ color: 'rgba(31,59,114,.45)', fontSize: 11, marginTop: 3, fontWeight: 500 }}>
                Gestion des accès · Rôles · Rapports · Système
              </p>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(150,193,30,.12)', color: '#5a7a10', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {isSuperAdmin ? 'Super Admin' : 'Admin Métier'}
              </span>
            </div>
          </div>

          {/* KPI Cards — style Gouvernance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { icon: <Users size={17} />,    value: usersLoading ? '…' : String(totalUsers),  label: 'Utilisateurs',   sub: `${activeUsers} actifs`,                   color: C_NAVY    },
              { icon: <Check size={17} />,    value: usersLoading ? '…' : String(activeUsers),  label: 'Comptes actifs', sub: `${totalUsers - activeUsers} inactifs`,     color: '#059669' },
              { icon: <BarChart3 size={17} />, value: String(REPORTS.length),                   label: 'Rapports',       sub: `${Object.keys(CAT_META).length} catégories`, color: '#0891B2' },
              { icon: <Shield size={17} />,   value: '5',                                       label: 'Rôles',          sub: 'Hiérarchie définie',                       color: '#7C3AED' },
            ].map(c => (
              <KpiStat key={c.label} {...c} />
            ))}
          </div>

          {/* Tabs — underline style Gouvernance */}
          <div style={{ display: 'flex', marginTop: 20, gap: 2 }}>
            {TABS.map(tab => {
              const active = activeTab === tab.key
              const badge  = tab.key === 'matrice' && (matrixDirty || navDirty) ? totalDirtyCount : 0
              const color  = tab.key === 'utilisateurs' ? C_NAVY : tab.key === 'matrice' ? '#7C3AED' : tab.key === 'rapports' ? '#0891B2' : '#D97706'
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  padding: '9px 20px', border: 'none', outline: 'none',
                  borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
                  borderRadius: 0, background: 'transparent',
                  color: active ? color : 'rgba(31,59,114,.4)',
                  fontSize: 11.5, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', transition: 'all .18s',
                  display: 'flex', alignItems: 'center', gap: 6,
                  letterSpacing: '.01em', whiteSpace: 'nowrap',
                  position: 'relative', fontFamily: F_BODY,
                }}>
                  {tab.icon}{tab.label}
                  {badge > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: '#E84040', color: '#fff', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ══ CONTENU ══════════════════════════════════════════════════════════ */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ════════════════════════════════════════════════════════════════════
            TAB : UTILISATEURS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'utilisateurs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Barre filtres */}
            <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                placeholder="Rechercher par nom ou email…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 12, fontFamily: F_BODY, color: C_NAVY, outline: 'none', background: '#f0f4fb' }}
              />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 12, fontFamily: F_BODY, color: C_NAVY, background: '#f0f4fb', cursor: 'pointer' }}>
                <option value="all">Tous les rôles</option>
                {ROLES_FORM.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={loadUsers} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#f0f4fb', color: C_NAVY, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F_BODY }}>
                <RefreshCw size={12} style={{ animation: usersLoading ? 'spin .8s linear infinite' : 'none' }} />
                Actualiser
              </button>
              <button onClick={() => setModal('create')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: C_NAVY, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F_BODY }}>
                <UserPlus size={13} /> Nouvel utilisateur
              </button>
            </div>

            {/* Tableau */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <SectionHeader label={`${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? 's' : ''}${search || roleFilter !== 'all' ? ' — filtrés' : ''}`} />
              {usersError && (
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontSize: 12 }}>
                  <AlertCircle size={14} />{usersError}
                </div>
              )}
              {!usersError && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Utilisateur', 'Rôle', 'Périmètre', 'Statut', 'Rapports', 'Dernière connexion', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {usersLoading
                        ? Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i}>
                            {[140, 90, 120, 60, 50, 120, 130].map((w, j) => (
                              <td key={j} style={TD}>
                                <div style={{ height: 10, borderRadius: 5, width: w, background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer .9s ease-in-out infinite' }} />
                              </td>
                            ))}
                          </tr>
                        ))
                        : filteredUsers.length === 0
                        ? <tr><td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(31,59,114,.3)', fontSize: 13 }}>Aucun utilisateur trouvé</td></tr>
                        : filteredUsers.map(u => {
                          const accessCount  = REPORTS.filter(r => (accessMatrix[r.id] ?? []).includes(u.role)).length
                          const isDrawerOpen = drawerUser?.id === u.id
                          return (
                            <tr key={u.id}
                              style={{ background: isDrawerOpen ? '#f0f4ff' : 'transparent', opacity: u.is_active ? 1 : .55 }}
                              onMouseEnter={e => { if (!isDrawerOpen) e.currentTarget.style.background = '#f8fafc' }}
                              onMouseLeave={e => { if (!isDrawerOpen) e.currentTarget.style.background = 'transparent' }}
                            >
                              <td style={TD}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <UserAvatar name={`${u.prenom} ${u.nom}`} role={u.role} />
                                  <div>
                                    <div style={{ fontWeight: 700, color: C_NAVY, fontSize: 13 }}>{u.prenom} {u.nom}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginTop: 1 }}>{u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={TD}><RoleBadge role={u.role} /></td>
                              <td style={{ ...TD, fontSize: 11, color: 'rgba(31,59,114,.5)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.dt ?? '—'}
                              </td>
                              <td style={TD}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                  ...(u.is_active ? { background: 'rgba(5,150,105,.08)', color: '#059669' } : { background: 'rgba(148,163,184,.1)', color: '#64748b' }),
                                }}>
                                  {u.is_active ? <Check size={9} /> : <X size={9} />}
                                  {u.is_active ? 'Actif' : 'Inactif'}
                                </span>
                              </td>
                              <td style={{ ...TD, textAlign: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: F_TITLE, color: C_NAVY }}>
                                  {accessCount}<span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(31,59,114,.35)' }}>/{REPORTS.length}</span>
                                </span>
                              </td>
                              <td style={{ ...TD, fontSize: 11, color: 'rgba(31,59,114,.4)' }}>
                                {u.last_login ? new Date(u.last_login).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td style={TD}>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <button onClick={() => setDrawerUser(isDrawerOpen ? null : u)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: isDrawerOpen ? C_NAVY : 'rgba(31,59,114,.07)', color: isDrawerOpen ? '#fff' : C_NAVY, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, fontFamily: F_BODY, transition: 'all .15s' }}>
                                    <Shield size={11} />Accès
                                  </button>
                                  <button onClick={() => setModal(u)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#f0f4fb', cursor: 'pointer', color: C_NAVY, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, fontFamily: F_BODY }}>
                                    <Pencil size={11} />Modifier
                                  </button>
                                  {u.is_active && u.email !== currentUser?.email && (
                                    <button onClick={() => setConfirmDisable(u)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: 'rgba(220,38,38,.07)', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, fontFamily: F_BODY }}>
                                      <Ban size={11} />Désactiver
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB : MATRICE DES RÔLES
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'matrice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {(matrixDirty || navDirty) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, background: '#fffbeb', boxShadow: '0 4px 20px rgba(217,119,6,.10)' }}>
                <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600, flex: 1 }}>
                  <strong>{totalDirtyCount} élément{totalDirtyCount > 1 ? 's' : ''}</strong> modifié{totalDirtyCount > 1 ? 's' : ''} — non sauvegardé
                </span>
                {saveErr && <span style={{ fontSize: 11, color: '#DC2626' }}>{saveErr}</span>}
                <button onClick={() => { setAccessMatrix({ ...baseMatrix }); setMatrixDirty(false); setNavMatrix({ ...baseNavMatrix }); setNavDirty(false); setSaveErr(null) }} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: 'rgba(217,119,6,.12)', color: '#92400e', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: F_BODY }}>Annuler</button>
                <button onClick={handleSaveMatrix} disabled={savingMatrix} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 7, border: 'none', background: '#D97706', color: '#fff', fontSize: 11, fontWeight: 700, cursor: savingMatrix ? 'not-allowed' : 'pointer', fontFamily: F_BODY, opacity: savingMatrix ? .7 : 1 }}>
                  <Save size={12} />
                  {savingMatrix ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            )}

            {saveOk && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderRadius: 14, background: '#f0fdf4', boxShadow: '0 4px 20px rgba(5,150,105,.10)', fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                <CheckCircle2 size={15} style={{ color: '#059669', flexShrink: 0 }} />
                Matrice d&apos;accès sauvegardée.
              </div>
            )}

            {/* Cartes rôles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {ROLES_DEF.map(role => (
                <div key={role.key} style={{ ...card, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>{role.label}</div>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(31,59,114,.48)', lineHeight: 1.6, margin: '0 0 14px' }}>{role.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {([['Lire', role.perms.read], ['Créer', role.perms.create], ['Publier', role.perms.publish], ['Users', role.perms.manageUsers], ['Admin', role.perms.admin]] as [string, boolean][]).map(([label, ok]) => (
                      <span key={label} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 9, fontWeight: 700, ...(ok ? { background: `${role.color}14`, color: role.color } : { background: 'rgba(31,59,114,.05)', color: 'rgba(31,59,114,.28)' }) }}>
                        {ok ? '✓' : '–'} {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Matrice */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <SectionHeader
                label="Matrice d'accès — Rapports × Rôles"
                right={isSuperAdmin
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,.08)', padding: '3px 10px', borderRadius: 6 }}>Mode édition</span>
                  : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 600 }}><Lock size={10} />Lecture seule</span>}
              />
              {isSuperAdmin && (
                <div style={{ padding: '9px 22px 10px', background: '#f7f9fd', fontSize: 11, color: 'rgba(31,59,114,.45)' }}>
                  Cliquez sur une cellule pour accorder ou révoquer l&apos;accès à un rapport pour un rôle donné.
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, minWidth: 220 }}>Rapport</th>
                      <th style={{ ...TH, textAlign: 'center', minWidth: 90 }}>Catégorie</th>
                      {ROLES_DEF.map(role => (
                        <th key={role.key} style={{ ...TH, textAlign: 'center', minWidth: 80, color: role.color }}>{role.shortLabel}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {REPORTS.map(r => {
                      const cat       = CAT_META[r.category] ?? { label: r.category, color: C_NAVY, bg: '#f8fafc' }
                      const curRoles  = accessMatrix[r.id] ?? []
                      const wasChanged = curRoles.slice().sort().join(',') !== (baseMatrix[r.id] ?? []).slice().sort().join(',')
                      return (
                        <tr key={r.id}
                          style={{ background: wasChanged ? '#fffbeb' : 'transparent' }}
                          onMouseEnter={e => { if (!wasChanged) e.currentTarget.style.background = '#f8fafc' }}
                          onMouseLeave={e => { if (!wasChanged) e.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={{ ...TD, fontWeight: 700, color: C_NAVY }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {wasChanged && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />}
                              {r.title}
                            </div>
                          </td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700, color: cat.color, background: cat.bg }}>
                              {cat.label}
                            </span>
                          </td>
                          {ROLES_DEF.map(role => {
                            const ok      = curRoles.includes(role.key)
                            const changed = ok !== (baseMatrix[r.id] ?? []).includes(role.key)
                            return (
                              <td key={role.key} style={{ ...TD, textAlign: 'center', padding: '8px' }}>
                                <button
                                  onClick={() => toggleCell(r.id, role.key)}
                                  disabled={!isSuperAdmin}
                                  title={isSuperAdmin ? (ok ? `Révoquer ${role.label}` : `Accorder ${role.label}`) : 'Super Admin uniquement'}
                                  style={{
                                    width: 30, height: 30, borderRadius: 8,
                                    border: changed ? `2px solid ${ok ? '#059669' : '#dc2626'}` : '2px solid transparent',
                                    cursor: isSuperAdmin ? 'pointer' : 'default',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    background: ok ? role.bg : 'transparent',
                                    transition: 'all .15s',
                                  }}
                                  onMouseEnter={e => { if (isSuperAdmin) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.15)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
                                >
                                  {ok
                                    ? <Check size={13} style={{ color: role.color }} />
                                    : <span style={{ color: '#d1d5db', fontSize: 13, fontWeight: 700 }}>—</span>}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Matrice navigation */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <SectionHeader
                label="Matrice d'accès — Navigation × Rôles"
                right={isSuperAdmin
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,.08)', padding: '3px 10px', borderRadius: 6 }}>Mode édition</span>
                  : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 600 }}><Lock size={10} />Lecture seule</span>}
              />
              {isSuperAdmin && (
                <div style={{ padding: '9px 22px 10px', background: '#f7f9fd', fontSize: 11, color: 'rgba(31,59,114,.45)' }}>
                  Cliquez sur une cellule pour accorder ou révoquer l&apos;accès à un onglet de la navigation pour un rôle donné.
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, minWidth: 200 }}>Page / Onglet</th>
                      <th style={{ ...TH, textAlign: 'center', minWidth: 100 }}>Section</th>
                      {ROLES_DEF.map(role => (
                        <th key={role.key} style={{ ...TH, textAlign: 'center', minWidth: 80, color: role.color }}>{role.shortLabel}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NAV_PAGES.map(page => {
                      const curRoles   = navMatrix[page.id] ?? []
                      const wasChanged = curRoles.slice().sort().join(',') !== (baseNavMatrix[page.id] ?? []).slice().sort().join(',')
                      const sectionColor = page.section === 'Navigation' ? C_NAVY : '#7C3AED'
                      return (
                        <tr key={page.id}
                          style={{ background: wasChanged ? '#fffbeb' : 'transparent' }}
                          onMouseEnter={e => { if (!wasChanged) e.currentTarget.style.background = '#f8fafc' }}
                          onMouseLeave={e => { if (!wasChanged) e.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={{ ...TD, fontWeight: 700, color: C_NAVY }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {wasChanged && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />}
                              {page.label}
                            </div>
                          </td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700, color: sectionColor, background: `${sectionColor}08` }}>
                              {page.section}
                            </span>
                          </td>
                          {ROLES_DEF.map(role => {
                            const ok      = curRoles.includes(role.key)
                            const changed = ok !== (baseNavMatrix[page.id] ?? []).includes(role.key)
                            return (
                              <td key={role.key} style={{ ...TD, textAlign: 'center', padding: '8px' }}>
                                <button
                                  onClick={() => toggleNavCell(page.id, role.key)}
                                  disabled={!isSuperAdmin}
                                  title={isSuperAdmin ? (ok ? `Révoquer ${role.label}` : `Accorder ${role.label}`) : 'Super Admin uniquement'}
                                  style={{
                                    width: 30, height: 30, borderRadius: 8,
                                    border: changed ? `2px solid ${ok ? '#059669' : '#dc2626'}` : '2px solid transparent',
                                    cursor: isSuperAdmin ? 'pointer' : 'default',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    background: ok ? role.bg : 'transparent',
                                    transition: 'all .15s',
                                  }}
                                  onMouseEnter={e => { if (isSuperAdmin) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.15)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
                                >
                                  {ok
                                    ? <Check size={13} style={{ color: role.color }} />
                                    : <span style={{ color: '#d1d5db', fontSize: 13, fontWeight: 700 }}>—</span>}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB : RAPPORTS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'rapports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(reportsByCategory).map(([cat, reports]) => {
              const catMeta = CAT_META[cat] ?? { label: cat, color: C_NAVY, bg: '#f8fafc' }
              return (
                <div key={cat} style={{ ...card, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', borderBottom: `1px solid ${catMeta.color}18`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: catMeta.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: F_TITLE, fontSize: 12, fontWeight: 800, color: catMeta.color, letterSpacing: '.06em', textTransform: 'uppercase' }}>{catMeta.label}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700, background: `${catMeta.color}14`, color: catMeta.color }}>{reports.length}</span>
                  </div>
                  {reports.map((r, i) => (
                    <div key={r.id} style={{ padding: '12px 20px', borderBottom: i < reports.length - 1 ? '1px solid #f4f6fb' : 'none', display: 'flex', alignItems: 'flex-start', gap: 14 }}
                      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = '#f8fafc')}
                      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                    >
                      <div style={{ marginTop: 5, width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: r.status === 'live' ? '#059669' : r.status === 'recent' ? '#f59e0b' : '#94a3b8' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C_NAVY }}>{r.title}</span>
                          {r.pinned && <span style={{ fontSize: 10, color: C_GREEN, fontWeight: 700 }}>Épinglé</span>}
                          {r.external && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,.07)', padding: '2px 7px', borderRadius: 5 }}><ExternalLink size={9} />Externe</span>}
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(31,59,114,.45)', margin: '0 0 8px', lineHeight: 1.6 }}>{r.description}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.3)' }}>Accès :</span>
                          {ROLES_DEF.filter(role => (accessMatrix[r.id] ?? []).includes(role.key)).map(role => (
                            <span key={role.key} style={{ padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700, color: role.color, background: role.bg }}>{role.shortLabel}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 600, marginBottom: 5 }}>{r.owner}</div>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {r.tags.slice(0, 3).map(t => <span key={t} style={{ padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 600, background: '#f1f5f9', color: 'rgba(31,59,114,.4)' }}>{t}</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB : SYSTÈME
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'systeme' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Infrastructure */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { label: 'Base ODS',     sub: '10.106.99.138 · odsDB',            color: '#059669', status: 'Connectée'  },
                { label: 'Base Portail', sub: '10.106.99.138 · Portail_DATA',      color: '#059669', status: 'Connectée'  },
                { label: 'Redis Cache',  sub: 'Session cache · TTL 5 min',         color: '#D97706', status: 'En attente' },
                { label: 'Middleware',   sub: 'Edge Runtime · Protège /dashboard', color: '#059669', status: 'Actif'      },
              ].map(db => (
                <div key={db.label} style={{ ...card, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: db.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>{db.label}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(31,59,114,.38)', marginBottom: 12, paddingLeft: 16 }}>{db.sub}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: db.color, background: `${db.color}12` }}>
                    {db.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Sécurité */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
              {[
                { title: 'Sessions sécurisées',    color: C_NAVY,    items: ['Cookie HttpOnly · SameSite Lax', 'TTL 8h · Token 96 caractères', 'Révocation immédiate sur logout'] },
                { title: 'Protection brute-force', color: '#7C3AED', items: ['Blocage après 5 tentatives', 'Verrou 15 minutes · Redis + DB', 'Audit log de toutes les actions'] },
                { title: 'Performance cache',      color: '#D97706', items: ['Sessions Redis TTL 5 min', 'Rapports Redis TTL 1 h', '99 % des requêtes < 1 ms'] },
              ].map(sec => (
                <div key={sec.title} style={{ ...card, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: sec.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>{sec.title}</div>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {sec.items.map(item => (
                      <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(31,59,114,.52)' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, background: sec.color }} />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Cache */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <SectionHeader label="Actualisation du cache" />
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Database size={13} style={{ color: 'rgba(31,59,114,.4)' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: C_NAVY }}>Cache serveur Redis</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(31,59,114,.5)', lineHeight: 1.7, marginBottom: 14 }}>
                      Les rapports sont mis en cache <strong>1 heure</strong>. Les sessions utilisateurs sont cachées <strong>5 minutes</strong>.
                      Après une mise à jour des vues SQL, videz le cache pour forcer l&apos;actualisation.
                    </p>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Rapports',    ttl: '1 h',   color: C_NAVY    },
                        { label: 'KPIs RH',     ttl: '1 h',   color: '#7C3AED' },
                        { label: 'Facturation', ttl: '1 h',   color: '#0891B2' },
                        { label: 'Sessions',    ttl: '5 min', color: '#059669' },
                        { label: 'Filtres',     ttl: '5 min', color: C_GREEN   },
                      ].map(s => (
                        <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(31,59,114,.05)', borderRadius: 20, padding: '4px 10px', fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.5)' }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />{s.label}
                          <span style={{ color: 'rgba(31,59,114,.3)' }}>{s.ttl}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    <button onClick={handleRefreshCache} disabled={cacheStatus === 'loading'} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 9, border: 'none',
                      background: cacheStatus === 'loading' ? '#f1f5f9' : cacheStatus === 'ok' ? '#059669' : C_NAVY,
                      color: cacheStatus === 'loading' ? 'rgba(31,59,114,.4)' : '#fff',
                      fontSize: 12, fontWeight: 700, cursor: cacheStatus === 'loading' ? 'not-allowed' : 'pointer',
                      fontFamily: F_BODY, minWidth: 200, justifyContent: 'center', transition: 'background .2s',
                    }}>
                      <RefreshCw size={13} style={{ animation: cacheStatus === 'loading' ? 'spin .8s linear infinite' : 'none' }} />
                      {cacheStatus === 'loading' ? 'Actualisation…' : cacheStatus === 'ok' ? 'Cache vidé' : 'Vider le cache'}
                    </button>
                    {cacheStatus === 'ok' && cacheResult && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#059669', fontWeight: 600 }}>
                        <CheckCircle2 size={12} />
                        {cacheResult.cleared} entrée{cacheResult.cleared !== 1 ? 's' : ''} supprimée{cacheResult.cleared !== 1 ? 's' : ''} · {cacheResult.lastAt}
                      </div>
                    )}
                    {cacheStatus === 'error' && cacheError && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                        <AlertCircle size={12} />{cacheError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rapports planifiés */}
            <Link href="/dashboard/admin/rapports-planifies" style={{ textDecoration: 'none' }}>
              <div style={{ ...card, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'box-shadow .2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(31,59,114,.16), 0 2px 10px rgba(31,59,114,.07)')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(31,59,114,.10), 0 2px 8px rgba(31,59,114,.04)')}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE }}>Rapports planifiés</div>
                  <div style={{ fontSize: 11, color: 'rgba(31,59,114,.45)', marginTop: 2 }}>Envoi automatique · Excel · Quotidien / Hebdomadaire / Mensuel</div>
                </div>
                <span style={{ fontSize: 16, color: 'rgba(31,59,114,.2)' }}>›</span>
              </div>
            </Link>
          </div>
        )}

        <style>{`
          @keyframes spin    { to { transform: rotate(360deg); } }
          @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        `}</style>
        </div>{/* ── /contenu ── */}
      </div>{/* ── /page wrapper ── */}

      {/* ── Modals ── */}
      {modal !== null && (
        <UserModal user={modal === 'create' ? null : modal as ApiUserFull} onClose={() => setModal(null)} onSaved={() => { setModal(null); loadUsers() }} />
      )}

      {confirmDisable && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(15,23,42,.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 400, boxShadow: '0 20px 60px rgba(31,59,114,.18)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C_NAVY, fontFamily: F_TITLE, marginBottom: 10 }}>Confirmer la désactivation</div>
            <p style={{ fontSize: 13, color: 'rgba(31,59,114,.6)', fontFamily: F_BODY, lineHeight: 1.6, marginBottom: 20 }}>
              Le compte de <strong>{confirmDisable.prenom} {confirmDisable.nom}</strong> sera désactivé et toutes ses sessions révoquées.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDisable(null)} style={{ ...btnBase, background: '#f1f5f9', color: C_NAVY }}>Annuler</button>
              <button onClick={() => disableUser(confirmDisable)} style={{ ...btnBase, background: '#dc2626', color: '#fff' }}>Désactiver</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
