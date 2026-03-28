'use client'
import { useState } from 'react'
import { ALERTS, formatRelativeTime, Alert } from '@/lib/mockData'
import TopBar from '@/components/TopBar'
import Link from 'next/link'

const SEV_META = {
  critical: { label: 'Critique',      color: '#E84040', bg: 'rgba(232,64,64,.07)',   dot: '🔴' },
  warning:  { label: 'Avertissement', color: '#f59e0b', bg: 'rgba(245,158,11,.07)',  dot: '🟡' },
  info:     { label: 'Information',   color: '#3b82f6', bg: 'rgba(59,130,246,.07)',  dot: '🔵' },
}

const RULES = [
  { name: 'Taux recouvrement critique', cond: '< 40%',    freq: 'Quotidien',    sev: 'critical' as const },
  { name: 'Impayés en hausse',          cond: '> +15%',   freq: 'Hebdomadaire', sev: 'warning'  as const },
  { name: 'Bascule segment Critique',   cond: 'Changement', freq: 'Temps réel', sev: 'warning'  as const },
]

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const shown    = filter === 'unread' ? alerts.filter(a => !a.read) : alerts
  const unreadNb = alerts.filter(a => !a.read).length

  const markAll = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  const markOne = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))

  return (
    <>
      <TopBar />

      <div style={{
        flex: 1, overflowY: 'auto',
        background: '#f8fafc',
        padding: '28px 32px',
        display: 'flex', flexDirection: 'column', gap: 24,
        fontFamily: "'Nunito', sans-serif",
      }}>

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          boxShadow: '0 2px 12px rgba(31,59,114,.08)',
          padding: '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: unreadNb > 0 ? 'rgba(232,64,64,.08)' : '#EEF2FF',
              border: `1px solid ${unreadNb > 0 ? 'rgba(232,64,64,.18)' : '#E0E7FF'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: unreadNb > 0 ? '#E84040' : '#1F3B72',
            }}>
              {unreadNb > 0 ? '◉' : '◎'}
            </div>
            <div>
              <h1 style={{
                fontFamily: "'Barlow Semi Condensed', sans-serif",
                fontSize: 22, fontWeight: 800, color: '#1F3B72', margin: 0,
                letterSpacing: '-.01em',
              }}>
                Centre d&apos;Alertes
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(31,59,114,.5)', fontWeight: 500, margin: '3px 0 0' }}>
                Surveillance des seuils et événements critiques
              </p>
            </div>
          </div>

          {/* Compteurs */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Total',        value: alerts.length,                              color: '#1F3B72' },
              { label: 'Non lues',     value: unreadNb,                                   color: '#E84040' },
              { label: 'Critiques',    value: alerts.filter(a => a.severity === 'critical').length, color: '#E84040' },
              { label: 'Avertissements', value: alerts.filter(a => a.severity === 'warning').length, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#f8fafc', borderRadius: 12, padding: '10px 18px', textAlign: 'center',
                border: '1px solid #e8edf5',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Barlow Semi Condensed',sans-serif" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(31,59,114,.45)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Règles d'alerte actives ───────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          boxShadow: '0 2px 12px rgba(31,59,114,.08)',
          padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: '#1F3B72', flexShrink: 0 }} />
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#1F3B72',
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>Règles d&apos;alerte actives</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {RULES.map(rule => {
              const m = SEV_META[rule.sev]
              return (
                <div key={rule.name} style={{
                  borderRadius: 12, padding: '14px 16px',
                  background: m.bg,
                  borderLeft: `4px solid ${m.color}`,
                  border: `1px solid ${m.color}20`,
                  borderLeftWidth: 4,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{rule.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(31,59,114,.5)', marginBottom: 2 }}>Condition : <strong>{rule.cond}</strong></div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)' }}>{rule.freq}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: `${m.color}15`, color: m.color, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                      {m.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Filtres + actions ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'unread'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '8px 18px', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                fontFamily: "'Nunito', sans-serif",
                outline: 'none', transition: 'all .15s',
                background: filter === f
                  ? 'linear-gradient(135deg,#1F3B72,#2B50A0)'
                  : '#fff',
                color: filter === f ? '#fff' : 'rgba(31,59,114,.6)',
                boxShadow: filter === f
                  ? '0 4px 14px rgba(31,59,114,.25)'
                  : '0 2px 8px rgba(31,59,114,.08)',
              }}>
                {f === 'all' ? `Toutes (${alerts.length})` : `Non lues (${unreadNb})`}
              </button>
            ))}
          </div>
          {unreadNb > 0 && (
            <button onClick={markAll} style={{
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: 10, padding: '7px 16px',
              fontSize: 12, fontWeight: 600, color: '#1F3B72',
              cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
              transition: 'all .15s', outline: 'none',
            }}>
              ✓ Tout marquer comme lu
            </button>
          )}
        </div>

        {/* ── Liste alertes ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: 16,
              boxShadow: '0 2px 12px rgba(31,59,114,.08)',
              padding: '64px 32px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', textAlign: 'center',
            }}>
              <span style={{ fontSize: 48, marginBottom: 14 }}>✅</span>
              <h3 style={{
                fontFamily: "'Barlow Semi Condensed', sans-serif",
                fontSize: 20, fontWeight: 800, color: '#1F3B72', margin: '0 0 8px',
              }}>
                Aucune alerte non lue
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)', margin: 0 }}>
                Toutes les alertes ont été lues.
              </p>
            </div>
          ) : shown.map(alert => {
            const m = SEV_META[alert.severity]
            return (
              <div key={alert.id} style={{
                background: '#fff', borderRadius: 14,
                boxShadow: !alert.read
                  ? '0 2px 12px rgba(31,59,114,.10)'
                  : '0 1px 6px rgba(31,59,114,.06)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
                borderLeft: `4px solid ${!alert.read ? m.color : '#e2e8f0'}`,
                opacity: alert.read ? 0.7 : 1,
                transition: 'all .15s',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{m.dot}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13, fontWeight: !alert.read ? 700 : 500,
                        color: '#1e293b', marginBottom: 4,
                      }}>
                        {alert.title}
                        {!alert.read && (
                          <span style={{
                            marginLeft: 8, fontSize: 9, fontWeight: 800, padding: '2px 7px',
                            borderRadius: 20, background: `${m.color}15`, color: m.color,
                            letterSpacing: '.05em', textTransform: 'uppercase', verticalAlign: 'middle',
                          }}>{m.label}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(31,59,114,.5)', lineHeight: 1.6 }}>
                        {alert.message}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', marginBottom: 4 }} suppressHydrationWarning>
                        {formatRelativeTime(alert.timestamp)}
                      </div>
                      {alert.reportId && (
                        <Link href={`/viewer/${alert.reportId}`} style={{
                          fontSize: 11, color: '#1F3B72', fontWeight: 700,
                          textDecoration: 'none', display: 'block',
                        }}>
                          Voir rapport →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {!alert.read && (
                  <button onClick={() => markOne(alert.id)} style={{
                    background: 'none', border: '1px solid #e2e8f0',
                    borderRadius: 8, padding: '4px 10px',
                    cursor: 'pointer', fontSize: 12, color: 'rgba(31,59,114,.4)',
                    fontWeight: 600, flexShrink: 0, outline: 'none', transition: 'all .15s',
                    fontFamily: "'Nunito', sans-serif",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f0f6ff'; (e.currentTarget as HTMLButtonElement).style.color = '#1F3B72' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(31,59,114,.4)' }}
                  title="Marquer comme lu">
                    ✓
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <p style={{
          textAlign: 'center', fontSize: 11,
          color: 'rgba(31,59,114,.25)', fontWeight: 500, paddingTop: 8,
        }}>
          © 2025 SEN&#39;EAU &nbsp;·&nbsp; Conçu par <strong style={{ color: 'rgba(31,59,114,.4)' }}>Asta Niang</strong> — Data Engineer
        </p>
      </div>
    </>
  )
}
