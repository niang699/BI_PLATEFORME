'use client'
import { useState } from 'react'
import { REPORTS, CATEGORY_META, Category } from '@/lib/mockData'
import TopBar from '@/components/TopBar'
import ReportCard from '@/components/ReportCard'

const CATS: { id: Category | 'all'; label: string; icon?: string; imgSrc?: string }[] = [
  { id: 'all',         label: 'Tous'         },
  { id: 'facturation', label: 'Facturation',  imgSrc: CATEGORY_META['facturation']?.imgSrc, icon: CATEGORY_META['facturation']?.icon },
  { id: 'production',  label: 'Production',   icon: CATEGORY_META['production']?.icon  },
  { id: 'maintenance', label: 'Maintenance',  icon: CATEGORY_META['maintenance']?.icon },
  { id: 'rh',          label: 'RH',           icon: CATEGORY_META['rh']?.icon          },
  { id: 'sig',         label: 'Cartographie', icon: CATEGORY_META['sig']?.icon         },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Category | 'all'>('all')
  const [searchVal, setSearchVal] = useState('')

  const filtered = REPORTS.filter(r => {
    const matchCat    = activeTab === 'all' || r.category === activeTab
    const matchSearch = !searchVal ||
      r.title.toLowerCase().includes(searchVal.toLowerCase()) ||
      r.tags.some(t => t.toLowerCase().includes(searchVal.toLowerCase()))
    return matchCat && matchSearch
  })

  const totalLive   = REPORTS.filter(r => r.status === 'live').length
  const totalPinned = REPORTS.filter(r => r.pinned).length

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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#EEF2FF', border: '1px solid #E0E7FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, color: '#1F3B72', flexShrink: 0,
              }}>▤</div>
              <h1 style={{
                fontFamily: "'Barlow Semi Condensed', sans-serif",
                fontSize: 22, fontWeight: 800, color: '#1F3B72', margin: 0,
                letterSpacing: '-.01em',
              }}>
                Bibliothèque de Rapports
              </h1>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(31,59,114,.5)', fontWeight: 500, margin: 0 }}>
              Tous les tableaux de bord et analyses de SEN&#39;EAU
            </p>
          </div>

          {/* Compteurs */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Total rapports', value: REPORTS.length, color: '#1F3B72' },
              { label: 'En direct',      value: totalLive,       color: '#96C11E' },
              { label: 'Épinglés',       value: totalPinned,     color: '#f59e0b' },
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

        {/* ── Recherche + Filtres ───────────────────────────────────────── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          boxShadow: '0 2px 12px rgba(31,59,114,.08)',
          padding: '18px 24px',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          {/* Barre de recherche */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f8fafc', borderRadius: 10, border: '1.5px solid #e2e8f0',
            padding: '9px 14px', flex: '1 1 220px', maxWidth: 340,
            transition: 'border-color .18s',
          }}>
            <span style={{ color: 'rgba(31,59,114,.3)', fontSize: 14 }}>⌕</span>
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Rechercher un rapport…"
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: 13, color: '#1e293b', flex: 1,
                fontFamily: "'Nunito', sans-serif",
              }}
            />
            {searchVal && (
              <button onClick={() => setSearchVal('')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'rgba(31,59,114,.35)', padding: 0,
              }}>✕</button>
            )}
          </div>

          {/* Séparateur */}
          <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }} />

          {/* Onglets catégories */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATS.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  fontFamily: "'Nunito', sans-serif",
                  transition: 'all .15s', outline: 'none',
                  background: activeTab === cat.id
                    ? 'linear-gradient(135deg,#1F3B72,#2B50A0)'
                    : '#f4f6fb',
                  color: activeTab === cat.id ? '#fff' : 'rgba(31,59,114,.6)',
                  boxShadow: activeTab === cat.id
                    ? '0 4px 14px rgba(31,59,114,.25)'
                    : 'none',
                }}
              >
                {cat.imgSrc
                  ? <img src={cat.imgSrc} alt={cat.label} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  : cat.icon && <span style={{ fontSize: 13 }}>{cat.icon}</span>
                }
                {cat.label}
              </button>
            ))}
          </div>

          {/* Résultat count */}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(31,59,114,.4)', fontWeight: 600 }}>
            {filtered.length} rapport{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Grille rapports ───────────────────────────────────────────── */}
        {filtered.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 18,
          }}>
            {filtered.map(r => (
              <div key={r.id} style={{ position: 'relative' }}>
                <ReportCard report={r} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 16,
            boxShadow: '0 2px 12px rgba(31,59,114,.08)',
            padding: '64px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center',
          }}>
            <span style={{ fontSize: 52, marginBottom: 16 }}>📭</span>
            <h3 style={{
              fontFamily: "'Barlow Semi Condensed', sans-serif",
              fontSize: 20, fontWeight: 800, color: '#1F3B72', margin: '0 0 8px',
            }}>
              Aucun rapport trouvé
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)', margin: 0 }}>
              Essayez d&#39;autres termes ou changez de filtre.
            </p>
          </div>
        )}

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
