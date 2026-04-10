'use client'
import { useState } from 'react'
import { ALERTS, formatRelativeTime, Alert } from '@/lib/mockData'
import TopBar from '@/components/TopBar'
import Link from 'next/link'
import { BellDot, AlertTriangle, Info, CheckCircle2, Bell } from 'lucide-react'

const C_NAVY  = '#1F3B72'
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const SHADOW  = '0 2px 10px rgba(31,59,114,.10)'

const SEV_META = {
  critical: { label: 'Critique',      color: '#E84040', bg: 'rgba(232,64,64,.07)',  icon: <AlertTriangle size={16} /> },
  warning:  { label: 'Avertissement', color: '#f59e0b', bg: 'rgba(245,158,11,.07)', icon: <AlertTriangle size={16} /> },
  info:     { label: 'Information',   color: '#3b82f6', bg: 'rgba(59,130,246,.07)', icon: <Info          size={16} /> },
}

const RULES = [
  { name: 'Taux recouvrement critique', cond: '< 40%',      freq: 'Quotidien',    sev: 'critical' as const },
  { name: 'Impayés en hausse',          cond: '> +15%',     freq: 'Hebdomadaire', sev: 'warning'  as const },
  { name: 'Bascule segment Critique',   cond: 'Changement', freq: 'Temps réel',   sev: 'warning'  as const },
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

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', fontFamily: F_BODY }}>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', padding: '28px 32px 24px', boxShadow: '0 1px 0 rgba(31,59,114,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: unreadNb > 0 ? 'rgba(232,64,64,.08)' : '#EEF2FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: unreadNb > 0 ? '#E84040' : C_NAVY,
              }}>
                {unreadNb > 0 ? <BellDot size={20} /> : <Bell size={20} />}
              </div>
              <div>
                <h1 style={{ fontFamily: F_TITLE, fontSize: 20, fontWeight: 800, color: C_NAVY, margin: 0, letterSpacing: '-.01em' }}>
                  Centre d&apos;Alertes
                </h1>
                <p style={{ fontSize: 11, color: 'rgba(31,59,114,.45)', fontWeight: 500, margin: '3px 0 0' }}>
                  Surveillance des seuils et événements critiques
                </p>
              </div>
            </div>

            {/* Compteurs */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total',           value: alerts.length,                                          color: C_NAVY    },
                { label: 'Non lues',        value: unreadNb,                                               color: '#E84040' },
                { label: 'Critiques',       value: alerts.filter(a => a.severity === 'critical').length,   color: '#E84040' },
                { label: 'Avertissements',  value: alerts.filter(a => a.severity === 'warning').length,    color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f7f9fd', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: F_TITLE }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CONTENU ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Règles actives */}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: SHADOW, padding: '20px 24px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: C_NAVY, letterSpacing: '.07em', textTransform: 'uppercase', margin: '0 0 14px' }}>
              Règles d&apos;alerte actives
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
              {RULES.map(rule => {
                const m = SEV_META[rule.sev]
                return (
                  <div key={rule.name} style={{ borderRadius: 12, padding: '14px 16px', background: m.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: m.color }}>{m.icon}
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{rule.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(31,59,114,.5)', marginBottom: 6 }}>Condition : <strong>{rule.cond}</strong></div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)' }}>{rule.freq}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${m.color}15`, color: m.color, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                        {m.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Filtres + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'unread'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '8px 18px', borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: F_BODY,
                  transition: 'all .15s',
                  background: filter === f ? C_NAVY : '#fff',
                  color: filter === f ? '#fff' : 'rgba(31,59,114,.55)',
                  boxShadow: filter === f ? '0 4px 14px rgba(31,59,114,.22)' : SHADOW,
                }}>
                  {f === 'all' ? `Toutes (${alerts.length})` : `Non lues (${unreadNb})`}
                </button>
              ))}
            </div>
            {unreadNb > 0 && (
              <button onClick={markAll} style={{
                background: '#f0f4fb', border: 'none', borderRadius: 10,
                padding: '8px 16px', fontSize: 12, fontWeight: 600, color: C_NAVY,
                cursor: 'pointer', fontFamily: F_BODY,
              }}>
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste alertes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: SHADOW, padding: '64px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <CheckCircle2 size={40} style={{ color: '#059669', marginBottom: 14 }} />
                <h3 style={{ fontFamily: F_TITLE, fontSize: 20, fontWeight: 800, color: C_NAVY, margin: '0 0 8px' }}>
                  Aucune alerte non lue
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)', margin: 0 }}>Toutes les alertes ont été lues.</p>
              </div>
            ) : shown.map(alert => {
              const m = SEV_META[alert.severity]
              return (
                <div key={alert.id} style={{
                  background: '#fff', borderRadius: 14,
                  boxShadow: !alert.read ? '0 2px 10px rgba(31,59,114,.10)' : '0 1px 6px rgba(31,59,114,.06)',
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  opacity: alert.read ? 0.65 : 1,
                  transition: 'opacity .15s',
                }}>
                  <div style={{ flexShrink: 0, marginTop: 2, color: !alert.read ? m.color : 'rgba(31,59,114,.25)' }}>
                    {m.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: !alert.read ? 700 : 500, color: '#1e293b', marginBottom: 4 }}>
                          {alert.title}
                          {!alert.read && (
                            <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: `${m.color}15`, color: m.color, letterSpacing: '.05em', textTransform: 'uppercase', verticalAlign: 'middle' }}>
                              {m.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(31,59,114,.5)', lineHeight: 1.6 }}>{alert.message}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', marginBottom: 4 }} suppressHydrationWarning>
                          {formatRelativeTime(alert.timestamp)}
                        </div>
                        {alert.reportId && (
                          <Link href={`/viewer/${alert.reportId}`} style={{ fontSize: 11, color: C_NAVY, fontWeight: 700, textDecoration: 'none', display: 'block' }}>
                            Voir rapport →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {!alert.read && (
                    <button onClick={() => markOne(alert.id)} aria-label="Marquer comme lu" style={{
                      background: '#f0f4fb', border: 'none', borderRadius: 8,
                      padding: '4px 10px', cursor: 'pointer', fontSize: 11,
                      color: 'rgba(31,59,114,.5)', fontWeight: 600, flexShrink: 0, fontFamily: F_BODY,
                    }}>Lu</button>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </>
  )
}
