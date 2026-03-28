'use client'
import { getCurrentUser } from '@/lib/auth'
import { USERS, REPORTS, ROLE_META } from '@/lib/mockData'
import TopBar from '@/components/TopBar'

/* ── Styles partagés ──────────────────────────────────────────────────────── */
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_PAGE  = '#f8fafc'

const card = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 2px 12px rgba(31,59,114,.08)',
} as const

const th = {
  fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)',
  letterSpacing: '.06em', textTransform: 'uppercase' as const,
  padding: '10px 16px', textAlign: 'left' as const,
  background: '#f8fafc', borderBottom: '1px solid #e8edf5',
  fontFamily: F_BODY,
}

const td = {
  padding: '12px 16px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: 12, color: '#334155',
  fontFamily: F_BODY,
}

/* ── Section header helper ─────────────────────────────────────────────── */
function SH({ icon, label, action }: { icon: string; label: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: C_NAVY, flexShrink: 0 }} />
        <span style={{ fontFamily: F_TITLE, fontSize: 13, fontWeight: 800, color: C_NAVY, letterSpacing: '.03em', textTransform: 'uppercase' }}>
          {icon}&ensp;{label}
        </span>
      </div>
      {action}
    </div>
  )
}

function Btn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{
      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
      background: 'linear-gradient(135deg,#1F3B72,#2B50A0)',
      color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: F_BODY,
      boxShadow: '0 3px 10px rgba(31,59,114,.25)', outline: 'none',
    }}>
      {children}
    </button>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const currentUser = getCurrentUser()

  if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin_metier') {
    return (
      <>
        <TopBar />
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: C_PAGE, fontFamily: F_BODY,
        }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 52, display: 'block', marginBottom: 16 }}>🔒</span>
            <h3 style={{ fontFamily: F_TITLE, fontSize: 20, fontWeight: 800, color: C_NAVY, marginBottom: 8 }}>
              Accès restreint
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)' }}>
              Vous n&apos;avez pas les droits d&apos;administration.
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar />

      <div style={{
        flex: 1, overflowY: 'auto',
        background: C_PAGE,
        padding: '28px 32px',
        display: 'flex', flexDirection: 'column', gap: 24,
        fontFamily: F_BODY,
      }}>

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'rgba(217,119,6,.10)', border: '1px solid rgba(217,119,6,.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: '#B45309',
            }}>⚙</div>
            <div>
              <h1 style={{ fontFamily: F_TITLE, fontSize: 22, fontWeight: 800, color: C_NAVY, margin: 0, letterSpacing: '-.01em' }}>
                Administration
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(31,59,114,.5)', fontWeight: 500, margin: '3px 0 0' }}>
                Gestion des accès, rôles et paramètres système
              </p>
            </div>
          </div>

          {/* Compteurs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Utilisateurs', value: USERS.length,   color: C_NAVY        },
              { label: 'Rapports',     value: REPORTS.length, color: '#96C11E'      },
              { label: 'Sources',      value: 5,              color: '#0891B2'      },
              { label: 'Rôles',        value: 5,              color: '#7C3AED'      },
            ].map(s => (
              <div key={s.label} style={{
                background: '#f8fafc', borderRadius: 12, padding: '10px 18px',
                textAlign: 'center', border: '1px solid #e8edf5',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: F_TITLE }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(31,59,114,.45)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Utilisateurs ─────────────────────────────────────────────── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <SH icon="👥" label="Utilisateurs" action={<Btn>+ Inviter</Btn>} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Utilisateur', 'Email', 'Rôle', 'Périmètre', 'Actions'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {USERS.map(u => (
                  <tr key={u.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                          background: 'linear-gradient(135deg,#1F3B72,#2B50A0)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: F_BODY,
                        }}>{u.avatar}</div>
                        <span style={{ fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, fontSize: 13 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: 'rgba(31,59,114,.5)' }}>{u.email}</td>
                    <td style={td}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 99,
                        fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
                        ...(ROLE_META[u.role].color.includes('senblue')
                          ? { background: '#1F3B7220', color: C_NAVY }
                          : ROLE_META[u.role].color.includes('sengreen')
                          ? { background: '#96C11E20', color: '#4d6610' }
                          : ROLE_META[u.role].color.includes('purple')
                          ? { background: '#7C3AED20', color: '#5b21b6' }
                          : ROLE_META[u.role].color.includes('slate')
                          ? { background: '#64748b20', color: '#475569' }
                          : { background: '#f59e0b20', color: '#b45309' }),
                      }}>
                        {ROLE_META[u.role].label}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'rgba(31,59,114,.5)' }}>{u.dt || 'Global'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, padding: 0 }}>Modifier</button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#E84040', fontFamily: F_BODY, padding: 0 }}>Révoquer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Matrice des rôles ─────────────────────────────────────────── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <SH icon="🔑" label="Matrice des rôles" />
          <div style={{ overflowX: 'auto', padding: '4px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 180 }}>Rôle</th>
                  {['Lire', 'Créer rapport', 'Publier', 'Gérer users', 'Admin'].map(p => (
                    <th key={p} style={{ ...th, textAlign: 'center' as const }}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { role: 'Super Admin DSI', perms: [true,  true,  true,  true,  true ] },
                  { role: 'Admin Métier',    perms: [true,  true,  true,  false, false] },
                  { role: 'Analyste',        perms: [true,  true,  false, false, false] },
                  { role: 'Lecteur DT',      perms: [true,  false, false, false, false] },
                  { role: 'Releveur',        perms: [true,  false, false, false, false] },
                ].map(row => (
                  <tr key={row.role}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...td, fontWeight: 700, color: C_NAVY }}>{row.role}</td>
                    {row.perms.map((p, i) => (
                      <td key={i} style={{ ...td, textAlign: 'center' as const }}>
                        {p
                          ? <span style={{ fontSize: 13, color: '#96C11E' }}>✅</span>
                          : <span style={{ fontSize: 13, color: '#d1d5db' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Gestion des rapports ──────────────────────────────────────── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <SH icon="📊" label="Gestion des rapports" action={<Btn>+ Enregistrer un rapport</Btn>} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Rapport', 'Catégorie', 'Propriétaire', 'Statut', 'Épinglé', 'Actions'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REPORTS.map(r => (
                  <tr key={r.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...td, fontWeight: 700, color: C_NAVY }}>{r.title}</td>
                    <td style={{ ...td, color: 'rgba(31,59,114,.5)' }}>{r.category}</td>
                    <td style={{ ...td, color: 'rgba(31,59,114,.5)' }}>{r.owner}</td>
                    <td style={td}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 99,
                        fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
                        ...(r.status === 'live'
                          ? { background: 'rgba(150,193,30,.12)', color: '#4d6610' }
                          : r.status === 'recent'
                          ? { background: 'rgba(245,158,11,.12)', color: '#b45309' }
                          : { background: 'rgba(232,64,64,.12)',  color: '#b91c1c' }),
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: r.status === 'live' ? '#96C11E' : r.status === 'recent' ? '#f59e0b' : '#E84040',
                        }} />
                        {r.status === 'live' ? 'En direct' : r.status === 'recent' ? 'Récent' : '> 24h'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' as const }}>
                      {r.pinned
                        ? <span style={{ fontSize: 13, color: '#96C11E' }}>✦</span>
                        : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, padding: 0 }}>Modifier</button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#E84040', fontFamily: F_BODY, padding: 0 }}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(31,59,114,.25)', fontWeight: 500, paddingTop: 8, fontFamily: F_BODY }}>
          © 2025 SEN&#39;EAU &nbsp;·&nbsp; Conçu par <strong style={{ color: 'rgba(31,59,114,.4)' }}>Asta Niang</strong> — Data Engineer
        </p>
      </div>
    </>
  )
}
