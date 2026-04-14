'use client'
import { useState } from 'react'
import TopBar from '@/components/TopBar'
import GenerateurRapportPDF from '@/components/GenerateurRapportPDF'
import RapportsPlanifiesPanel from '@/components/RapportsPlanifiesPanel'
import { FileText, CalendarClock, Zap, Clock3 } from 'lucide-react'

type Tab = 'generate' | 'schedule'

const TABS: { id: Tab; label: string; sub: string; Icon: React.ElementType; color: string; accentBg: string }[] = [
  {
    id: 'generate', label: 'Générer maintenant', sub: 'Rapport PDF sur données réelles',
    Icon: FileText, color: '#1F3B72', accentBg: 'rgba(31,59,114,.07)',
  },
  {
    id: 'schedule', label: 'Planifier', sub: 'Envoi automatique par email',
    Icon: CalendarClock, color: '#96C11E', accentBg: 'rgba(150,193,30,.07)',
  },
]

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function SelfServicePage() {
  const [tab, setTab] = useState<Tab>('generate')

  const active = TABS.find(t => t.id === tab)!

  return (
    <>
      <TopBar />

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', fontFamily: "'Nunito', sans-serif" }}>

        {/* ══ HERO HEADER ══════════════════════════════════════════════════ */}
        <div style={{
          background: 'linear-gradient(135deg, #1F3B72 0%, #162d58 60%, #0e1f3d 100%)',
          padding: '32px 36px 0',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Cercles décoratifs */}
          <div style={{
            position: 'absolute', top: -50, right: -50,
            width: 240, height: 240, borderRadius: '50%',
            background: 'rgba(150,193,30,.06)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: '45%',
            width: 120, height: 120, borderRadius: '50%',
            background: 'rgba(150,193,30,.04)', pointerEvents: 'none',
          }} />

          {/* Titre & badges */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28, position: 'relative', flexWrap: 'wrap' }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14, flexShrink: 0,
              background: 'rgba(150,193,30,.14)', border: '1px solid rgba(150,193,30,.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={22} style={{ color: '#96C11E' }} />
            </div>

            <div style={{ flex: 1 }}>
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 800, color: '#fff',
                fontFamily: "'Barlow Semi Condensed', sans-serif", letterSpacing: '-.01em',
              }}>
                Rapports Self-Service
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(232,237,248,.5)', fontWeight: 500 }}>
                Générez à la demande ou planifiez vos rapports BI en toute autonomie
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { icon: '✨', label: 'IA Générative' },
                { icon: '📧', label: 'Email automatique' },
                { icon: '📊', label: 'Excel / HTML' },
              ].map(b => (
                <span key={b.label} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 20, padding: '4px 12px',
                  fontSize: 11, fontWeight: 600, color: 'rgba(232,237,248,.6)',
                }}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Tabs navigation ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 3 }}>
            {TABS.map(t => {
              const isActive = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '13px 24px',
                    background: isActive ? '#f8fafc' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    borderRadius: '10px 10px 0 0',
                    transition: 'all .18s',
                    fontFamily: "'Nunito', sans-serif",
                    position: 'relative',
                    opacity: isActive ? 1 : .55,
                  }}>
                  {isActive && (
                    <span style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      width: 32, height: 3, borderRadius: '0 0 4px 4px',
                      background: t.id === 'generate' ? '#96C11E' : '#96C11E',
                    }} />
                  )}
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? t.accentBg : 'rgba(255,255,255,.07)',
                    transition: 'background .18s',
                  }}>
                    <t.Icon size={14} style={{ color: isActive ? t.color : 'rgba(232,237,248,.55)' }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700,
                      color: isActive ? '#1F3B72' : 'rgba(232,237,248,.75)' }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 500, marginTop: 1,
                      color: isActive ? 'rgba(31,59,114,.42)' : 'rgba(232,237,248,.38)' }}>
                      {t.sub}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ══ CONTENU ══════════════════════════════════════════════════════ */}
        <div style={{ padding: '28px 36px', minHeight: 'calc(100vh - 260px)' }}>

          {/* Bandeau contextuel */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
            padding: '13px 18px', borderRadius: 12,
            background: active.accentBg,
            border: `1px solid ${active.color}18`,
          }}>
            <active.Icon size={15} style={{ color: active.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: active.color }}>{active.label} — </span>
              <span style={{ fontSize: 12, color: 'rgba(31,59,114,.45)' }}>
                {tab === 'generate'
                  ? "Sélectionnez le type de rapport et les indicateurs — les données réelles sont extraites et le PDF généré instantanément."
                  : "Définissez la fréquence et les destinataires — le rapport partira automatiquement par email."}
              </span>
            </div>
            {tab === 'generate' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: 'rgba(31,59,114,.38)', fontWeight: 600, flexShrink: 0 }}>
                <FileText size={13} />
                Facturation · RH · Recouvrement
              </div>
            )}
            {tab === 'schedule' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: 'rgba(31,59,114,.38)', fontWeight: 600, flexShrink: 0 }}>
                <Clock3 size={13} />
                Quotidien · Hebdo · Mensuel
              </div>
            )}
          </div>

          {/* Contenu actif */}
          {tab === 'generate'
            ? <GenerateurRapportPDF />
            : <RapportsPlanifiesPanel />}
        </div>
      </div>
    </>
  )
}
