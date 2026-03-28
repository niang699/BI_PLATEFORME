'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser, logout } from '@/lib/auth'
import { ALERTS, REPORTS, formatRelativeTime, ROLE_META } from '@/lib/mockData'
import type { User } from '@/lib/mockData'
import Link from 'next/link'
import { useSidebar } from '@/context/SidebarContext'

/* ── Métadonnées par route ───────────────────────────────────────────────── */
const PAGE_META: Record<string, { title: string; sub: string; accent: string; icon: string }> = {
  '/dashboard':             { title: 'Tableau de bord',  sub: 'Vue d\'ensemble de la plateforme',       accent: '#1F3B72', icon: '⊞' },
  '/dashboard/reports':     { title: 'Rapports',         sub: 'Bibliothèque de dashboards & analyses',  accent: '#0891B2', icon: '▤' },
  '/dashboard/gouvernance': { title: 'Data Gouvernance', sub: 'Catalogue, indicateurs & qualité',       accent: '#7C3AED', icon: '⬡' },
  '/dashboard/alerts':      { title: 'Alertes',          sub: 'Surveillance des seuils et événements',  accent: '#E84040', icon: '◉' },
  '/dashboard/hub-ia':      { title: 'Hub IA   JAMBAR',    sub: 'Assistant Analytique SEN\'EAU',           accent: '#96C11E', icon: 'jambar' },
  '/dashboard/admin':       { title: 'Administration',   sub: 'Accès, rôles et paramètres système',     accent: '#D97706', icon: '⚙' },
}

/* ── Props (rétrocompatibilité — plus requis) ────────────────────────────── */
interface TopBarProps { title?: string; subtitle?: string }

export default function TopBar(_props: TopBarProps) {
  const pathname        = usePathname()
  const router          = useRouter()
  const { toggle, isMobile } = useSidebar()
  const [user, setUser]             = useState<User | null>(null)
  const [showNotifs, setShowNotifs] = useState(false)
  const [searchVal, setSearchVal]   = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [dateStr, setDateStr]       = useState('')

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
    ? { title: viewerReport.title, sub: viewerReport.owner, accent: '#0891B2', icon: '' }
    : PAGE_META['/dashboard'])
  const unread   = ALERTS.filter(a => !a.read)
  const searchRes = searchVal.length > 1
    ? REPORTS.filter(r =>
        r.title.toLowerCase().includes(searchVal.toLowerCase()) ||
        r.tags.some(t => t.toLowerCase().includes(searchVal.toLowerCase()))
      )
    : []

  return (
    <header className="topbar">

      {/* ━━ Hamburger mobile ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <button
        onClick={toggle}
        className="tb-hamburger"
        aria-label="Menu"
        title="Menu"
      >
        <span /><span /><span />
      </button>

      {/* ━━ SECTION GAUCHE — Identité plateforme ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="tb-brand">
        <div className="tb-brand-text">
          <div className="tb-brand-name">
            SEN<span style={{ color: 'var(--color-secondary)' }}>'</span>EAU
            <span className="tb-brand-badge">BI Platform</span>
          </div>
          <div className="tb-brand-tagline">Plateforme d'Intelligence Artificielle &amp; Gouvernance des Données</div>
        </div>
      </div>

      {/* ━━ Séparateur vertical ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="tb-sep" />

      {/* ━━ SECTION CENTRE — Titre de page dynamique ━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="tb-page">
        <div className="tb-page-dot" style={{ background: meta.accent, boxShadow: `0 0 8px ${meta.accent}88` }} />
        <div>
          <div className="tb-page-title">
            {pathname === '/dashboard/hub-ia' ? (
              <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width: 18, height: 18, objectFit: 'cover', objectPosition: 'center 30%', borderRadius: 3, verticalAlign: 'middle', marginRight: 6 }} />
            ) : meta.icon ? <>{meta.icon}&ensp;</> : null}
            {meta.title}
          </div>
          <div className="tb-page-sub">{meta.sub}</div>
        </div>
      </div>

      {/* ━━ Spacer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ flex: 1 }} />

      {/* ━━ Date ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {dateStr && (
        <div className="tb-date">
          <span style={{ opacity: .5, fontSize: 10 }}>◷</span>
          {dateStr}
        </div>
      )}

      {/* ━━ Barre de recherche ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ position: 'relative' }}>
        <div className="search-bar" style={{ width: 230 }}>
          <span style={{ color: 'var(--text-faint)', fontSize: 13, flexShrink: 0 }}>⌕</span>
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder="Rechercher un rapport…"
          />
          {searchVal && (
            <button onClick={() => setSearchVal('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-faint)', padding: 0 }}>✕</button>
          )}
        </div>

        {showSearch && searchRes.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,.12)', overflow: 'hidden', zIndex: 60,
          }}>
            {searchRes.map(r => (
              <Link key={r.id} href={`/viewer/${r.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                             borderBottom: '1px solid var(--border)', textDecoration: 'none', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: 15, color: '#1F3B72' }}>◈</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{r.category}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {showSearch && searchVal.length > 1 && searchRes.length === 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,.12)', padding: 16, zIndex: 60,
            textAlign: 'center', fontSize: 12, color: 'var(--text-faint)',
          }}>
            Aucun résultat pour «&nbsp;{searchVal}&nbsp;»
          </div>
        )}
      </div>

      {/* ━━ Notifications ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotifs(o => !o)} className="icon-btn tb-notif-btn" title="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unread.length > 0 && <span className="tb-notif-badge">{unread.length}</span>}
        </button>

        {showNotifs && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setShowNotifs(false)} />
            <div className="tb-notif-panel animate-slide-up">
              <div className="tb-notif-header">
                <span>Notifications</span>
                <span className="badge" style={{ background: 'rgba(232,64,64,.12)', color: '#E84040', fontSize: 10 }}>
                  {unread.length} non lues
                </span>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {ALERTS.slice(0, 5).map(alert => (
                  <div key={alert.id} style={{
                    padding: '11px 18px', borderBottom: '1px solid var(--border)',
                    background: !alert.read ? 'rgba(150,193,30,.04)' : 'transparent',
                    cursor: 'pointer', transition: 'background .15s',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}
                       onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fc')}
                       onMouseLeave={e => (e.currentTarget.style.background = !alert.read ? 'rgba(150,193,30,.04)' : 'transparent')}>
                    <span style={{ fontSize: 11, marginTop: 2, flexShrink: 0 }}>
                      {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: !alert.read ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }} suppressHydrationWarning>
                        {formatRelativeTime(alert.timestamp)}
                      </div>
                    </div>
                    {!alert.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#96C11E', flexShrink: 0, marginTop: 4 }} />}
                  </div>
                ))}
              </div>
              <div style={{ padding: '11px 18px', borderTop: '1px solid var(--border)' }}>
                <Link href="/dashboard/alerts" onClick={() => setShowNotifs(false)}
                      style={{ fontSize: 12, color: '#1F3B72', fontWeight: 600, textDecoration: 'none' }}>
                  Voir toutes les alertes →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ━━ User chip ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {user && (
        <div className="tb-user">
          <div className="tb-user-avatar">{user.avatar}</div>
          <div className="tb-user-info">
            <div className="tb-user-name">{user.name}</div>
            <div className="tb-user-role">
              {ROLE_META[user.role]?.label}{user.dt ? ` · ${user.dt}` : ''}
            </div>
          </div>
          <button
            className="tb-logout"
            title="Déconnexion"
            onClick={() => { logout(); router.push('/login') }}
          >
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
