'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout, getCurrentUser } from '@/lib/auth'
import { ROLE_META, ALERTS, User } from '@/lib/mockData'
import { useSidebar } from '@/context/SidebarContext'

const NAV = [
  { href: '/dashboard',             label: 'Accueil'          },
  { href: '/dashboard/reports',     label: 'Rapports'         },
  { href: '/dashboard/gouvernance', label: 'Data Gouvernance' },
  { href: '/dashboard/alerts',      label: 'Alertes'          },
  { href: '/dashboard/hub-ia',      label: 'Hub IA JAMBAR', jambar: true },
  { href: '/dashboard/admin',       label: 'Administration'   },
]

const QUICK = [
  { href: '/viewer/facturation',    label: 'Facturation'  },
  { href: '/viewer/score360',       label: 'Score 360°'   },
  { href: '/viewer/suivi-releveur', label: 'Releveurs'    },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const { open, isMobile, toggle, close } = useSidebar()

  useEffect(() => { setUser(getCurrentUser()) }, [])

  const unread  = ALERTS.filter(a => !a.read).length
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {isMobile && open && (
        <div className="sidebar-backdrop" onClick={close} aria-hidden="true" />
      )}

      <aside className={`sidebar ${open ? '' : 'closed'} ${isMobile && open ? 'mobile-open' : ''}`}
        style={{ fontFamily: "'Nunito', sans-serif" }}>

        {/* Toggle */}
        <button onClick={toggle} className="sidebar-toggle"
          title={open ? 'Réduire' : 'Ouvrir'} aria-label="toggle sidebar">
          {open ? '‹' : '›'}
        </button>

        {/* Brand */}
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{
            background: 'rgba(255,255,255,.95)', borderRadius: 8,
            padding: '6px 10px', display: 'inline-flex', alignItems: 'center',
          }}>
            <img src="/logo_seneau.png" alt="SEN'EAU"
              style={{ height: 28, objectFit: 'contain', display: 'block' }} />
          </div>
          {open && (
            <div style={{
              marginTop: 8, fontSize: 8.5, fontWeight: 500, letterSpacing: '.01em',
              color: 'rgba(232,237,248,.28)', lineHeight: 1.45,
            }}>
              Plateforme d'Intelligence Artificielle<br />& Gouvernance des Données
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>

          {/* Section principale */}
          {open && (
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase',
              color: 'rgba(232,237,248,.22)', padding: '0 8px', marginBottom: 6,
            }}>Navigation</div>
          )}

          {NAV.map(item => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                title={!open ? item.label : undefined}
                style={{ position: 'relative', gap: open ? 10 : 0, justifyContent: open ? 'flex-start' : 'center' }}>

                {/* Indicateur actif */}
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 18, borderRadius: '0 3px 3px 0',
                    background: '#96C11E',
                  }} />
                )}

                {item.jambar ? (
                  <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR"
                    style={{ width: 16, height: 16, objectFit: 'cover', objectPosition: 'center 30%', borderRadius: 3, flexShrink: 0 }} />
                ) : (
                  /* Petit cercle comme seul "icône" */
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: active ? '#96C11E' : 'rgba(232,237,248,.25)',
                    transition: 'background .2s',
                  }} />
                )}

                <span className="nav-label" style={{ fontSize: 12.5, fontWeight: active ? 700 : 500 }}>
                  {item.label}
                </span>

                {item.label === 'Alertes' && unread > 0 && open && (
                  <span className="nav-badge" style={{ marginLeft: 'auto' }}>{unread}</span>
                )}
              </Link>
            )
          })}

          {/* Séparateur */}
          <div style={{ margin: '14px 8px', borderTop: '1px solid rgba(255,255,255,.06)' }} />

          {/* Raccourcis */}
          {open && (
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase',
              color: 'rgba(232,237,248,.22)', padding: '0 8px', marginBottom: 6,
            }}>Accès rapide</div>
          )}

          {QUICK.map(item => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                title={!open ? item.label : undefined}
                style={{ position: 'relative', gap: open ? 10 : 0, justifyContent: open ? 'flex-start' : 'center' }}>
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 18, borderRadius: '0 3px 3px 0', background: '#96C11E',
                  }} />
                )}
                <span style={{
                  width: 5, height: 5, borderRadius: 1.5, flexShrink: 0,
                  background: active ? '#96C11E' : 'rgba(232,237,248,.2)',
                }} />
                <span className="nav-label" style={{ fontSize: 12, fontWeight: 500 }}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        {user && (
          <div className="sidebar-user" title={!open ? user.name : undefined}
            style={{ borderTop: '1px solid rgba(255,255,255,.07)', padding: '12px 14px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#060e1f',
              background: 'linear-gradient(135deg, #96C11E, #7aa018)',
            }}>
              {user.avatar}
            </div>
            {open && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(232,237,248,.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(232,237,248,.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ROLE_META[user.role]?.label}{user.dt ? ` · ${user.dt}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => { logout(); router.push('/login') }}
                  title="Déconnexion"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(232,237,248,.25)', transition: 'color .2s', padding: 4,
                    fontSize: 13,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E84040')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(232,237,248,.25)')}
                >⏏</button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
