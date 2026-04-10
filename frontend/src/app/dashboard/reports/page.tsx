'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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

function ReportsContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const initialCat = (searchParams?.get('category') ?? 'all') as Category | 'all'
  const [activeTab, setActiveTab] = useState<Category | 'all'>(initialCat)
  const [searchVal, setSearchVal] = useState('')

  /* Sync URL ↔ onglet actif */
  useEffect(() => {
    const cat = searchParams?.get('category') ?? 'all'
    setActiveTab(cat as Category | 'all')
  }, [searchParams])

  const handleTabChange = (cat: Category | 'all') => {
    setActiveTab(cat)
    const url = cat === 'all' ? '/dashboard/reports' : `/dashboard/reports?category=${cat}`
    router.replace(url, { scroll: false })
  }

  const filtered = REPORTS.filter(r => {
    const matchCat    = activeTab === 'all' || r.category === activeTab
    const matchSearch = !searchVal ||
      r.title.toLowerCase().includes(searchVal.toLowerCase()) ||
      (r.tags ?? []).some(t => t.toLowerCase().includes(searchVal.toLowerCase()))
    return matchCat && matchSearch
  })

  const totalLive   = REPORTS.filter(r => r.status === 'live').length
  const totalPinned = REPORTS.filter(r => r.pinned).length

  return (
    <>
      <TopBar />

      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', fontFamily: "'Nunito', sans-serif" }}>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', padding: '28px 32px 0', boxShadow: '0 1px 0 rgba(31,59,114,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F3B72" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </div>
              <div>
                <h1 style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: '#1F3B72', margin: 0, letterSpacing: '-.01em' }}>
                  Bibliothèque de Rapports
                </h1>
                <p style={{ fontSize: 11, color: 'rgba(31,59,114,.45)', fontWeight: 500, margin: '3px 0 0' }}>
                  Tous les tableaux de bord et analyses de SEN&#39;EAU
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Total rapports', value: REPORTS.length, color: '#1F3B72' },
                { label: 'En direct',      value: totalLive,       color: '#96C11E' },
                { label: 'Épinglés',       value: totalPinned,     color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f7f9fd', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Barlow Semi Condensed',sans-serif" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recherche + tabs catégories */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f4fb', borderRadius: 10, padding: '9px 14px', flex: '1 1 220px', maxWidth: 340 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(31,59,114,.4)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Rechercher un rapport…"
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#1e293b', flex: 1, fontFamily: "'Nunito', sans-serif" }}
              />
              {searchVal && (
                <button onClick={() => setSearchVal('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(31,59,114,.35)', padding: 0 }}>✕</button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 2 }}>
              {CATS.map(cat => (
                <button key={cat.id} onClick={() => handleTabChange(cat.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '9px 16px', border: 'none',
                  borderBottom: activeTab === cat.id ? '2px solid #1F3B72' : '2px solid transparent',
                  borderRadius: 0,
                  cursor: 'pointer', fontSize: 11.5, fontWeight: activeTab === cat.id ? 700 : 500,
                  fontFamily: "'Nunito', sans-serif", transition: 'all .15s',
                  background: 'transparent',
                  color: activeTab === cat.id ? '#1F3B72' : 'rgba(31,59,114,.45)',
                }}>
                  {cat.imgSrc
                    ? <img src={cat.imgSrc} alt={cat.label} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    : cat.icon && <span style={{ fontSize: 13 }}>{cat.icon}</span>
                  }
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(31,59,114,.4)', fontWeight: 600 }}>
              {filtered.length} rapport{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>{/* /hero */}

        {/* ── CONTENU ──────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 32px' }}>
          {filtered.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {filtered.map(r => (
                <div key={r.id} style={{ position: 'relative' }}>
                  <ReportCard report={r} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(31,59,114,.10)', padding: '64px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(31,59,114,.2)" strokeWidth="1.5" style={{ marginBottom: 14 }}><path d="M3 3h18v4H3zM3 11h18v4H3zM3 19h18v4H3z"/></svg>
              <h3 style={{ fontFamily: "'Barlow Semi Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: '#1F3B72', margin: '0 0 8px' }}>
                Aucun rapport trouvé
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(31,59,114,.45)', margin: 0 }}>
                Essayez d&#39;autres termes ou changez de filtre.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<TopBar />}>
      <ReportsContent />
    </Suspense>
  )
}
