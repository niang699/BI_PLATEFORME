'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser, logout } from '@/lib/auth'
import { ALERTS, REPORTS, formatRelativeTime, ROLE_META } from '@/lib/mockData'
import type { User } from '@/lib/mockData'
import Link from 'next/link'
import { useSidebar } from '@/context/SidebarContext'

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/dashboard':             { title: 'Tableau de bord',  sub: 'Vue d\'ensemble'                      },
  '/dashboard/reports':     { title: 'Rapports',         sub: 'Bibliothèque de dashboards'           },
  '/dashboard/gouvernance': { title: 'Data Gouvernance', sub: 'Catalogue & qualité des données'      },
  '/dashboard/alerts':      { title: 'Alertes',          sub: 'Surveillance des seuils'              },
  '/dashboard/hub-ia':      { title: 'Hub IA JAMBAR',    sub: 'Assistant analytique SEN\'EAU'        },
  '/dashboard/admin':       { title: 'Administration',   sub: 'Accès & paramètres système'           },
}

interface TopBarProps { title?: string; subtitle?: string }

export default function TopBar(_props: TopBarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { toggle, isMobile } = useSidebar()
  const [user,       setUser]       = useState<User | null>(null)
  const [showNotifs, setShowNotifs] = useState(false)
  const [searchVal,  setSearchVal]  = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [dateStr,    setDateStr]    = useState('')

  useEffect(() => {
    setUser(getCurrentUser())
    const fmt = () => new Date().toLocaleDateString('fr-FR', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    })
    setDateStr(fmt())
    const t = setInterval(() => setDateStr(fmt()), 60_000)
    return () => clearInterval(t)
  }, [])

  const viewerReport = pathname.startsWith('/viewer/')
    ? REPORTS.find(r => r.id === pathname.split('/').pop())
    : null
  const meta = PAGE_META[pathname] ?? (viewerReport
    ? { title: viewerReport.title, sub: viewerReport.owner }
    : PAGE_META['/dashboard'])

  const unread    = ALERTS.filter(a => !a.read)
  const searchRes = searchVal.length > 1
    ? REPORTS.filter(r =>
        r.title.toLowerCase().includes(searchVal.toLowerCase()) ||
        (r.tags ?? []).some(t => t.toLowerCase().includes(searchVal.toLowerCase()))
      )
    : []

  return (
    <header className="topbar" style={{ gap: 16 }}>

      {/* Hamburger mobile */}
      <button onClick={toggle} className="tb-hamburger" aria-label="Menu" title="Menu">
        <span /><span /><span />
      </button>

      {/* Titre de page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 1, height: 28, background: '#E8EDF5', flexShrink: 0 }} className={isMobile ? 'tb-sep-hide' : ''} />
        <div>
          <div style={{
            fontFamily: "'Barlow Semi Condensed', sans-serif",
            fontSize: 15, fontWeight: 800, color: '#1F3B72', lineHeight: 1.1,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {pathname === '/dashboard/hub-ia' && (
              <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR"
                style={{ width: 16, height: 16, objectFit: 'cover', objectPosition: 'center 30%', borderRadius: 3 }} />
            )}
            {meta.title}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.38)', fontWeight: 500, marginTop: 1 }}>
            {meta.sub}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Date */}
      {dateStr && (
        <div style={{
          fontSize: 11, color: 'rgba(31,59,114,.35)', fontWeight: 600,
          fontFamily: "'Nunito', sans-serif", whiteSpace: 'nowrap',
        }} suppressHydrationWarning>
          {dateStr}
        </div>
      )}

      {/* Recherche */}
      <div style={{ position: 'relative' }}>
        <div className="search-bar" style={{ width: 220 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(31,59,114,.3)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder="Rechercher…"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          />
          {searchVal && (
            <button onClick={() => setSearchVal('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(31,59,114,.3)', padding: 0 }}>✕</button>
          )}
        </div>

        {showSearch && searchRes.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: '#fff', borderRadius: 12, border: '1px solid #E8EDF5',
            boxShadow: '0 8px 32px rgba(31,59,114,.10)', overflow: 'hidden', zIndex: 60,
          }}>
            {searchRes.slice(0, 6).map((r, i) => (
              <Link key={r.id} href={`/viewer/${r.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                  borderBottom: i < Math.min(searchRes.length, 6) - 1 ? '1px solid #f4f6fb' : 'none',
                  textDecoration: 'none', transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1F3B72', fontFamily: "'Nunito', sans-serif" }}>{r.title}</div>
                  <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginTop: 1, textTransform: 'capitalize', fontFamily: "'Nunito', sans-serif" }}>{r.category}</div>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: r.status === 'live' ? 'rgba(22,163,74,.1)' : 'rgba(245,158,11,.1)',
                  color: r.status === 'live' ? '#16a34a' : '#d97706',
                  fontFamily: "'Nunito', sans-serif",
                }}>
                  {r.status === 'live' ? 'En direct' : 'Récent'}
                </span>
              </Link>
            ))}
          </div>
        )}
        {showSearch && searchVal.length > 1 && searchRes.length === 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: '#fff', borderRadius: 12, border: '1px solid #E8EDF5',
            boxShadow: '0 8px 32px rgba(31,59,114,.10)', padding: '16px',
            zIndex: 60, textAlign: 'center',
            fontSize: 12, color: 'rgba(31,59,114,.4)', fontFamily: "'Nunito', sans-serif",
          }}>
            Aucun résultat pour «&nbsp;{searchVal}&nbsp;»
          </div>
        )}
      </div>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowNotifs(o => !o)}
          className="icon-btn"
          title="Notifications"
          style={{ position: 'relative' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unread.length > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#E84040', color: '#fff',
              fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Nunito', sans-serif",
            }}>{unread.length}</span>
          )}
        </button>

        {showNotifs && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setShowNotifs(false)} />
            <div className="tb-notif-panel animate-slide-up" style={{ fontFamily: "'Nunito', sans-serif" }}>
              <div className="tb-notif-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1F3B72' }}>Notifications</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: 'rgba(232,64,64,.08)', color: '#E84040',
                }}>
                  {unread.length} non lu{unread.length > 1 ? 'es' : 'e'}
                </span>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {ALERTS.slice(0, 5).map((alert, i) => (
                  <div key={alert.id} style={{
                    padding: '11px 18px',
                    borderBottom: i < 4 ? '1px solid #f4f6fb' : 'none',
                    background: !alert.read ? 'rgba(150,193,30,.03)' : 'transparent',
                    cursor: 'pointer', transition: 'background .15s',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                  onMouseLeave={e => (e.currentTarget.style.background = !alert.read ? 'rgba(150,193,30,.03)' : 'transparent')}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: alert.severity === 'critical' ? '#E84040' : alert.severity === 'warning' ? '#f59e0b' : '#0891B2',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: !alert.read ? 700 : 500, color: '#1F3B72',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{alert.title}</div>
                      <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginTop: 2 }} suppressHydrationWarning>
                        {formatRelativeTime(alert.timestamp)}
                      </div>
                    </div>
                    {!alert.read && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#96C11E', flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding: '11px 18px', borderTop: '1px solid #f4f6fb' }}>
                <Link href="/dashboard/alerts" onClick={() => setShowNotifs(false)}
                  style={{ fontSize: 12, color: '#1F3B72', fontWeight: 700, textDecoration: 'none' }}>
                  Voir toutes les alertes →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* User */}
      {user && (
        <div className="tb-user">
          <div className="tb-user-avatar" style={{ fontFamily: "'Nunito', sans-serif" }}>{user.avatar}</div>
          <div className="tb-user-info">
            <div className="tb-user-name" style={{ fontFamily: "'Nunito', sans-serif" }}>{user.name}</div>
            <div className="tb-user-role" style={{ fontFamily: "'Nunito', sans-serif" }}>
              {ROLE_META[user.role]?.label}{user.dt ? ` · ${user.dt}` : ''}
            </div>
          </div>
          <button className="tb-logout" title="Déconnexion"
            onClick={() => { logout(); router.push('/login') }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      )}
    </header>
  )
}
