'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout, getCurrentUser } from '@/lib/auth'
import { ROLE_META, ALERTS, User } from '@/lib/mockData'
import { useSidebar } from '@/context/SidebarContext'

const NAV = [
  { href: '/dashboard',              icon: '⊞',  label: 'Accueil'          },
  { href: '/dashboard/reports',      icon: '▤',  label: 'Rapports'         },
  { href: '/dashboard/gouvernance',  icon: '⬡',  label: 'Data Gouvernance' },
  { href: '/dashboard/alerts',       icon: '◉',  label: 'Alertes'          },
  { href: '/dashboard/hub-ia',       icon: 'jambar', label: 'Hub IA   JAMBAR'  },
  { href: '/dashboard/admin',        icon: '⚙',  label: 'Administration'   },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const { open, isMobile, toggle, close } = useSidebar()

  useEffect(() => { setUser(getCurrentUser()) }, [])

  const unread = ALERTS.filter(a => !a.read).length

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Backdrop mobile — cliquable pour fermer */}
      {isMobile && open && (
        <div className="sidebar-backdrop" onClick={close} aria-hidden="true" />
      )}

    <aside className={`sidebar ${open ? '' : 'closed'} ${isMobile && open ? 'mobile-open' : ''}`}>

      {/* Toggle button */}
      <button
        onClick={toggle}
        className="sidebar-toggle"
        title={open ? 'Réduire la navigation' : 'Ouvrir la navigation'}
        aria-label="toggle sidebar"
      >
        {open ? '‹' : '›'}
      </button>

      {/* Brand — logo officiel SEN'EAU horizontal */}
      <div className="sidebar-brand" style={{ gap: 0, flexDirection: 'column', alignItems: 'flex-start', padding: '14px 16px 10px' }}>
        {/* Logo dans un cadre blanc arrondi (fond sombre de la sidebar) */}
        <div style={{
          background: 'rgba(255,255,255,0.96)',
          borderRadius: 8,
          padding: '5px 10px',
          display: 'inline-flex',
          alignItems: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          transition: 'opacity .3s',
        }}>
          <img
            src="/logo_seneau.png"
            alt="SEN'EAU"
            style={{ height: 30, objectFit: 'contain', display: 'block' }}
          />
        </div>
        {/* Sous-label plateforme */}
        <div className="sidebar-brand-text" style={{ marginTop: 6 }}>
          <div style={{ color: 'rgba(232,237,248,.4)', fontSize: 9, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase' }}>
            BI Platform
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <div className="sidebar-section-label">Navigation</div>

        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
            title={!open ? item.label : undefined}
          >
            <span className="nav-icon">
              {item.icon === 'jambar' ? (
                <img
                  src="/jambar_ia_simple_icon.svg"
                  alt="JAMBAR"
                  style={{ width: 18, height: 18, objectFit: 'cover', objectPosition: 'center 30%', borderRadius: 4, verticalAlign: 'middle' }}
                />
              ) : item.icon}
            </span>
            <span className="nav-label">{item.label}</span>
            {item.label === 'Alertes' && unread > 0 && (
              <span className="nav-badge">{unread}</span>
            )}
          </Link>
        ))}

        {/* Séparateur */}
        <div style={{ margin: '10px 20px' }} className="glow-divider" />

        {/* Rapports rapides */}
        <div className="sidebar-section-label">Rapports rapides</div>
        {[
          { href: '/viewer/facturation',   icon: '◈', label: 'Facturation'    },
          { href: '/viewer/score360',      icon: '◎', label: 'Score 360°'     },
          { href: '/viewer/suivi-releveur',icon: '◷', label: 'Releveurs'      },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
            title={!open ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Statut plateforme */}
      <div className="sidebar-status">
        {open && (
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(232,237,248,.3)', marginBottom: 8 }}>
            Statut Plateforme
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Dashboard',   ok: true  },
            { label: 'Base données',ok: true  },
            { label: 'IA API',      ok: true  },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={s.label}>
              <span className={`status-dot ${s.ok ? 'live' : 'stale'}`} />
              {open && (
                <span style={{ fontSize: 11, color: 'rgba(232,237,248,.5)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {s.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* User */}
      {user && (
        <div className="sidebar-user" title={!open ? user.name : undefined}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#060e1f',
            background: 'linear-gradient(135deg, #96C11E, #7aa018)',
            boxShadow: '0 2px 10px rgba(150,193,30,.3)',
          }}>
            {user.avatar}
          </div>

          {open && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ROLE_META[user.role]?.label}{user.dt ? ` · ${user.dt}` : ''}
                </div>
              </div>
              <button
                onClick={() => { logout(); router.push('/login') }}
                title="Déconnexion"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'rgba(232,237,248,.3)', transition: 'color .2s', padding: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#E84040')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(232,237,248,.3)')}
              >
                ⏏
              </button>
            </>
          )}
        </div>
      )}
    </aside>
    </>
  )
}
