'use client'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { REPORTS, ALERTS, PLATFORM_STATS, CATEGORY_META, formatRelativeTime, Category, User } from '@/lib/mockData'
import TopBar from '@/components/TopBar'
import Link from 'next/link'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'facturation', label: 'Facturation'  },
  { id: 'production',  label: 'Production'   },
  { id: 'maintenance', label: 'Maintenance'  },
  { id: 'rh',          label: 'RH'           },
  { id: 'sig',         label: 'Cartographie' },
]

const NAVY   = '#1F3B72'
const GREEN  = '#96C11E'
const RED    = '#E84040'
const BG     = '#f8fafc'
const CARD   = '#ffffff'
const SHADOW = '0 2px 10px rgba(31,59,114,.10)'

const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"

/* ── Titre section ─────────────────────────────────────────────────────── */
function SH({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <h3 style={{
        fontFamily: F_TITLE, fontSize: 12, fontWeight: 800, color: NAVY,
        margin: 0, textTransform: 'uppercase', letterSpacing: '.1em',
        opacity: .55,
      }}>{label}</h3>
      {action}
    </div>
  )
}

/* ── Carte rapport épinglé ─────────────────────────────────────────────── */
function PinnedCard({ report }: { report: typeof REPORTS[0] }) {
  const live = report.status === 'live'
  const href = report.url === '#' ? '#' : `/viewer/${report.id}`

  return (
    <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: CARD, borderRadius: 14, boxShadow: SHADOW,
        padding: '18px 18px 14px',
        transition: 'all .18s', height: '100%', boxSizing: 'border-box' as const,
        display: 'flex', flexDirection: 'column', gap: 0,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = '0 6px 24px rgba(31,59,114,.14)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = SHADOW
        el.style.transform = 'none'
      }}
      >
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'rgba(31,59,114,.38)',
          }}>
            {CATEGORY_META[report.category]?.label ?? report.category}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: live ? 'rgba(150,193,30,.10)' : 'rgba(245,158,11,.08)',
            color: live ? '#96C11E' : '#d97706',
          }}>
            {live ? 'En direct' : 'Récent'}
          </span>
        </div>

        <div style={{
          fontFamily: F_TITLE, fontSize: 13.5, fontWeight: 800, color: NAVY,
          lineHeight: 1.3, marginBottom: 7,
        }}>{report.title}</div>

        <p style={{
          fontFamily: F_BODY, fontSize: 11, color: 'rgba(31,59,114,.42)',
          lineHeight: 1.6, margin: '0 0 auto',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>
          {report.description}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 12, marginTop: 12, borderTop: `1px solid ${BG}`,
        }}>
          <span style={{ fontFamily: F_BODY, fontSize: 10, color: 'rgba(31,59,114,.3)', fontWeight: 600 }}>
            {report.owner}
          </span>
          <span style={{ fontFamily: F_BODY, fontSize: 10, color: 'rgba(31,59,114,.28)' }} suppressHydrationWarning>
            {formatRelativeTime(report.lastRefresh)}
          </span>
        </div>
      </div>
    </a>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const [user,       setUser]       = useState<User | null>(null)
  const [greeting,   setGreeting]   = useState('')
  const [dateLabel,  setDateLabel]  = useState('')
  const [allowedIds, setAllowedIds] = useState<string[] | null>(null)

  useEffect(() => {
    setUser(getCurrentUser())
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir')
    setDateLabel(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    fetch('/api/report-permissions')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.allowed) setAllowedIds(d.allowed) })
      .catch(() => setAllowedIds(null))
  }, [])

  const visibleReports = allowedIds === null ? REPORTS : REPORTS.filter(r => allowedIds.includes(r.id))
  const pinned = visibleReports.filter(r => r.pinned)
  const recent = visibleReports.filter(r => !r.pinned).slice(0, 6)
  const unread = ALERTS.filter(a => !a.read)

  const card: React.CSSProperties = {
    background: CARD, borderRadius: 14, padding: '22px 24px',
    boxShadow: SHADOW,
  }

  return (
    <>
      <TopBar />
      <div style={{
        flex: 1, overflowY: 'auto', background: BG,
        padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20,
        fontFamily: F_BODY,
      }}>

        {/* ══ HERO ═══════════════════════════════════════════════════════════ */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>

          {/* Salutation */}
          <div>
            <h2 style={{
              fontFamily: F_TITLE, fontSize: 24, fontWeight: 800, color: NAVY,
              lineHeight: 1.1, margin: 0,
            }}>
              {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(31,59,114,.38)', margin: '5px 0 0', fontWeight: 500 }}>
              {dateLabel}
            </p>
          </div>

          <div style={{ width: 1, height: 36, background: 'rgba(31,59,114,.1)', flexShrink: 0 }} />

          {/* KPIs */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Rapports',     value: visibleReports.length },
              { label: 'Utilisateurs', value: PLATFORM_STATS.activeUsers  },
              { label: 'Sources',      value: PLATFORM_STATS.datasources  },
              { label: 'Alertes',      value: unread.length, alert: unread.length > 0 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: F_TITLE, fontSize: 26, fontWeight: 800, lineHeight: 1,
                  color: s.alert ? RED : NAVY,
                }}>{s.value}</div>
                <div style={{
                  fontSize: 9.5, color: 'rgba(31,59,114,.35)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 3,
                }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ BANDEAU ALERTES ════════════════════════════════════════════════ */}
        {unread.length > 0 && (
          <div style={{
            background: '#fff9f9', borderRadius: 10, padding: '11px 18px',
            border: `1px solid rgba(232,64,64,.12)`, borderLeft: `3px solid ${RED}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: RED }}>
                {unread.length} alerte{unread.length > 1 ? 's' : ''} active{unread.length > 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {unread.slice(0, 2).map(a => (
                  <span key={a.id} style={{
                    fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                    background: a.severity === 'critical' ? 'rgba(232,64,64,.07)' : 'rgba(245,158,11,.07)',
                    color: a.severity === 'critical' ? RED : '#d97706',
                  }}>{a.title}</span>
                ))}
              </div>
            </div>
            <Link href="/dashboard/alerts" style={{ fontSize: 11, color: NAVY, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Voir toutes →
            </Link>
          </div>
        )}

        {/* ══ GRILLE PRINCIPALE ══════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

          {/* ─ COLONNE GAUCHE ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Rapports épinglés */}
            <div style={card}>
              <SH label="Rapports épinglés"
                action={
                  <Link href="/dashboard/reports" style={{ fontSize: 11, color: NAVY, fontWeight: 700, textDecoration: 'none', opacity: .55 }}>
                    Bibliothèque →
                  </Link>
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
                {pinned.map(r => <PinnedCard key={r.id} report={r} />)}
              </div>
            </div>

            {/* Explorer par catégorie */}
            <div style={card}>
              <SH label="Explorer par catégorie" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {CATEGORIES.map(cat => {
                  const count = visibleReports.filter(r => r.category === cat.id).length
                  return (
                    <Link
                      key={cat.id}
                      href={`/dashboard/reports?category=${cat.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 8, padding: '18px 10px', borderRadius: 12, textAlign: 'center',
                        background: CARD, boxShadow: SHADOW, transition: 'all .18s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.boxShadow = '0 6px 24px rgba(31,59,114,.14)'
                        el.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.boxShadow = SHADOW
                        el.style.transform = 'none'
                      }}
                      >
                        <span style={{ fontFamily: F_TITLE, fontSize: 12, fontWeight: 800, color: NAVY }}>{cat.label}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                          background: 'rgba(150,193,30,.1)', color: '#5a7610',
                        }}>
                          {count} rapport{count > 1 ? 's' : ''}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Hub IA */}
            <div style={{
              ...card, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0, overflow: 'hidden',
                  background: 'rgba(150,193,30,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR"
                    style={{ width: 42, height: 42, objectFit: 'cover', objectPosition: 'center 30%' }} />
                </div>
                <div>
                  <h3 style={{ fontFamily: F_TITLE, fontSize: 15, fontWeight: 800, color: NAVY, margin: 0 }}>
                    Hub IA <span style={{ color: GREEN }}>JAMBAR</span>
                    <span style={{
                      marginLeft: 10, fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(150,193,30,.1)', color: '#5a7610', letterSpacing: '.05em', verticalAlign: 'middle',
                    }}>En ligne</span>
                  </h3>
                  <p style={{ fontSize: 12, color: 'rgba(31,59,114,.42)', margin: '4px 0 0' }}>
                    Assistant analytique · Rapports narratifs · Score 360°
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                <Link href="/dashboard/hub-ia" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                  borderRadius: 10, textDecoration: 'none',
                  background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700,
                  fontFamily: F_BODY,
                }}>Ouvrir JAMBAR →</Link>
                <Link href="/viewer/score360" style={{
                  display: 'inline-flex', alignItems: 'center', padding: '9px 18px',
                  borderRadius: 10, textDecoration: 'none',
                  background: '#f0f4fb',
                  color: 'rgba(31,59,114,.6)', fontSize: 12, fontWeight: 600,
                  fontFamily: F_BODY,
                }}>Score 360°</Link>
              </div>
            </div>

          </div>

          {/* ─ COLONNE DROITE ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Récemment ajoutés */}
            <div style={card}>
              <SH label="Récents" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recent.map((r, i) => (
                  <Link key={r.id} href={`/viewer/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                      borderBottom: i < recent.length - 1 ? `1px solid ${BG}` : 'none',
                      transition: 'opacity .14s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '.7'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
                    >
                      {/* Dot statut */}
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: r.status === 'live' ? '#16a34a' : '#f59e0b',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', marginTop: 2 }} suppressHydrationWarning>
                          {formatRelativeTime(r.lastRefresh)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Statut plateforme */}
            <div style={card}>
              <SH label="Statut plateforme" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Dashboard',       ok: true },
                  { label: 'Base de données', ok: true },
                  { label: 'API IA JAMBAR',   ok: true },
                  { label: 'Flux de données', ok: true },
                ].map(s => (
                  <div key={s.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 9, background: BG,
                  }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(31,59,114,.6)' }}>{s.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: s.ok ? '#16a34a' : '#E84040',
                      }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.ok ? '#16a34a' : '#E84040' }}>
                        {s.ok ? 'Opérationnel' : 'Interruption'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
        <p style={{
          textAlign: 'center', fontSize: 10.5, color: 'rgba(31,59,114,.22)',
          fontWeight: 500, paddingBottom: 4, margin: 0,
        }}>
          © 2025 SEN&#x27;EAU — Société Nationale des Eaux du Sénégal &nbsp;·&nbsp; BI Platform &nbsp;·&nbsp;
          Conçu par <strong style={{ color: 'rgba(31,59,114,.35)' }}>Asta Niang</strong> — Data Engineer
        </p>

      </div>
    </>
  )
}
