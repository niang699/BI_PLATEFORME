'use client'
import Link from 'next/link'
import { Report, CATEGORY_META, formatRelativeTime } from '@/lib/mockData'

interface Props { report: Report; compact?: boolean }

const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'

const STATUS_CONFIG = {
  live:   { label: 'En direct', color: '#16a34a', bg: 'rgba(22,163,74,.08)'  },
  recent: { label: 'Récent',    color: '#d97706', bg: 'rgba(217,119,6,.08)'  },
  stale:  { label: '> 24h',     color: '#E84040', bg: 'rgba(232,64,64,.08)'  },
}

export default function ReportCard({ report, compact = false }: Props) {
  const cat     = CATEGORY_META[report.category]
  const status  = STATUS_CONFIG[report.status]
  const href    = report.url === '#' ? '#' : `/viewer/${report.id}`
  const disabled = report.url === '#'

  /* ── Mode compact ─────────────────────────────────────────────────────── */
  if (compact) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}
        onClick={disabled ? e => e.preventDefault() : undefined}>
        <div style={{
          background: '#fff', borderRadius: 12,
          boxShadow: '0 1px 6px rgba(31,59,114,.07)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          transition: 'all .18s', cursor: disabled ? 'default' : 'pointer',
          fontFamily: F_BODY,
        }}
        onMouseEnter={e => { if (!disabled) { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = '0 4px 14px rgba(31,59,114,.10)' } }}
        onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = '0 1px 6px rgba(31,59,114,.07)' }}
        >
          {/* Dot statut */}
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: status.color,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C_NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {report.title}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginTop: 2 }} suppressHydrationWarning>
              {formatRelativeTime(report.lastRefresh)}
            </div>
          </div>
          {disabled && (
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.35)', background: '#f4f6fb', borderRadius: 6, padding: '2px 6px' }}>
              Bientôt
            </span>
          )}
        </div>
      </Link>
    )
  }

  /* ── Mode carte complète ─────────────────────────────────────────────── */
  return (
    <Link href={disabled ? '#' : href}
      style={{ textDecoration: 'none', display: 'block', position: 'relative', fontFamily: F_BODY }}
      onClick={disabled ? e => e.preventDefault() : undefined}>

      <div style={{
        background: '#fff', borderRadius: 14, padding: '22px',
        boxShadow: '0 2px 10px rgba(31,59,114,.10)',
        transition: 'all .2s', cursor: disabled ? 'default' : 'pointer',
        height: '100%', boxSizing: 'border-box',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          const d = e.currentTarget as HTMLDivElement
          d.style.boxShadow = '0 10px 32px rgba(31,59,114,.14)'
          d.style.transform = 'translateY(-2px)'
        }
      }}
      onMouseLeave={e => {
        const d = e.currentTarget as HTMLDivElement
        d.style.boxShadow = '0 2px 10px rgba(31,59,114,.10)'
        d.style.transform = 'none'
      }}
      >
        {/* Header : catégorie + statut */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
            color: 'rgba(31,59,114,.38)',
          }}>
            {cat.label ?? report.category}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            background: status.bg, color: status.color,
          }}>
            {status.label}
          </span>
        </div>

        {/* Titre */}
        <h3 style={{
          fontFamily: F_TITLE, fontSize: 15, fontWeight: 800, color: C_NAVY,
          lineHeight: 1.25, marginBottom: 8, letterSpacing: '-.01em',
        }}>
          {report.title}
        </h3>

        {/* Description */}
        <p style={{
          fontSize: 12, color: 'rgba(31,59,114,.48)', lineHeight: 1.65,
          marginBottom: 16, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>
          {report.description}
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 18 }}>
          {(report.tags ?? []).slice(0, 3).map(tag => (
            <span key={tag} style={{
              padding: '3px 10px', borderRadius: 99,
              fontSize: 10, fontWeight: 600,
              background: '#F4F6FB', color: 'rgba(31,59,114,.45)',
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 14, borderTop: '1px solid #F4F6FB',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(31,59,114,.38)', fontWeight: 600 }}>{report.owner}</span>
          <span style={{ fontSize: 11, color: 'rgba(31,59,114,.35)' }} suppressHydrationWarning>
            {formatRelativeTime(report.lastRefresh)}
          </span>
        </div>

        {/* Overlay bientôt */}
        {disabled && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            background: 'rgba(248,250,252,.9)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              padding: '8px 18px', borderRadius: 99,
              background: '#f4f6fb', fontSize: 11, fontWeight: 700,
              color: 'rgba(31,59,114,.45)',
            }}>
              Bientôt disponible
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
