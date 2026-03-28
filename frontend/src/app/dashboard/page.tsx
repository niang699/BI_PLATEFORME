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

const NAVY  = '#1F3B72'
const GREEN = '#96C11E'
const RED   = '#E84040'

/* ── Titre de section uniforme ─────────────────────────────────────────── */
function SH({ label, accent, action }: { label: string; accent: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 4, height: 20, borderRadius: 99, background: accent, display: 'inline-block', flexShrink: 0 }} />
        <h3 style={{
          fontFamily: "'Barlow Semi Condensed',sans-serif",
          fontSize: 13, fontWeight: 800, color: NAVY,
          margin: 0, textTransform: 'uppercase', letterSpacing: '.06em',
        }}>{label}</h3>
      </div>
      {action}
    </div>
  )
}

/* ── Icône de catégorie (emoji ou image) ───────────────────────────────── */
function CatIcon({ cat, size }: { cat: typeof CATEGORY_META[keyof typeof CATEGORY_META]; size: number }) {
  if (cat.imgSrc) return <img src={cat.imgSrc} alt={cat.label} style={{ width: size, height: size, objectFit: 'contain' }} />
  return <span style={{ fontSize: size * 0.7 }}>{cat.icon}</span>
}

/* ── Carte rapport épinglé ─────────────────────────────────────────────── */
function PinnedCard({ report }: { report: typeof REPORTS[0] }) {
  const cat  = CATEGORY_META[report.category]
  const live = report.status === 'live'
  const href = report.url === '#' ? '#' : `/viewer/${report.id}`

  return (
    <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: '#fff', borderRadius: 13,
        border: '1px solid #eaf0f9', borderTop: `3px solid ${NAVY}22`,
        padding: '15px 17px',
        boxShadow: '0 2px 8px rgba(31,59,114,.05)',
        transition: 'all .18s', height: '100%', boxSizing: 'border-box' as const,
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow='0 8px 24px rgba(31,59,114,.11)'; el.style.transform='translateY(-2px)'; el.style.borderTopColor=NAVY+'55' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow='0 2px 8px rgba(31,59,114,.05)'; el.style.transform='none'; el.style.borderTopColor=NAVY+'22' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(31,59,114,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CatIcon cat={cat} size={22} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99, letterSpacing: '.05em',
            background: live ? 'rgba(5,150,105,.1)' : 'rgba(245,158,11,.1)',
            color:      live ? '#059669' : '#d97706' }}>
            {live ? '● EN DIRECT' : '● RÉCENT'}
          </span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, lineHeight: 1.35, marginBottom: 5,
          fontFamily: "'Barlow Semi Condensed',sans-serif" }}>{report.title}</div>
        <p style={{ fontSize: 10.5, color: 'rgba(31,59,114,.42)', lineHeight: 1.55, margin: '0 0 12px',
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {report.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 10, color: 'rgba(31,59,114,.32)', fontWeight: 600 }}>{report.owner}</span>
          <span style={{ fontSize: 10, color: 'rgba(31,59,114,.28)' }} suppressHydrationWarning>◷ {formatRelativeTime(report.lastRefresh)}</span>
        </div>
      </div>
    </a>
  )
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => { setUser(getCurrentUser()) }, [])

  const pinned = REPORTS.filter(r => r.pinned)
  const recent = REPORTS.filter(r => !r.pinned).slice(0, 5)
  const unread = ALERTS.filter(a => !a.read)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  /* Style de carte section uniforme */
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, padding: '22px 24px',
    boxShadow: '0 2px 12px rgba(31,59,114,.06)',
  }

  return (
    <>
      <TopBar />
      <div style={{
        flex: 1, overflowY: 'auto', background: '#f4f6fb',
        padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: 20,
        fontFamily: "'Nunito', sans-serif",
      }}>

        {/* ══ HERO ══════════════════════════════════════════════════════════ */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14, flexShrink: 0,
              background: '#EEF2FF', border: '1px solid #E0E7FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: NAVY,
              fontFamily: "'Barlow Semi Condensed', sans-serif",
            }}>{user?.avatar ?? '?'}</div>
            <div>
              <h2 style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontSize: 21, fontWeight: 800, color: NAVY, lineHeight: 1.1, margin: 0 }}>
                {greeting()}, {user?.name.split(' ')[0]} 👋
              </h2>
              <p style={{ fontSize: 12, color: 'rgba(31,59,114,.4)', margin: '4px 0 0', fontWeight: 500 }}>
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div style={{ width: 1, height: 40, background: '#eaf0f9', flexShrink: 0 }} />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Rapports',     value: PLATFORM_STATS.totalReports, icon: '▤', color: NAVY      },
              { label: 'Utilisateurs', value: PLATFORM_STATS.activeUsers,  icon: '◉', color: GREEN     },
              { label: 'Sources',      value: PLATFORM_STATS.datasources,  icon: '◫', color: '#0891B2' },
              { label: 'Alertes',      value: unread.length,               icon: '◎', color: unread.length > 0 ? RED : '#16a34a' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #eaf0f9',
              }}>
                <span style={{ fontSize: 15, color: s.color }}>{s.icon}</span>
                <div>
                  <div style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: NAVY, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(31,59,114,.38)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ ALERTE ════════════════════════════════════════════════════════ */}
        {unread.length > 0 && (
          <div style={{
            background: '#fff9f9', borderRadius: 12, padding: '12px 18px',
            border: '1px solid rgba(232,64,64,.15)', borderLeft: `4px solid ${RED}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, color: RED }}>◉</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: RED }}>
                {unread.length} alerte{unread.length > 1 ? 's' : ''} active{unread.length > 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {unread.slice(0, 2).map(a => (
                  <span key={a.id} style={{
                    fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                    background: a.severity === 'critical' ? 'rgba(232,64,64,.08)' : 'rgba(245,158,11,.08)',
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* ─── COLONNE GAUCHE ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Rapports épinglés */}
            <div style={card}>
              <SH label="Rapports épinglés" accent={GREEN}
                action={<Link href="/dashboard/reports" style={{ fontSize: 11, color: GREEN, fontWeight: 700, textDecoration: 'none' }}>Bibliothèque →</Link>} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {pinned.map(r => <PinnedCard key={r.id} report={r} />)}
              </div>
            </div>

            {/* Explorer par catégorie */}
            <div style={card}>
              <SH label="Explorer par catégorie" accent="#0891B2" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {CATEGORIES.map(cat => {
                  const count = REPORTS.filter(r => r.category === cat.id).length
                  const meta  = CATEGORY_META[cat.id]
                  return (
                    <Link key={cat.id} href="/dashboard/reports" style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                      padding: '16px 10px', borderRadius: 12, textDecoration: 'none',
                      background: '#f8fafc', border: '1px solid #eaf0f9', transition: 'all .18s',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background='#eef2fb'; el.style.borderColor='rgba(31,59,114,.18)'; el.style.transform='translateY(-2px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background='#f8fafc'; el.style.borderColor='#eaf0f9'; el.style.transform='none' }}
                    >
                      <CatIcon cat={meta} size={28} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textAlign: 'center' }}>{cat.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(150,193,30,.12)', color: GREEN }}>
                        {count} rapport{count > 1 ? 's' : ''}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Hub IA — pleine largeur */}
            <div style={{ ...card, borderTop: `3px solid ${GREEN}`, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, overflow: 'hidden',
                  background: '#f4f6fb', border: '1px solid #e8edf5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width: 46, height: 46, objectFit: 'cover', objectPosition: 'center 30%' }} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>
                    Hub IA <span style={{ color: GREEN }}>JAMBAR</span>
                    <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                      background: 'rgba(150,193,30,.12)', color: '#4d6610', letterSpacing: '.04em', verticalAlign: 'middle' }}>
                      En ligne
                    </span>
                  </h3>
                  <p style={{ fontSize: 12, color: 'rgba(31,59,114,.45)', margin: '3px 0 0', fontWeight: 500 }}>
                    Assistant analytique · Rapports narratifs · Score 360°
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
                <Link href="/dashboard/hub-ia" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                  borderRadius: 10, textDecoration: 'none',
                  background: 'linear-gradient(135deg,#1F3B72,#2B50A0)',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  boxShadow: '0 3px 10px rgba(31,59,114,.22)',
                }}>Ouvrir JAMBAR →</Link>
                <Link href="/viewer/score360" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                  borderRadius: 10, textDecoration: 'none',
                  background: '#f4f6fb', border: '1px solid #e8edf5',
                  color: 'rgba(31,59,114,.65)', fontSize: 12, fontWeight: 600,
                }}>Score Client 360°</Link>
              </div>
            </div>

          </div>

          {/* ─── COLONNE DROITE ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Récemment ajoutés */}
            <div style={card}>
              <SH label="Récemment ajoutés" accent="#7C3AED" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recent.map((r, i) => {
                  const cat = CATEGORY_META[r.category]
                  return (
                    <Link key={r.id} href={`/viewer/${r.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 11, padding: '10px 6px',
                        borderBottom: i < recent.length - 1 ? '1px solid #f1f5f9' : 'none',
                        borderRadius: 8, transition: 'background .14s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'rgba(31,59,114,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CatIcon cat={cat} size={22} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.title}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.38)', marginTop: 2 }} suppressHydrationWarning>
                            {formatRelativeTime(r.lastRefresh)}
                          </div>
                        </div>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: r.status === 'live' ? '#059669' : '#f59e0b' }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Activité récente */}
            <div style={card}>
              <SH label="Activité récente" accent="#D97706" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { icon: '✦', text: 'Score 360° recalculé',         time: '2h',    c: GREEN     },
                  { icon: '↻', text: 'Facturation mise à jour',      time: '15min', c: '#60a5fa' },
                  { icon: '⚡', text: 'Alerte DT Est déclenchée',    time: '2h',    c: RED       },
                  { icon: '◈', text: 'Rapport Facturation consulté', time: '4h',    c: '#60a5fa' },
                  { icon: '◉', text: 'Connexion utilisateur',        time: '5h',    c: '#a78bfa' },
                ].map((item, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${item.c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: item.c }}>
                      {item.icon}
                    </div>
                    <span style={{ flex: 1, fontSize: 11.5, color: 'rgba(31,59,114,.6)', fontWeight: 500, lineHeight: 1.4 }}>{item.text}</span>
                    <span style={{ fontSize: 9.5, color: 'rgba(31,59,114,.28)', whiteSpace: 'nowrap', fontWeight: 600 }}>il y a {item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Statut plateforme */}
            <div style={card}>
              <SH label="Statut plateforme" accent={GREEN} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Dashboard',       ok: true },
                  { label: 'Base de données', ok: true },
                  { label: 'API IA JAMBAR',   ok: true },
                  { label: 'Flux de données', ok: true },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: '#f8fafc' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(31,59,114,.65)' }}>{s.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                      background: s.ok ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
                      color: s.ok ? '#16a34a' : '#dc2626' }}>
                      {s.ok ? '● Opérationnel' : '● Interruption'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
        <div style={{ textAlign: 'center', color: 'rgba(31,59,114,.25)', fontSize: 10.5, paddingBottom: 4, fontWeight: 500 }}>
          © 2025 SEN&#x27;EAU — Société Nationale des Eaux du Sénégal &nbsp;·&nbsp; BI Platform &nbsp;·&nbsp;
          Conçu par <strong style={{ color: 'rgba(31,59,114,.4)' }}>Asta Niang</strong> — Data Engineer
        </div>

      </div>
    </>
  )
}
