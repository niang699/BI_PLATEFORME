'use client'
import Link from 'next/link'
import { Report, CATEGORY_META, formatRelativeTime } from '@/lib/mockData'

interface Props {
  report: Report
  compact?: boolean
}

const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'

const STATUS_CONFIG = {
  live:   { label: 'En direct', color: '#96C11E', bg: 'rgba(150,193,30,.12)', dot: '#96C11E' },
  recent: { label: 'Récent',    color: '#f59e0b', bg: 'rgba(245,158,11,.12)', dot: '#f59e0b' },
  stale:  { label: '> 24h',     color: '#E84040', bg: 'rgba(232,64,64,.12)',  dot: '#E84040' },
}

export default function ReportCard({ report, compact = false }: Props) {
  const cat     = CATEGORY_META[report.category]
  const status  = STATUS_CONFIG[report.status]
  const href    = report.url === '#' ? '#' : `/viewer/${report.id}`
  const disabled = report.url === '#'

  /* ── Mode compact (sidebar / liste latérale) ──────────────────────────── */
  if (compact) {
    return (
      <Link href={href}
        style={{ textDecoration: 'none', display: 'block' }}
        onClick={disabled ? e => e.preventDefault() : undefined}>
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #e8edf5',
          boxShadow: '0 1px 4px rgba(31,59,114,.05)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
          transition: 'all .2s', cursor: disabled ? 'default' : 'pointer',
          fontFamily: F_BODY,
        }}
        onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(31,59,114,.10)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(31,59,114,.18)' } }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(31,59,114,.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#e8edf5' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
            background: '#f4f6fb', border: '1px solid #e8edf5',
          }}>
            {cat.imgSrc
              ? <img src={cat.imgSrc} alt={cat.label} style={{ width: 22, height: 22, objectFit: 'contain' }} />
              : cat.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {report.title}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(31,59,114,.45)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, fontFamily: F_BODY }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.dot, flexShrink: 0, display: 'inline-block' }} />
              <span suppressHydrationWarning>{formatRelativeTime(report.lastRefresh)}</span>
            </div>
          </div>
          {disabled && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)',
              border: '1px solid #e8edf5', borderRadius: 6, padding: '2px 6px',
              whiteSpace: 'nowrap', fontFamily: F_BODY,
            }}>
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
        background: '#fff', borderRadius: 16, padding: '20px',
        border: '1px solid #e8edf5',
        boxShadow: '0 2px 8px rgba(31,59,114,.06)',
        transition: 'all .22s', cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={e => { if (!disabled) { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = '0 8px 28px rgba(31,59,114,.12)'; d.style.borderColor = 'rgba(31,59,114,.20)'; d.style.transform = 'translateY(-2px)' } }}
      onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = '0 2px 8px rgba(31,59,114,.06)'; d.style.borderColor = '#e8edf5'; d.style.transform = 'none' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            background: '#f4f6fb', border: '1px solid #e8edf5',
          }}>
            {cat.imgSrc
              ? <img src={cat.imgSrc} alt={cat.label} style={{ width: 28, height: 28, objectFit: 'contain' }} />
              : cat.icon}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {report.pinned && (
              <span style={{ fontSize: 11, color: '#96C11E' }}>✦</span>
            )}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 99,
              fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
              background: status.bg, color: status.color,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.dot, flexShrink: 0 }} />
              {status.label}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: F_TITLE, fontSize: 14, fontWeight: 800, color: C_NAVY,
          lineHeight: 1.3, marginBottom: 6, letterSpacing: '-.01em',
        }}>
          {report.title}
        </h3>
        <p style={{
          fontFamily: F_BODY, fontSize: 12, color: 'rgba(31,59,114,.5)', lineHeight: 1.6,
          marginBottom: 14, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
        }}>
          {report.description}
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {report.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{
              padding: '2px 9px', borderRadius: 99,
              fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
              background: '#f4f6fb', color: 'rgba(31,59,114,.5)',
              border: '1px solid #e8edf5',
            }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 12, borderTop: '1px solid #f1f5f9',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }}>{report.owner}</span>
          <span style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }} suppressHydrationWarning>
            ◷ {formatRelativeTime(report.lastRefresh)}
          </span>
        </div>

        {/* Overlay bientôt disponible */}
        {disabled && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16,
            background: 'rgba(248,250,252,.88)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              padding: '7px 16px', borderRadius: 99, border: '1px solid #e8edf5',
              background: '#fff', fontSize: 11, fontWeight: 700,
              color: 'rgba(31,59,114,.45)', fontFamily: F_BODY,
            }}>
              Bientôt disponible
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
