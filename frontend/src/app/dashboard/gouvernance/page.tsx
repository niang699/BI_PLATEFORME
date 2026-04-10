'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { BarChart2, Building2, Settings2, Calculator, Database, BookOpen, FunctionSquare, Layers, Users, TrendingUp, Tag } from 'lucide-react'
import { INDICATEURS, SERVICES, GROUPES, type Indicateur } from '@/lib/indicateurs'
import { PHASES, STATUT_META, roadmapStats, parseGanttDate, GANTT_TOTAL, type RoadmapStatut } from '@/lib/roadmapData'

/* ─── Statistiques globales ───────────────────────────────────────────────── */
const TOTAL        = INDICATEURS.length
const NB_CALCULES  = INDICATEURS.filter(i => i.calcule).length
const NB_SERVICES  = Object.keys(SERVICES).length
const NB_PROCESSUS = Object.keys(GROUPES).length
const NB_PRIORITE1 = INDICATEURS.filter(i => i.priorite === 1).length

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmt        = (v:number) => Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)
const tendIcon   = (t:string) => t==="hausse"?"↑":t==="baisse"?"↓":"→"
const tendColor  = (t:string) => t==="hausse"?"#059669":t==="baisse"?"#DC2626":"#6b7280"
const TYPE_COLORS: Record<string,string> = {
  Qualité:"#1F3B72", Sécurité:"#DC2626", Environnement:"#059669",
  Financier:"#D97706", Performance:"#7C3AED",
}
const GT_COLORS: Record<string,string> = {
  Management:"#1F3B72", Réalisation:"#96C11E", Support:"#D97706",
}

type CardId = "indicateurs"|"services"|"processus"|"calcules"

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
════════════════════════════════════════════════════════════════════════════ */
export default function GouvernancePage() {
  const [active,   setActive]   = useState<CardId|null>(null)
  const [selected, setSelected] = useState<Indicateur|null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const toggle = (id: CardId) => setActive(p => p === id ? null : id)

  useEffect(() => {
    if (active) panelRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
  }, [active])

  const CARDS: { id:CardId; icon:React.ReactNode; value:string; label:string; sub:string; color:string }[] = [
    { id:"indicateurs", icon:<BarChart2  size={17}/>, value:String(TOTAL),        label:"Indicateurs pilotés",  sub:`${NB_PRIORITE1} priorité 1`,   color:"#96C11E" },
    { id:"services",    icon:<Building2  size={17}/>, value:String(NB_SERVICES),  label:"Services couverts",    sub:"13 directions métier",          color:"#0891B2" },
    { id:"processus",   icon:<Settings2  size={17}/>, value:String(NB_PROCESSUS), label:"Processus qualité",    sub:"Mgt · Réal · Support",          color:"#8b5cf6" },
    { id:"calcules",    icon:<Calculator size={17}/>, value:String(NB_CALCULES),  label:"Indicateurs calculés", sub:`${TOTAL-NB_CALCULES} manuels`,  color:"#D97706" },
  ]

  return (
    <>
      <TopBar title="Data Gouvernance"
        subtitle="Référentiel indicateurs · Sources · Qualité · Glossaire" />

      <div className="gouvernance-page" style={{ flex:1, overflowY:'auto', background:'#f8fafc' }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div style={{
          background:'#fff',
          padding:'28px 32px 0', position:'relative', overflow:'hidden',
          boxShadow:'0 1px 0 rgba(31,59,114,.08)',
        }}>
          <div style={{ position:'relative', zIndex:1 }}>
            {/* Titre */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
              <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
                background:'#EEF2FF',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Database size={20} color="#1F3B72" strokeWidth={1.8} />
              </div>
              <div>
                <h1 style={{ color:'#1F3B72', fontSize:20, fontWeight:800,
                  fontFamily:"'Barlow Semi Condensed',sans-serif", lineHeight:1.1,
                  letterSpacing:'-.01em' }}>
                  Data Gouvernance SEN&#x27;EAU
                </h1>
                <p style={{ color:'rgba(31,59,114,.45)', fontSize:11, marginTop:3, fontWeight:500 }}>
                  Pilotage qualité · Traçabilité · Référentiel des indicateurs métier
                </p>
              </div>
              <div style={{ marginLeft:'auto' }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'4px 12px', borderRadius:20,
                  background:'rgba(150,193,30,.12)', color:'#5a7a10',
                  letterSpacing:'.05em', textTransform:'uppercase' }}>Référentiel actif</span>
              </div>
            </div>

            {/* 4 KPI Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {CARDS.map(c => (
                <KpiCard key={c.id} {...c} active={active===c.id} onClick={() => toggle(c.id)} />
              ))}
            </div>

            {/* Tabs de navigation */}
            <div style={{ display:'flex', marginTop:20, gap:2 }}>
              {CARDS.map(c => {
                const isActive = active === c.id
                return (
                  <button key={c.id} onClick={() => toggle(c.id)} style={{
                    padding:'9px 18px',
                    border:'none', outline:'none',
                    borderBottom: isActive ? `2px solid ${c.color}` : '2px solid transparent',
                    borderRadius:0,
                    background:'transparent',
                    color: isActive ? c.color : 'var(--text-muted)',
                    fontSize:11.5, fontWeight: isActive ? 700 : 500,
                    cursor:'pointer', transition:'all .18s',
                    display:'flex', alignItems:'center', gap:6,
                    letterSpacing:'.01em', whiteSpace:'nowrap',
                  }}
                  onMouseEnter={e=>{if(!isActive)(e.currentTarget as HTMLButtonElement).style.color='#1F3B72'}}
                  onMouseLeave={e=>{if(!isActive)(e.currentTarget as HTMLButtonElement).style.color='var(--text-muted)'}}
                  >
                    <span style={{ fontSize:12 }}>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Panneau expansible ────────────────────────────────────────────── */}
        <div ref={panelRef}>
          {active === 'indicateurs' && <PanneauIndicateurs onSelect={setSelected} />}
          {active === 'services'    && <PanneauServices    onSelect={setSelected} />}
          {active === 'processus'   && <PanneauProcessus   onSelect={setSelected} />}
          {active === 'calcules'    && <PanneauCalcules    onSelect={setSelected} />}
        </div>

        {/* ── Hub sous-modules Gouvernance ─────────────────────────────────── */}
        <div style={{ padding:'0 32px 0', display:'flex', flexDirection:'column', gap:12 }}>
          <Link href="/dashboard/gouvernance/data-quality" style={{ textDecoration:'none', display:'block' }}>
            <div style={{
              background:'linear-gradient(135deg,#1F3B72 0%,#162c58 100%)',
              borderRadius:16, padding:'20px 28px',
              display:'flex', alignItems:'center', gap:20,
              boxShadow:'0 4px 20px rgba(31,59,114,.18)',
              cursor:'pointer', transition:'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e=>{
              (e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow='0 8px 32px rgba(31,59,114,.28)'
            }}
            onMouseLeave={e=>{
              (e.currentTarget as HTMLDivElement).style.transform=''
              ;(e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 20px rgba(31,59,114,.18)'
            }}>
              {/* Icône */}
              <div style={{
                width:52, height:52, borderRadius:14, flexShrink:0,
                background:'rgba(150,193,30,.15)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><BarChart2 size={24} color="#96C11E" strokeWidth={1.8} /></div>
              {/* Texte */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-.01em' }}>
                  Data Quality Score
                </div>
                <div style={{ fontSize:11, color:'rgba(232,237,248,.5)', marginTop:3 }}>
                  Complétude · Exactitude · Cohérence · Fraîcheur · Unicité · Conformité
                </div>
              </div>
              {/* Flèche */}
              <div style={{ fontSize:20, color:'rgba(150,193,30,.7)', fontWeight:300 }}>›</div>
            </div>
          </Link>

          {/* ── Catalogue de Données ── */}
          <Link href="/dashboard/gouvernance/catalog" style={{ textDecoration:'none', display:'block' }}>
            <div style={{
              background:'#fff',
              borderRadius:14, padding:'20px 28px',
              display:'flex', alignItems:'center', gap:20,
              boxShadow:'0 2px 10px rgba(31,59,114,.10)',
              cursor:'pointer', transition:'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e=>{
              (e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow='0 6px 24px rgba(31,59,114,.14)'
            }}
            onMouseLeave={e=>{
              (e.currentTarget as HTMLDivElement).style.transform=''
              ;(e.currentTarget as HTMLDivElement).style.boxShadow='0 2px 10px rgba(31,59,114,.10)'
            }}>
              <div style={{
                width:52, height:52, borderRadius:14, flexShrink:0,
                background:'rgba(8,145,178,.10)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><BookOpen size={24} color="#0891B2" strokeWidth={1.8} /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'#1F3B72', letterSpacing:'-.01em' }}>
                  Catalogue de Données
                </div>
                <div style={{ fontSize:11, color:'rgba(31,59,114,.45)', marginTop:3 }}>
                  Inventaire des tables · Colonnes documentées · Sources & APIs associées
                </div>
              </div>
              <div style={{ fontSize:20, color:'rgba(31,59,114,.3)', fontWeight:300 }}>›</div>
            </div>
          </Link>
        </div>

        {/* ── Sections Governance bas de page ──────────────────────────────── */}
        <div style={{ padding:'28px 32px', display:'flex', flexDirection:'column', gap:28 }}>
          <SectionFeuilleDeRoute />
          <SectionSources />
          <SectionQualite />
          <SectionGlossaire />
        </div>

        {/* ── Detail Panel (slide-in) ───────────────────────────────────────── */}
        <DetailPanel ind={selected} onClose={() => setSelected(null)} />
      </div>

      <style>{`
        .gouvernance-page button:focus,
        .gouvernance-page button:focus-visible,
        .gouvernance-page div[tabindex]:focus { outline: none !important; }
      `}</style>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   KPI CARD — ultra-simple, sophistiqué, net
════════════════════════════════════════════════════════════════════════════ */
function KpiCard({ icon,value,label,sub,color,active,onClick }:{
  icon:React.ReactNode;value:string;label:string;sub:string;color:string;active:boolean;onClick:()=>void
}) {
  const [hov,setHov]=useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        position:'relative',
        background: active ? `${color}08` : '#fff',
        borderRadius:14, padding:'18px 18px 16px',
        cursor:'pointer', transition:'all .22s',
        overflow:'hidden',
        boxShadow: active
          ? `0 8px 28px ${color}28`
          : hov
          ? '0 6px 20px rgba(31,59,114,.12)'
          : '0 2px 10px rgba(31,59,114,.10)',
      }}>

      {/* Icône + état */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{
          width:38, height:38, borderRadius:10,
          background: active ? `${color}20` : `${color}0f`,
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all .22s', color,
        }}>{icon}</div>
        <span style={{
          fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase',
          color: active ? color : 'rgba(31,59,114,.25)',
          transition:'color .22s',
        }}>
          {active ? 'OUVERT ▲' : '▼ voir'}
        </span>
      </div>

      {/* Valeur */}
      <div style={{
        fontSize:32, fontWeight:900, lineHeight:1,
        fontFamily:"'Barlow Semi Condensed',sans-serif",
        color: active ? color : '#1F3B72',
        transition:'color .22s',
      }}>{value}</div>

      {/* Label */}
      <div style={{
        fontSize:11.5, fontWeight:600, marginTop:6,
        color: active ? '#1F3B72' : 'var(--text-primary)',
        transition:'color .22s',
      }}>{label}</div>

      {/* Sous-label */}
      <div style={{
        fontSize:10, marginTop:3,
        color: active ? `${color}bb` : 'var(--text-faint)',
        transition:'color .22s',
      }}>{sub}</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANT PAGINATION UNIVERSEL
════════════════════════════════════════════════════════════════════════════ */
function Pagination({ page, total, perPage, onChange, accent='#1F3B72', label='éléments' }:{
  page:number; total:number; perPage:number; onChange:(p:number)=>void; accent?:string; label?:string
}) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  const from = (page-1)*perPage+1
  const to   = Math.min(page*perPage, total)

  // Fenêtre de pages à afficher
  const pages: (number|'…')[] = []
  if (totalPages <= 7) {
    for (let i=1;i<=totalPages;i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++) pages.push(i)
    if (page < totalPages-2) pages.push('…')
    pages.push(totalPages)
  }

  const btnBase: React.CSSProperties = {
    width:32,height:32,borderRadius:8,cursor:'pointer',
    display:'flex',alignItems:'center',justifyContent:'center',
    fontSize:12,fontWeight:600,transition:'all .18s',border:'none',
  }

  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'12px 32px',borderTop:'1px solid var(--border)',
      background:'linear-gradient(180deg,#f4f6fb 0%,#fff 100%)' }}>

      {/* Contexte */}
      <span style={{ fontSize:11,color:'var(--text-faint)',fontWeight:500,letterSpacing:'.01em' }}>
        <span style={{ fontWeight:700,color:'var(--text-muted)' }}>{from}–{to}</span>
        {' '}sur{' '}
        <span style={{ fontWeight:700,color:'var(--text-muted)' }}>{total}</span>
        {' '}{label}
      </span>

      {/* Boutons */}
      <div style={{ display:'flex',alignItems:'center',gap:3 }}>
        {/* Flèche gauche */}
        <button onClick={()=>onChange(page-1)} disabled={page===1}
          style={{ ...btnBase,
            background:page===1?'#f4f6fb':'#fff',
            border:'1px solid var(--border)',
            color:page===1?'var(--border)':'var(--text-muted)',
            cursor:page===1?'not-allowed':'pointer',
            opacity:page===1?0.45:1,
          }}
          onMouseEnter={e=>{if(page>1)(e.currentTarget as HTMLButtonElement).style.borderColor=accent;(e.currentTarget as HTMLButtonElement).style.color=accent}}
          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--border)';(e.currentTarget as HTMLButtonElement).style.color='var(--text-muted)'}}>
          ‹
        </button>

        {/* Numéros */}
        {pages.map((p,i)=>p==='…'?(
          <span key={`e${i}`} style={{ width:28,textAlign:'center',color:'var(--border)',
            fontSize:11,userSelect:'none',letterSpacing:'.1em' }}>···</span>
        ):(
          <button key={p} onClick={()=>onChange(p as number)}
            style={{ ...btnBase,
              background: page===p ? accent : 'transparent',
              color:       page===p ? '#fff'  : 'var(--text-muted)',
              fontWeight:  page===p ? 800 : 500,
              boxShadow:   page===p ? `0 4px 12px ${accent}40` : 'none',
              transform:   page===p ? 'scale(1.05)' : 'scale(1)',
            }}
            onMouseEnter={e=>{if(page!==p){(e.currentTarget as HTMLButtonElement).style.background=`${accent}12`;(e.currentTarget as HTMLButtonElement).style.color=accent}}}
            onMouseLeave={e=>{if(page!==p){(e.currentTarget as HTMLButtonElement).style.background='transparent';(e.currentTarget as HTMLButtonElement).style.color='var(--text-muted)'}}}>
            {p}
          </button>
        ))}

        {/* Flèche droite */}
        <button onClick={()=>onChange(page+1)} disabled={page===totalPages}
          style={{ ...btnBase,
            background:page===totalPages?'#f4f6fb':'#fff',
            border:'1px solid var(--border)',
            color:page===totalPages?'var(--border)':'var(--text-muted)',
            cursor:page===totalPages?'not-allowed':'pointer',
            opacity:page===totalPages?0.45:1,
          }}
          onMouseEnter={e=>{if(page<totalPages)(e.currentTarget as HTMLButtonElement).style.borderColor=accent;(e.currentTarget as HTMLButtonElement).style.color=accent}}
          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--border)';(e.currentTarget as HTMLButtonElement).style.color='var(--text-muted)'}}>
          ›
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANNEAU 1 — Explorateur des indicateurs
════════════════════════════════════════════════════════════════════════════ */
function PanneauIndicateurs({ onSelect }:{ onSelect:(i:Indicateur)=>void }) {
  const [search,setSearch]     = useState('')
  const [svc,setSvc]           = useState('ALL')
  const [type,setType]         = useState('ALL')
  const [expanded,setExpanded] = useState<Record<string,boolean>>({})
  const [page,setPage]         = useState(1)
  const PER_PAGE = 5
  const TYPES = ['ALL','Qualité','Financier','Performance','Sécurité','Environnement']

  const filtered = useMemo(()=>INDICATEURS.filter(i=>{
    if(svc!=='ALL'&&i.service!==svc) return false
    if(type!=='ALL'&&i.type_indicateur!==type) return false
    if(search){const q=search.toLowerCase();return i.indicateur.toLowerCase().includes(q)||i.service_label.toLowerCase().includes(q)}
    return true
  }),[search,svc,type])

  const bySvc = useMemo(()=>{
    const m:Record<string,Indicateur[]>={}
    for(const i of filtered){if(!m[i.service])m[i.service]=[]; m[i.service].push(i)}
    return Object.entries(m).sort((a,b)=>b[1].length-a[1].length)
  },[filtered])

  // Reset page on filter change
  const prevFilters = useMemo(()=>({search,svc,type}),[search,svc,type])
  useMemo(()=>{ setPage(1) },[prevFilters])   // eslint-disable-line

  const paginated = bySvc.slice((page-1)*PER_PAGE, page*PER_PAGE)

  return (
    <div style={{ background:'#f4f6fb', padding:'20px 32px 28px' }}>
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden',
      boxShadow:'0 2px 20px rgba(31,59,114,.08)', border:'1px solid var(--border)',
      borderTop:'3px solid #96C11E' }}>
      {/* Filtres */}
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border)',
        background:'#fff', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 240px' }}>
          <span style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-faint)',fontSize:13 }}>🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}
            placeholder={`Rechercher parmi ${TOTAL} indicateurs…`}
            style={{ width:'100%',padding:'8px 12px 8px 34px',borderRadius:10,
              border:'1px solid var(--border)',background:'#fff',fontSize:12,
              color:'var(--text-primary)',outline:'none' }}
            onFocus={e=>e.target.style.borderColor='#1F3B72'}
            onBlur={e=>e.target.style.borderColor='var(--border)'} />
        </div>
        <select value={svc} onChange={e=>{setSvc(e.target.value);setPage(1)}}
          style={{ padding:'8px 12px',borderRadius:10,border:'1px solid var(--border)',
            background:'#fff',fontSize:12,color:'var(--text-primary)',cursor:'pointer',minWidth:175,outline:'none' }}>
          <option value="ALL">Tous les services</option>
          {Object.entries(SERVICES).map(([k,v])=>(
            <option key={k} value={k}>{k} — {v.label}</option>
          ))}
        </select>
        <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
          {TYPES.map(t=>(
            <button key={t} onClick={()=>{setType(t);setPage(1)}} style={{
              padding:'4px 10px',borderRadius:20,fontSize:10.5,fontWeight:600,cursor:'pointer',
              border:type===t?`1px solid ${TYPE_COLORS[t]??'#1F3B72'}`:'1px solid var(--border)',
              background:type===t?`${TYPE_COLORS[t]??'#1F3B72'}10`:'transparent',
              color:type===t?(TYPE_COLORS[t]??'#1F3B72'):'var(--text-muted)',transition:'all .15s',
            }}>{t==='ALL'?'Tous':t}</button>
          ))}
        </div>
        <span style={{ marginLeft:'auto',fontSize:11,fontWeight:600,
          background:'var(--border)',padding:'6px 12px',borderRadius:8,color:'var(--text-muted)' }}>
          {filtered.length} résultat{filtered.length>1?'s':''}
        </span>
      </div>

      {/* Colonnes header */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 110px 90px 90px 70px 36px',
        padding:'8px 32px', background:'#f4f6fb', borderBottom:'1px solid var(--border)',
        gap:12 }}>
        {['Indicateur / Processus','Type','Fréquence','Valeur','Tendance','✓'].map(h=>(
          <span key={h} style={{ fontSize:9,fontWeight:700,letterSpacing:'.1em',
            textTransform:'uppercase',color:'var(--text-faint)',textAlign:h==='Valeur'||h==='✓'?'right':'left' }}>{h}</span>
        ))}
      </div>

      {/* Liste paginée */}
      <div>
        {paginated.length===0?(
          <div style={{ padding:48,textAlign:'center',color:'var(--text-faint)',fontSize:13 }}>Aucun indicateur trouvé</div>
        ):paginated.map(([code,inds])=>{
          const meta=SERVICES[code]
          const open=expanded[code]!==false
          return (
            <div key={code} style={{ borderBottom:'1px solid var(--border)' }}>
              <button onClick={()=>setExpanded(p=>({...p,[code]:!open}))}
                style={{ width:'100%',padding:'11px 32px',display:'flex',alignItems:'center',
                  gap:12,background:open?`${meta.couleur}06`:'#fff',border:'none',
                  cursor:'pointer',transition:'background .15s',
                  borderLeft:`3px solid ${meta.couleur}` }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:meta.couleur,flexShrink:0 }} />
                <span style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)',fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{code}</span>
                <span style={{ fontSize:11,color:'var(--text-muted)' }}>— {meta.label}</span>
                <span style={{ marginLeft:'auto',fontSize:11,fontWeight:700,padding:'2px 10px',
                  borderRadius:20,background:`${meta.couleur}14`,color:meta.couleur }}>{inds.length}</span>
                <span style={{ fontSize:13,color:'var(--text-faint)',transition:'transform .2s',
                  transform:open?'rotate(180deg)':'none' }}>▾</span>
              </button>
              {open && inds.map((ind,i)=>(
                <IndRow key={ind.id} ind={ind} color={meta.couleur} zebra={i%2===0} onClick={()=>onSelect(ind)} />
              ))}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <Pagination page={page} total={bySvc.length} perPage={PER_PAGE}
        onChange={setPage} accent='#96C11E' label='services' />
    </div>
    </div>
  )
}

function IndRow({ ind,color,zebra,onClick }:{ ind:Indicateur;color:string;zebra:boolean;onClick:()=>void }) {
  const [hov,setHov]=useState(false)
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:'grid',gridTemplateColumns:'1fr 110px 90px 90px 70px 36px',
        alignItems:'center',padding:'9px 32px',cursor:'pointer',gap:12,
        background:hov?`${color}09`:zebra?'#f4f6fb':'#fff',
        borderLeft:`3px solid ${hov?color:'transparent'}`,transition:'all .12s' }}>
      <div style={{ display:'flex',flexDirection:'column',gap:2 }}>
        <span style={{ fontSize:12,fontWeight:600,color:hov?color:'var(--text-primary)',lineHeight:1.3,transition:'color .12s' }}>{ind.indicateur}</span>
        <span style={{ fontSize:10,color:'var(--text-faint)' }}>{ind.groupe_nom}</span>
      </div>
      <span style={{ fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:20,textAlign:'center',
        background:`${TYPE_COLORS[ind.type_indicateur]??'#1F3B72'}12`,color:TYPE_COLORS[ind.type_indicateur]??'#1F3B72' }}>
        {ind.type_indicateur}
      </span>
      <span style={{ fontSize:10,color:'var(--text-faint)',textAlign:'center' }}>{ind.frequence_maj}</span>
      <span style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)',textAlign:'right' }}>{fmt(ind.valeur_actuelle)}</span>
      <span style={{ fontSize:14,fontWeight:700,color:tendColor(ind.tendance),textAlign:'center' }}>{tendIcon(ind.tendance)}</span>
      <span style={{ fontSize:13,textAlign:'center',color:ind.atteint_cible?'#059669':'var(--text-faint)' }}>{ind.atteint_cible?'✓':'·'}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANNEAU 2 — Services couverts
════════════════════════════════════════════════════════════════════════════ */
function PanneauServices({ onSelect }:{ onSelect:(i:Indicateur)=>void }) {
  const [selSvc,setSelSvc] = useState<string|null>(null)
  const [page,setPage]     = useState(1)
  const PER_PAGE = 6

  // Stats par service
  const stats = useMemo(()=>
    Object.entries(SERVICES).map(([code,meta])=>{
      const inds = INDICATEURS.filter(i=>i.service===code)
      const atteint = inds.filter(i=>i.atteint_cible).length
      const pct = inds.length ? Math.round(atteint/inds.length*100) : 0
      const types = Array.from(new Set(inds.map(i=>i.type_indicateur)))
      return { code, meta, inds, atteint, pct, types }
    }).sort((a,b)=>b.inds.length-a.inds.length)
  ,[])

  const paginated = stats.slice((page-1)*PER_PAGE, page*PER_PAGE)
  const selStat = stats.find(s=>s.code===selSvc)

  return (
    <div style={{ background:'#f4f6fb', padding:'20px 32px 28px' }}>
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden',
      boxShadow:'0 2px 20px rgba(31,59,114,.08)', border:'1px solid var(--border)',
      borderTop:'3px solid #0891B2' }}>
      {/* Header */}
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border)',
        background:'#fff', display:'flex', alignItems:'center', gap:16 }}>
        <span style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)',fontFamily:"'Barlow Semi Condensed',sans-serif" }}>
          {stats.length} Directions SEN&#x27;EAU — cliquer une direction pour voir ses indicateurs
        </span>
        {selSvc && (
          <button onClick={()=>setSelSvc(null)}
            style={{ marginLeft:'auto',padding:'4px 12px',border:'1px solid var(--border)',
              borderRadius:20,background:'transparent',cursor:'pointer',fontSize:10.5,color:'var(--text-muted)',
              fontWeight:500,letterSpacing:'.01em' }}>
            ✕ Effacer
          </button>
        )}
      </div>

      <div style={{ display:'flex', minHeight:420 }}>
        {/* Grille des services paginée */}
        <div style={{ flex:'1', display:'flex', flexDirection:'column',
          borderRight: selSvc?'1px solid var(--border)':'none' }}>
          <div style={{ flex:1, padding:'24px 32px',
            display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14,
            alignContent:'start' }}>
            {paginated.map(s=>(
              <div key={s.code} onClick={()=>setSelSvc(p=>p===s.code?null:s.code)}
                style={{
                  borderRadius:14, padding:'16px 18px', cursor:'pointer',
                  border:`1px solid ${selSvc===s.code?s.meta.couleur:'var(--border)'}`,
                  borderTop:`3px solid ${s.meta.couleur}`,
                  background: selSvc===s.code?`${s.meta.couleur}08`:'#fff',
                  boxShadow: selSvc===s.code?`0 0 0 1px ${s.meta.couleur}30, 0 8px 24px rgba(0,0,0,.08)`:'0 2px 8px rgba(31,59,114,.05)',
                  transition:'all .2s',
                }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:11,fontWeight:800,padding:'3px 10px',borderRadius:20,
                    background:`${s.meta.couleur}18`,color:s.meta.couleur }}>{s.code}</span>
                  <span style={{ fontSize:11,fontWeight:700,color:'var(--text-faint)' }}>{s.inds.length} ind.</span>
                </div>
                <div style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)',lineHeight:1.3,marginBottom:10 }}>
                  {s.meta.label}
                </div>
                {/* Barre de performance */}
                <div style={{ background:'#f4f6fb',borderRadius:99,height:5,marginBottom:6 }}>
                  <div style={{ height:'100%',width:`${s.pct}%`,borderRadius:99,
                    background:`linear-gradient(90deg,${s.meta.couleur}80,${s.meta.couleur})` }} />
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:10 }}>
                  <span style={{ color:'var(--text-faint)' }}>Cibles atteintes</span>
                  <span style={{ fontWeight:700,color:s.pct>=60?'#059669':'#DC2626' }}>{s.pct}%</span>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} total={stats.length} perPage={PER_PAGE}
            onChange={setPage} accent='#0891B2' label='directions' />
        </div>

        {/* Panneau détail service */}
        {selSvc && selStat && (
          <div style={{ width:420,flexShrink:0,background:'#f4f6fb',display:'flex',flexDirection:'column' }}>
            {/* En-tête service */}
            <div style={{ background:'#fff', padding:'20px 24px', flexShrink:0,
              borderBottom:'1px solid #e8edf5', borderTop:`3px solid ${selStat.meta.couleur}` }}>
              <div style={{ fontSize:11,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',
                color:'rgba(31,59,114,.38)',marginBottom:6 }}>Direction</div>
              <div style={{ fontSize:22,fontWeight:800,color:'#1F3B72',fontFamily:"'Barlow Semi Condensed',sans-serif",marginBottom:4 }}>
                {selStat.code}
              </div>
              <div style={{ fontSize:12,color:'rgba(31,59,114,.5)',marginBottom:16,lineHeight:1.4 }}>
                {selStat.meta.label}
              </div>
              <div style={{ display:'flex',gap:16 }}>
                {[
                  { l:'Indicateurs', v:selStat.inds.length },
                  { l:'Cibles ✓',    v:`${selStat.pct}%`  },
                  { l:'Priorité 1',  v:selStat.inds.filter(i=>i.priorite===1).length },
                ].map(s=>(
                  <div key={s.l}>
                    <div style={{ fontSize:18,fontWeight:900,color:selStat.meta.couleur,fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{s.v}</div>
                    <div style={{ fontSize:9,color:'rgba(31,59,114,.35)',textTransform:'uppercase',letterSpacing:'.08em' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Types */}
            <div style={{ padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:8,flexWrap:'wrap' }}>
              {selStat.types.map(t=>(
                <span key={t} style={{ fontSize:10,fontWeight:600,padding:'3px 10px',borderRadius:20,
                  background:`${TYPE_COLORS[t]??'#1F3B72'}12`,color:TYPE_COLORS[t]??'#1F3B72',
                  border:`1px solid ${TYPE_COLORS[t]??'#1F3B72'}22` }}>{t}</span>
              ))}
            </div>

            {/* Liste indicateurs du service */}
            <div style={{ flex:1,overflowY:'auto' }}>
              {selStat.inds.map((ind,i)=>(
                <div key={ind.id} onClick={()=>onSelect(ind)}
                  style={{ padding:'10px 20px',borderBottom:'1px solid var(--border)',
                    background:i%2===0?'#fff':'#f4f6fb',cursor:'pointer',
                    display:'flex',alignItems:'center',gap:12,
                    transition:'background .12s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=`${selStat.meta.couleur}08`}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=i%2===0?'#fff':'#f4f6fb'}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11,fontWeight:600,color:'var(--text-primary)',lineHeight:1.3 }}>{ind.indicateur}</div>
                    <div style={{ fontSize:10,color:'var(--text-faint)',marginTop:2 }}>{ind.frequence_maj} · {ind.type_indicateur}</div>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)' }}>{fmt(ind.valeur_actuelle)}</div>
                    <div style={{ fontSize:12,color:tendColor(ind.tendance),fontWeight:700 }}>{tendIcon(ind.tendance)}</div>
                  </div>
                  <span style={{ fontSize:13,color:ind.atteint_cible?'#059669':'var(--text-faint)' }}>
                    {ind.atteint_cible?'✓':'·'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANNEAU 3 — Processus qualité
════════════════════════════════════════════════════════════════════════════ */
function PanneauProcessus({ onSelect }:{ onSelect:(i:Indicateur)=>void }) {
  const [selProc,setSelProc] = useState<string|null>(null)

  const stats = useMemo(()=>
    Object.entries(GROUPES).map(([code,g])=>{
      const inds = INDICATEURS.filter(i=>i.groupe_processus===code)
      const atteint = inds.filter(i=>i.atteint_cible).length
      return { code, g, inds, atteint, pct:inds.length?Math.round(atteint/inds.length*100):0 }
    })
  ,[])

  const groups: Record<string,typeof stats> = {
    Management: stats.filter(s=>s.g.type==='Management'),
    Réalisation:stats.filter(s=>s.g.type==='Réalisation'),
    Support:    stats.filter(s=>s.g.type==='Support'),
  }

  const selStat = stats.find(s=>s.code===selProc)

  return (
    <div style={{ background:'#f4f6fb', padding:'20px 32px 28px' }}>
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden',
      boxShadow:'0 2px 20px rgba(31,59,114,.08)', border:'1px solid var(--border)',
      borderTop:'3px solid #8b5cf6' }}>
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border)',
        background:'#fff', display:'flex', alignItems:'center', gap:16 }}>
        <span style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)',fontFamily:"'Barlow Semi Condensed',sans-serif" }}>
          15 Groupes de processus — Management · Réalisation · Support
        </span>
        {selProc && (
          <button onClick={()=>setSelProc(null)}
            style={{ marginLeft:'auto',padding:'4px 12px',border:'1px solid var(--border)',
              borderRadius:20,background:'transparent',cursor:'pointer',fontSize:10.5,color:'var(--text-muted)',
              fontWeight:500 }}>
            ✕ Effacer
          </button>
        )}
      </div>

      <div style={{ display:'flex', minHeight:420 }}>
        {/* Colonnes processus */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(3,1fr)',
          borderRight:selProc?'1px solid var(--border)':'none' }}>
          {Object.entries(groups).map(([type,procs])=>{
            const c = GT_COLORS[type]
            return (
              <div key={type} style={{ borderRight:'1px solid var(--border)', padding:'20px 20px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16 }}>
                  <div style={{ width:6,height:28,borderRadius:3,background:c,flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:12,fontWeight:800,color:c,fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{type}</div>
                    <div style={{ fontSize:10,color:'var(--text-faint)' }}>{procs.length} processus</div>
                  </div>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {procs.map(s=>(
                    <div key={s.code} onClick={()=>setSelProc(p=>p===s.code?null:s.code)}
                      style={{
                        borderRadius:12,padding:'12px 14px',cursor:'pointer',
                        border:`1px solid ${selProc===s.code?c:'var(--border)'}`,
                        background:selProc===s.code?`${c}09`:'#f4f6fb',
                        boxShadow:selProc===s.code?`0 4px 16px ${c}18`:'none',
                        transition:'all .18s',
                      }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                        <span style={{ fontSize:10,fontWeight:800,color:c,padding:'2px 8px',
                          borderRadius:6,background:`${c}18` }}>{s.code}</span>
                        <span style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)' }}>{s.inds.length}</span>
                      </div>
                      <div style={{ fontSize:11,fontWeight:600,color:'var(--text-primary)',
                        lineHeight:1.35,marginBottom:8 }}>{s.g.nom.split('·')[1]?.trim()}</div>
                      <div style={{ background:'var(--border)',borderRadius:99,height:4 }}>
                        <div style={{ height:'100%',width:`${s.pct}%`,borderRadius:99,
                          background:`linear-gradient(90deg,${c}70,${c})`,transition:'width 1s' }} />
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',marginTop:5,fontSize:9 }}>
                        <span style={{ color:'var(--text-faint)' }}>Cibles</span>
                        <span style={{ fontWeight:700,color:s.pct>=60?'#059669':'#DC2626' }}>{s.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Détail processus */}
        {selProc && selStat && (
          <div style={{ width:400,flexShrink:0,background:'#f4f6fb',display:'flex',flexDirection:'column' }}>
            <div style={{ background:'#fff', padding:'20px 22px', flexShrink:0,
              borderBottom:'1px solid #e8edf5', borderTop:`3px solid ${GT_COLORS[selStat.g.type]}` }}>
              <span style={{ fontSize:9,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',
                color:'rgba(31,59,114,.38)' }}>{selStat.g.type}</span>
              <div style={{ fontSize:20,fontWeight:900,color:'#1F3B72',fontFamily:"'Barlow Semi Condensed',sans-serif",marginTop:4,marginBottom:4 }}>
                {selStat.code}
              </div>
              <div style={{ fontSize:12,color:'rgba(31,59,114,.5)',marginBottom:14 }}>{selStat.g.nom}</div>
              <div style={{ display:'flex',gap:16 }}>
                {[
                  {l:'Indicateurs',v:selStat.inds.length},
                  {l:'Atteints',   v:`${selStat.pct}%`  },
                ].map(x=>(
                  <div key={x.l}>
                    <div style={{ fontSize:20,fontWeight:900,color:GT_COLORS[selStat.g.type],fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{x.v}</div>
                    <div style={{ fontSize:9,color:'rgba(31,59,114,.35)',textTransform:'uppercase',letterSpacing:'.08em' }}>{x.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex:1,overflowY:'auto' }}>
              {selStat.inds.map((ind,i)=>(
                <div key={ind.id} onClick={()=>onSelect(ind)}
                  style={{ padding:'10px 20px',borderBottom:'1px solid var(--border)',
                    background:i%2===0?'#fff':'#f4f6fb',cursor:'pointer',
                    display:'flex',alignItems:'center',gap:12,transition:'background .12s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=`${GT_COLORS[selStat.g.type]}0a`}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=i%2===0?'#fff':'#f4f6fb'}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11,fontWeight:600,color:'var(--text-primary)',lineHeight:1.3 }}>{ind.indicateur}</div>
                    <div style={{ fontSize:10,color:'var(--text-faint)',marginTop:2 }}>{ind.service} · {ind.type_indicateur}</div>
                  </div>
                  <span style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)' }}>{fmt(ind.valeur_actuelle)}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:tendColor(ind.tendance) }}>{tendIcon(ind.tendance)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANNEAU 4 — Indicateurs calculés
════════════════════════════════════════════════════════════════════════════ */
function PanneauCalcules({ onSelect }:{ onSelect:(i:Indicateur)=>void }) {
  const [search,setSearch] = useState('')
  const [sort,setSort]     = useState<'service'|'perf'>('service')
  const [page,setPage]     = useState(1)
  const PER_PAGE = 12

  const calcules = useMemo(()=>{
    let data = INDICATEURS.filter(i=>i.calcule)
    if(search){const q=search.toLowerCase();data=data.filter(i=>i.indicateur.toLowerCase().includes(q)||i.mode_calcul.toLowerCase().includes(q))}
    if(sort==='service') return data.sort((a,b)=>a.service.localeCompare(b.service))
    return data.sort((a,b)=>(b.atteint_cible?1:0)-(a.atteint_cible?1:0))
  },[search,sort])

  const atteint = calcules.filter(i=>i.atteint_cible).length
  const paginated = calcules.slice((page-1)*PER_PAGE, page*PER_PAGE)

  return (
    <div style={{ background:'#f4f6fb', padding:'20px 32px 28px' }}>
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden',
      boxShadow:'0 2px 20px rgba(31,59,114,.08)', border:'1px solid var(--border)',
      borderTop:'3px solid #D97706' }}>
      {/* Header stats */}
      <div style={{ padding:'14px 24px', borderBottom:'1px solid var(--border)',
        background:'#fff', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        {[
          { label:'Calculés', v:NB_CALCULES, color:'#D97706' },
          { label:'Cibles ✓', v:atteint,    color:'#059669' },
          { label:'Sous obj.', v:NB_CALCULES-atteint, color:'#DC2626' },
        ].map(s=>(
          <div key={s.label} style={{ display:'flex',alignItems:'center',gap:8,
            background:'#f4f6fb',padding:'8px 14px',borderRadius:10,border:'1px solid var(--border)' }}>
            <div style={{ fontSize:20,fontWeight:900,color:s.color,fontFamily:"'Barlow Semi Condensed',sans-serif",lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:10.5,color:'var(--text-muted)',lineHeight:1.3 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ marginLeft:'auto',display:'flex',gap:8,alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-faint)',fontSize:12 }}>🔍</span>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Filtrer formules…"
              style={{ padding:'7px 12px 7px 30px',borderRadius:9,border:'1px solid var(--border)',
                background:'#fff',fontSize:12,color:'var(--text-primary)',outline:'none',width:200 }} />
          </div>
          <div style={{ display:'flex',borderRadius:20,overflow:'hidden',border:'1px solid var(--border)',flexShrink:0 }}>
            {(['service','perf'] as const).map(s=>(
              <button key={s} onClick={()=>{setSort(s);setPage(1)}} style={{
                padding:'5px 12px',border:'none',cursor:'pointer',fontSize:10.5,fontWeight:600,
                background:sort===s?'#D97706':'transparent',color:sort===s?'#fff':'var(--text-muted)',
                transition:'all .15s',
              }}>{s==='service'?'Service':'Perf.'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* En-têtes colonnes */}
      <div style={{ display:'grid',gridTemplateColumns:'36px 1fr 160px 80px 80px 60px',
        padding:'8px 24px',background:'#f4f6fb',borderBottom:'1px solid var(--border)',gap:12 }}>
        {['','Indicateur','Formule de calcul','Valeur','Objectif','✓'].map((h,i)=>(
          <span key={i} style={{ fontSize:9,fontWeight:700,letterSpacing:'.1em',
            textTransform:'uppercase',color:'var(--text-faint)' }}>{h}</span>
        ))}
      </div>

      {/* Lignes paginées */}
      <div>
        {calcules.length===0?(
          <div style={{ padding:40,textAlign:'center',color:'var(--text-faint)',fontSize:13 }}>Aucun résultat</div>
        ):paginated.map((ind,i)=>{
          const c = SERVICES[ind.service]?.couleur??'#D97706'
          return (
            <div key={ind.id} onClick={()=>onSelect(ind)}
              style={{ display:'grid',gridTemplateColumns:'36px 1fr 160px 80px 80px 60px',
                alignItems:'center',padding:'10px 24px',gap:12,cursor:'pointer',
                background:i%2===0?'#f4f6fb':'#fff',
                borderLeft:`3px solid transparent`,transition:'all .12s' }}
              onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.background=`${c}08`; el.style.borderLeftColor=c }}
              onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.background=i%2===0?'#f4f6fb':'#fff'; el.style.borderLeftColor='transparent' }}>
              <span style={{ fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:6,
                background:`${c}18`,color:c,textAlign:'center' }}>{ind.service}</span>
              <div>
                <div style={{ fontSize:12,fontWeight:600,color:'var(--text-primary)',lineHeight:1.3 }}>{ind.indicateur}</div>
                <div style={{ fontSize:10,color:'var(--text-faint)',marginTop:2 }}>{ind.groupe_nom}</div>
              </div>
              <code style={{ fontSize:10,color:'#1F3B72',background:'rgba(31,59,114,.06)',
                padding:'3px 8px',borderRadius:6,lineHeight:1.5,display:'block',
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                {ind.mode_calcul}
              </code>
              <span style={{ fontSize:12,fontWeight:700,color:'var(--text-primary)',textAlign:'right' }}>
                {fmt(ind.valeur_actuelle)}
              </span>
              <span style={{ fontSize:11,color:'var(--text-muted)',textAlign:'center' }}>{ind.objectif_cible}</span>
              <span style={{ fontSize:14,textAlign:'center',
                color:ind.atteint_cible?'#059669':'#DC2626',fontWeight:700 }}>
                {ind.atteint_cible?'✓':'✗'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <Pagination page={page} total={calcules.length} perPage={PER_PAGE}
        onChange={setPage} accent='#D97706' label='indicateurs calculés' />
    </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL PANEL SLIDE-IN
════════════════════════════════════════════════════════════════════════════ */
function DetailPanel({ ind,onClose }:{ ind:Indicateur|null; onClose:()=>void }) {
  const open = ind!==null
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(7,17,42,.45)',
        zIndex:100,opacity:open?1:0,transition:'opacity .3s',
        pointerEvents:open?'auto':'none',backdropFilter:'blur(2px)' }} />
      <div style={{ position:'fixed',top:0,right:0,bottom:0,width:500,background:'#fff',
        zIndex:101,transform:open?'translateX(0)':'translateX(100%)',
        transition:'transform .35s cubic-bezier(.4,0,.2,1)',
        display:'flex',flexDirection:'column',
        boxShadow:'-8px 0 48px rgba(7,17,42,.2)',overflowY:'auto' }}>
        {ind && <PanelContent ind={ind} onClose={onClose} />}
      </div>
    </>
  )
}

function PanelContent({ ind,onClose }:{ ind:Indicateur; onClose:()=>void }) {
  const c = ind.service_couleur
  return (
    <>
      {/* Header indicateur */}
      <div style={{ background:'#fff', padding:'20px 24px 18px', flexShrink:0,
        position:'relative', borderBottom:'1px solid #e8edf5', borderTop:`3px solid ${c}` }}>
        <button onClick={onClose} style={{ position:'absolute',top:12,right:14,
          width:28,height:28,borderRadius:8,background:'#f4f6fb',
          border:'1px solid #e8edf5',color:'rgba(31,59,114,.5)',
          fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700 }}>×</button>

        <div style={{ display:'flex',gap:7,marginBottom:12,flexWrap:'wrap' }}>
          <span style={{ fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',
            background:`${c}14`,padding:'3px 10px',borderRadius:20,color:c }}>
            {ind.service}
          </span>
          <span style={{ fontSize:10,color:'rgba(31,59,114,.42)',fontWeight:500 }}>{ind.service_label}</span>
          {ind.priorite===1 && (
            <span style={{ fontSize:10,fontWeight:700,background:'rgba(150,193,30,.12)',
              border:'1px solid rgba(150,193,30,.25)',padding:'2px 8px',borderRadius:20,
              color:'#4d6610',marginLeft:'auto',marginRight:32 }}>★ Priorité 1</span>
          )}
        </div>

        <h2 style={{ color:'#1F3B72',fontSize:14,fontWeight:800,fontFamily:"'Barlow Semi Condensed',sans-serif",
          lineHeight:1.4,marginBottom:14 }}>{ind.indicateur}</h2>

        <div style={{ display:'flex',gap:20,alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',
              color:'rgba(31,59,114,.35)',marginBottom:4 }}>Valeur actuelle</div>
            <div style={{ fontSize:32,fontWeight:900,color:c,lineHeight:1,fontFamily:"'Barlow Semi Condensed',sans-serif" }}>
              {fmt(ind.valeur_actuelle)}
            </div>
          </div>
          <div style={{ paddingBottom:4 }}>
            <div style={{ fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',
              color:'rgba(31,59,114,.35)',marginBottom:4 }}>Tendance</div>
            <div style={{ fontSize:20,fontWeight:800,
              color:ind.tendance==='hausse'?'#059669':ind.tendance==='baisse'?'#E84040':'rgba(31,59,114,.4)' }}>
              {tendIcon(ind.tendance)} {ind.tendance}
            </div>
          </div>
          <div style={{ marginLeft:'auto',paddingBottom:4,textAlign:'right' }}>
            <div style={{ fontSize:9,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',
              color:'rgba(31,59,114,.35)',marginBottom:4 }}>Objectif</div>
            <div style={{ fontSize:13,fontWeight:700,color:'rgba(31,59,114,.6)',marginBottom:8 }}>{ind.objectif_cible}</div>
            <span style={{ fontSize:11,fontWeight:700,padding:'3px 12px',borderRadius:20,
              background:ind.atteint_cible?'rgba(150,193,30,.12)':'rgba(220,38,38,.10)',
              color:ind.atteint_cible?'#4d6610':'#b91c1c',
              border:`1px solid ${ind.atteint_cible?'rgba(150,193,30,.25)':'rgba(220,38,38,.20)'}` }}>
              {ind.atteint_cible?'✓ Cible atteinte':'✗ Sous objectif'}
            </span>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:20,flex:1 }}>

        <PS title="Formule de calcul" icon={<FunctionSquare size={13}/>}>
          <div style={{ fontFamily:'monospace',fontSize:12,background:'rgba(31,59,114,.05)',
            padding:'12px 16px',borderRadius:10,color:'#1F3B72',border:'1px solid rgba(31,59,114,.12)',
            fontWeight:600,lineHeight:1.6 }}>{ind.mode_calcul}</div>
        </PS>

        <PS title="Processus & Périmètre" icon={<Layers size={13}/>}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <IB label="Groupe processus"  value={ind.groupe_nom} />
            <IB label="Type processus"    value={ind.groupe_type}     badge={GT_COLORS[ind.groupe_type]} />
            <IB label="Type indicateur"   value={ind.type_indicateur} badge={TYPE_COLORS[ind.type_indicateur]} />
            <IB label="Fréquence MAJ"     value={ind.frequence_maj} />
          </div>
        </PS>

        <PS title="Pilotage & Responsabilités" icon={<Users size={13}/>}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <IB label="Pilote processus"    value={ind.pilote_processus} />
            <IB label="Resp. collecte"      value={ind.responsable_collecte} />
            <IB label="Source reporting"    value={ind.source_reporting} />
            <IB label="Mode collecte"       value={ind.calcule?'Calculé auto':'Saisie manuelle'} />
          </div>
        </PS>

        <PS title="Évolution" icon={<TrendingUp size={13}/>}>
          <div style={{ display:'flex',gap:16,alignItems:'center',marginBottom:ind.objectif_cible.startsWith('>')?14:0 }}>
            <div>
              <div style={{ fontSize:9,color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4 }}>Période préc.</div>
              <div style={{ fontSize:20,fontWeight:700,color:'var(--text-muted)' }}>{fmt(ind.valeur_precedente)}</div>
            </div>
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
              <div style={{ height:1,width:'100%',background:'var(--border)' }} />
              <span style={{ fontSize:22,fontWeight:800,color:tendColor(ind.tendance) }}>{tendIcon(ind.tendance)}</span>
              <div style={{ height:1,width:'100%',background:'var(--border)' }} />
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:9,color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4 }}>Actuel</div>
              <div style={{ fontSize:20,fontWeight:700,color:'var(--text-primary)' }}>{fmt(ind.valeur_actuelle)}</div>
            </div>
          </div>
          {ind.objectif_cible.startsWith('>') && (
            <>
              <div style={{ background:'#f4f6fb',borderRadius:99,height:8,overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${Math.min(ind.valeur_actuelle,100)}%`,
                  background:`linear-gradient(90deg,${c}88,${c})`,borderRadius:99,transition:'width 1s' }} />
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',marginTop:6,fontSize:10 }}>
                <span style={{ color:'var(--text-faint)' }}>0</span>
                <span style={{ color:'var(--text-faint)' }}>Obj : {ind.objectif_cible}</span>
                <span style={{ color:'var(--text-faint)' }}>100</span>
              </div>
            </>
          )}
        </PS>

        {ind.tags.length>0 && (
          <PS title="Étiquettes" icon={<Tag size={13}/>}>
            <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
              {ind.tags.map(tag=>(
                <span key={tag} style={{ fontSize:11,fontWeight:600,padding:'4px 12px',borderRadius:20,
                  background:`${c}10`,border:`1px solid ${c}25`,color:c }}>{tag}</span>
              ))}
            </div>
          </PS>
        )}
      </div>
    </>
  )
}

function PS({ title,icon,children }:{ title:string;icon:React.ReactNode;children:React.ReactNode }) {
  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
        <span style={{ color:'#1F3B72',display:'flex',alignItems:'center' }}>{icon}</span>
        <span style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--text-muted)' }}>{title}</span>
        <div style={{ flex:1,height:1,background:'var(--border)' }} />
      </div>
      {children}
    </div>
  )
}

function IB({ label,value,badge }:{ label:string;value:string;badge?:string }) {
  return (
    <div style={{ background:'#f4f6fb',borderRadius:8,padding:'10px 12px' }}>
      <div style={{ fontSize:9,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',
        color:'var(--text-faint)',marginBottom:5 }}>{label}</div>
      {badge
        ? <span style={{ fontSize:11,fontWeight:600,padding:'2px 10px',borderRadius:20,
            background:`${badge}12`,border:`1px solid ${badge}25`,color:badge }}>{value}</span>
        : <div style={{ fontSize:12,fontWeight:600,color:'var(--text-primary)',lineHeight:1.4 }}>{value}</div>
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTIONS BAS DE PAGE
════════════════════════════════════════════════════════════════════════════ */
const DATASOURCES = [
  { name:'AarSENEAU (Oracle)',          desc:"ERP de facturation — source principale de vérité",                                                    tables:42, status:'live',   c:'#f97316' },
  { name:'Data Warehouse (PostgreSQL)', desc:'Entrepôt de données analytiques — historique 3 ans',                                                  tables:18, status:'live',   c:'#1F3B72' },
  { name:'DigiMet',                     desc:'Réalisation des métrés et travaux liés aux branchements ordinaires et sociaux',                        tables:9,  status:'recent', c:'#96C11E' },
  { name:'Gordon API',                  desc:"API de collecte terrain — équipes de relevé",                                                          tables:4,  status:'recent', c:'#8b5cf6' },
  { name:'Portail RH / HRAccès',        desc:'Gestion de la paie et du personnel — données RH, contrats, congés et historiques de rémunération',    tables:11, status:'live',   c:'#ec4899' },
  { name:'Survey',                        desc:'Collecte terrain des données de production — formulaires mobiles remplis par les agents de relevé',     tables:6,  status:'recent', c:'#0891B2' },
]
function SectionSources() {
  return (
    <div>
      <SH icon="🗄️" title="Sources de données & Lignage" />
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14,marginBottom:16 }}>
        {DATASOURCES.map(ds=>(
          <div key={ds.name} style={{ background:'#fff',borderRadius:14,padding:'16px 18px',
            borderTop:`3px solid ${ds.c}`,border:'1px solid var(--border)',
            boxShadow:'0 2px 8px rgba(31,59,114,.05)',transition:'transform .2s,box-shadow .2s' }}
            onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.transform='translateY(-2px)'; el.style.boxShadow='0 8px 24px rgba(31,59,114,.1)' }}
            onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.transform='none'; el.style.boxShadow='0 2px 8px rgba(31,59,114,.05)' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
              <span style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{ds.name}</span>
              <span style={{ fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,
                background:ds.status==='live'?'rgba(5,150,105,.12)':'rgba(245,158,11,.12)',
                color:ds.status==='live'?'#059669':'#d97706' }}>
                {ds.status==='live'?'● Actif':'● Récent'}
              </span>
            </div>
            <p style={{ fontSize:11,color:'var(--text-muted)',lineHeight:1.5,marginBottom:8 }}>{ds.desc}</p>
            <span style={{ fontSize:10,color:'var(--text-faint)' }}>{ds.tables} tables</span>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff',borderRadius:14,padding:'18px 24px',border:'1px solid var(--border)',
        boxShadow:'0 2px 8px rgba(31,59,114,.05)',display:'flex',alignItems:'center',flexWrap:'wrap',gap:0 }}>
        {[{l:'Oracle AarSENEAU',c:'#f97316'},{l:'ETL Talend',c:'#8b5cf6'},{l:'DWH PostgreSQL',c:'#1F3B72'},{l:'Dashboard Dash',c:'#96C11E'}]
          .map((s,i,arr)=>(
            <div key={s.l} style={{ display:'flex',alignItems:'center' }}>
              <div style={{ padding:'10px 16px',borderRadius:10,background:`${s.c}0e`,border:`1px solid ${s.c}28` }}>
                <div style={{ fontSize:11,fontWeight:700,color:s.c }}>{s.l}</div>
              </div>
              {i<arr.length-1&&<div style={{ display:'flex',alignItems:'center',padding:'0 6px' }}>
                <div style={{ width:20,height:1,background:'var(--border)' }} />
                <span style={{ color:'var(--text-faint)',fontSize:14 }}>›</span>
              </div>}
            </div>
          ))}
        <p style={{ width:'100%',fontSize:10,color:'var(--text-faint)',marginTop:12 }}>Fréq. de rafraîchissement : 15 min · Dernière MAJ : il y a 8 min</p>
      </div>
    </div>
  )
}

const QM=[
  {label:'Complétude',value:96.8,icon:'✅',color:'#96C11E'},{label:'Fraîcheur',value:98.2,icon:'🕐',color:'#3b82f6'},
  {label:'Unicité',value:99.1,icon:'🔑',color:'#8b5cf6'},{label:'Cohérence',value:94.5,icon:'🔗',color:'#f59e0b'},
  {label:'Précision',value:97.3,icon:'🎯',color:'#ec4899'},{label:'Conformité',value:95.0,icon:'📋',color:'#14b8a6'},
]
function SectionQualite() {
  return (
    <div>
      <SH icon="📊" title="Qualité des données" />
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14 }}>
        {QM.map(m=>(
          <div key={m.label} style={{ background:'#fff',borderRadius:14,padding:'16px 18px',
            border:'1px solid var(--border)',boxShadow:'0 2px 8px rgba(31,59,114,.05)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
              <div style={{ width:32,height:32,borderRadius:9,background:`${m.color}15`,
                border:`1px solid ${m.color}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>{m.icon}</div>
              <span style={{ fontSize:12,fontWeight:600,color:'var(--text-primary)' }}>{m.label}</span>
            </div>
            <div style={{ fontSize:26,fontWeight:900,color:m.color,lineHeight:1,marginBottom:10 }}>{m.value}%</div>
            <div style={{ background:'#f4f6fb',borderRadius:99,height:5 }}>
              <div style={{ height:'100%',width:`${m.value}%`,background:`linear-gradient(90deg,${m.color}88,${m.color})`,borderRadius:99 }} />
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',marginTop:6 }}>
              <span style={{ fontSize:9,color:'var(--text-faint)' }}>Cible 95%</span>
              <span style={{ fontSize:9,fontWeight:700,color:m.value>=95?'#059669':'#dc2626' }}>{m.value>=95?'✓ OK':'⚠ Sous cible'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const GL=[
  /* ── Facturation & Recouvrement ─────────────────────────────────────────── */
  {term:"CA",                     def:"Chiffre d'Affaires — montant total facturé sur la période sélectionnée. Source : table FACTURATION.",                                                                                                       domain:"Financier"},
  {term:"Encaissement",           def:"Montant effectivement reçu en règlement des factures émises. Calcul : SUM(MONTANT_REGLE). Source : table REGLEMENTS.",                                                                                      domain:"Financier"},
  {term:"Taux de recouvrement",   def:"Ratio Encaissements ÷ CA × 100. Mesure la capacité à collecter les créances. Cible : > 80 %. Un taux < 60 % déclenche une alerte rouge.",                                                                  domain:"KPI"},
  {term:"Impayé",                 def:"Facture non réglée au-delà du délai contractuel (30 jours). Calcul : CA – Encaissements sur la période.",                                                                                                   domain:"Financier"},
  {term:"Taux d'impayé",          def:"Ratio Montant impayé ÷ CA × 100. Indicateur de risque crédit. Cible : < 20 %.",                                                                                                                             domain:"KPI"},
  {term:"DT",                     def:"Direction Territoriale — unité géographique de gestion regroupant plusieurs secteurs et abonnés.",                                                                                                           domain:"Organisationnel"},
  {term:"Score Client 360°",      def:"Score 0–100 calculé par modèle ML sur 5 critères : historique paiement, ancienneté, montant moyen, fréquence retards, incidents réseau. Pondération : 30/20/20/20/10.",                                     domain:"IA / ML"},
  {term:"Indicateur Calculé",     def:"Indicateur dérivé d'une formule combinant plusieurs sources de données. Ne provient pas directement d'un champ brut.",                                                                                      domain:"Gouvernance"},
  {term:"Pilote Processus",       def:"Responsable métier garant de la fiabilité, de la mise à jour et de l'interprétation d'un indicateur.",                                                                                                      domain:"Gouvernance"},

  /* ── Ressources Humaines ────────────────────────────────────────────────── */
  {term:"Masse Salariale",        def:"Total des rémunérations brutes versées aux salariés actifs. Calcul : SUM(DISTINCT REVENU) WHERE SUBSTR(RUBRIQUE,1,3)='A03'. Source : DWH.DTM_DRHT_COLLABORATEUR.",                                          domain:"RH"},
  {term:"Salariés Actifs",        def:"Effectif en poste à date. Calcul : COUNT(DISTINCT MATRICULE) WHERE DATE_SORTIE = DATE '2999-12-31' AND TYPE_CONTRAT <> 'JR'. Exclut prestataires et journaliers.",                                          domain:"RH"},
  {term:"Salaire Moyen",          def:"Rémunération moyenne par salarié actif. Calcul : Masse Salariale ÷ Nombre Salariés Actifs. Indicateur calculé en Python.",                                                                                  domain:"RH"},
  {term:"Effectif Femmes",        def:"Nombre de salariées actives. Calcul : COUNT(DISTINCT MATRICULE) WHERE SEXE = 'FEMININ' AND DATE_SORTIE = DATE '2999-12-31' AND TYPE_CONTRAT <> 'JR'.",                                                      domain:"RH"},
  {term:"Effectif Hommes",        def:"Nombre de salariés masculins actifs. Calcul : Effectif Total − Effectif Femmes.",                                                                                                                            domain:"RH"},
  {term:"Taux de Féminisation",   def:"Part des femmes dans l'effectif total. Calcul : Effectif Femmes ÷ Effectif Total × 100. Cible SEN'EAU : > 20 %. En dessous du seuil, pastille rouge affichée.",                                            domain:"RH"},
  {term:"Montant Heures Sup",     def:"Montant brut versé au titre des heures supplémentaires. Calcul : SUM(DISTINCT HEURE_SUP_MONT). Source : DWH.DTM_DRHT_COLLABORATEUR.",                                                                       domain:"RH"},
  {term:"Nb Heures Sup",          def:"Volume total d'heures supplémentaires effectuées. Calcul : SUM(DISTINCT HEURE_SUP). Source : DWH.DTM_DRHT_COLLABORATEUR.",                                                                                  domain:"RH"},
  {term:"Taux Heures Sup",        def:"Part des heures supplémentaires dans la masse salariale. Calcul : Montant HS ÷ Masse Salariale × 100. Cible : < 2,5 %. Au-dessus du seuil, alerte rouge.",                                                 domain:"RH"},
  {term:"Heures Formation",       def:"Volume d'heures de formation dispensées aux salariés. Calcul : SUM(HEURE_FORMATION) WHERE SUBSTR(RUBRIQUE,1,3)='A03'. Objectif annuel : 25 000 heures.",                                                    domain:"RH"},
  {term:"Collaborateurs Formés",  def:"Nombre de salariés ayant suivi au moins une formation sur la période. Calcul : COUNT(DISTINCT MATRICULE) WHERE HEURE_FORMATION <> 0.",                                                                      domain:"RH"},
  {term:"% Collaborateurs Formés",def:"Taux d'accès à la formation. Calcul : Collaborateurs Formés ÷ Effectif Total × 100.",                                                                                                                       domain:"RH"},
  {term:"Drift Salarial",         def:"Mesure la dérive du coût par tête. Calcul : Croissance Masse (%) − Croissance Effectif (%). Drift > +3 % = alerte ; Drift < 0 % = optimisation ou gel salarial.",                                          domain:"RH"},
  {term:"Concentration Top 20%",  def:"Part de la masse salariale portée par les 20 % des salariés les mieux rémunérés. Calcul via fenêtrage Oracle (ROW_NUMBER). Seuil normal : 40–55 %. > 70 % = forte inégalité.",                             domain:"RH"},
  {term:"TYPE_CONTRAT = 'JR'",    def:"Code contrat journalier (prestataire journée). Ces salariés sont exclus de tous les KPI RH car non permanents.",                                                                                            domain:"RH"},
  {term:"DATE_SORTIE = 2999-12-31",def:"Convention Oracle DWH pour un salarié toujours en poste (date de sortie fictive dans le futur). Filtre systématique sur les salariés actifs.",                                                             domain:"RH"},
]
const DC:Record<string,string>={Financier:"#1F3B72",KPI:"#96C11E",Organisationnel:"#8b5cf6","IA / ML":"#ec4899",Technique:"#3b82f6",Gouvernance:"#14b8a6",RH:"#E65100"}
function SectionGlossaire() {
  const [q,setQ]=useState('')
  const f=GL.filter(g=>g.term.toLowerCase().includes(q.toLowerCase())||g.def.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <SH icon="📝" title="Glossaire métier" />
      <div style={{ background:'#fff',borderRadius:14,border:'1px solid var(--border)',overflow:'hidden',
        boxShadow:'0 2px 8px rgba(31,59,114,.05)' }}>
        <div style={{ padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'#f4f6fb' }}>
          <div style={{ position:'relative',maxWidth:360 }}>
            <span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-faint)' }}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher…"
              style={{ width:'100%',padding:'7px 12px 7px 30px',borderRadius:8,border:'1px solid var(--border)',
                fontSize:12,outline:'none',background:'#fff',color:'var(--text-primary)' }} />
          </div>
        </div>
        <table style={{ width:'100%',borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f4f6fb',borderBottom:'1px solid var(--border)' }}>
              {['Terme','Définition','Domaine'].map(h=>(
                <th key={h} style={{ padding:'9px 18px',textAlign:'left',fontSize:9,fontWeight:700,
                  letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text-faint)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.map((g,i)=>(
              <tr key={g.term} style={{ borderBottom:'1px solid var(--border)',background:i%2===0?'#fff':'#f4f6fb' }}>
                <td style={{ padding:'10px 18px',fontWeight:700,fontSize:12,color:'#1F3B72',whiteSpace:'nowrap' }}>{g.term}</td>
                <td style={{ padding:'10px 18px',fontSize:11,color:'var(--text-muted)',lineHeight:1.5 }}>{g.def}</td>
                <td style={{ padding:'10px 18px' }}>
                  <span style={{ padding:'2px 10px',borderRadius:20,fontSize:10,fontWeight:600,
                    background:`${DC[g.domain]??'#1F3B72'}12`,color:DC[g.domain]??'#1F3B72',
                    border:`1px solid ${DC[g.domain]??'#1F3B72'}20` }}>{g.domain}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   GANTT — FEUILLE DE ROUTE 2026-2027
════════════════════════════════════════════════════════════════════════════ */

// Mois affichés sur l'axe X
const GANTT_COLS = [
  { y:2026, ms:['Jan','Fév','Mar','Avr','Mai','Jun','Juil','Aoû','Sep','Oct','Nov','Déc'] },
  { y:2027, ms:['Jan','Fév','Mar','Avr','Mai','Jun','Juil','Aoû','Sep','Oct','Nov','Déc'] },
]

// Mar 2026 = index 2 → "aujourd'hui" dans la démo
const TODAY_IDX = 2

/* ── Helpers alertes échéances ───────────────────────────────────────────── */
const MONTH_MAP: Record<string, number> = {
  'Jan':0,'Fév':1,'Mar':2,'Avr':3,'Mai':4,'Jun':5,
  'Juil':6,'Aoû':7,'Sep':8,'Oct':9,'Nov':10,'Déc':11,
}
function parseDateFin(fin: string): Date {
  const [m, y] = fin.split(' ')
  const month = MONTH_MAP[m] ?? 0
  const year  = parseInt(y)
  return new Date(year, month + 1, 0)  // dernier jour du mois
}
function daysUntil(date: Date): number {
  const today  = new Date(); today.setHours(0,0,0,0)
  const target = new Date(date); target.setHours(0,0,0,0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function ganttLeft(debut: string)  { return (parseGanttDate(debut) / GANTT_TOTAL) * 100 }
function ganttWidth(debut: string, fin: string) {
  const s = parseGanttDate(debut)
  const e = parseGanttDate(fin) + 1
  return ((e - s) / GANTT_TOTAL) * 100
}

// ── Détail slide-in ─────────────────────────────────────────────────────────
function JalonDetail({ jalon, phaseColor, onClose }: {
  jalon: import('@/lib/roadmapData').Jalon
  phaseColor: string
  onClose: () => void
}) {
  const meta = STATUT_META[jalon.statut as RoadmapStatut]
  const done    = jalon.sousTaches.filter(s => s.statut === 'FAIT').length
  const total   = jalon.sousTaches.length
  const pct     = total ? Math.round((done / total) * 100) : 0

  return (
    <div style={{
      background:'#fff', borderRadius:14,
      border:`1px solid ${phaseColor}22`,
      boxShadow:`0 8px 32px ${phaseColor}18`,
      margin:'0 0 2px', overflow:'hidden',
      animation:'slideDown .18s ease',
    }}>
      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg,${phaseColor}12,${phaseColor}06)`,
        borderBottom:`1px solid ${phaseColor}18`,
        padding:'14px 20px', display:'flex', alignItems:'flex-start', gap:12,
      }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:800, color:phaseColor,
              background:`${phaseColor}15`, padding:'2px 8px', borderRadius:6,
              fontFamily:'monospace' }}>{jalon.code}</span>
            <span style={{ fontSize:13, fontWeight:800, color:'#1F3B72',
              fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{jalon.titre}</span>
            <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20,
              background:meta.bg, color:meta.color, letterSpacing:'.04em',
              textTransform:'uppercase', marginLeft:4 }}>{meta.label}</span>
          </div>
          <div style={{ display:'flex', gap:16 }}>
            <span style={{ fontSize:10, color:'rgba(31,59,114,.45)' }}>📅 {jalon.debut} → {jalon.fin}</span>
            <span style={{ fontSize:10, color:'rgba(31,59,114,.45)' }}>👤 {jalon.responsable}</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          width:26, height:26, borderRadius:7, border:'none',
          background:'rgba(31,59,114,.08)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, color:'rgba(31,59,114,.5)', flexShrink:0,
        }}>✕</button>
      </div>

      <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Indicateur de succès */}
        <div style={{ gridColumn:'1/-1' }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase',
            color:'rgba(31,59,114,.35)', marginBottom:5 }}>Indicateur de succès</div>
          <div style={{ fontSize:11.5, color:'#1F3B72', fontWeight:600,
            background:'rgba(31,59,114,.04)', borderRadius:8, padding:'8px 12px',
            borderLeft:`3px solid ${phaseColor}` }}>
            {jalon.indicateur}
          </div>
        </div>

        {/* Observation */}
        {jalon.observation && (
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase',
              color:'rgba(31,59,114,.35)', marginBottom:5 }}>Note / Observation</div>
            <div style={{ fontSize:11, color:'rgba(31,59,114,.55)', fontStyle:'italic',
              background:'rgba(217,119,6,.04)', borderRadius:8, padding:'7px 12px',
              borderLeft:'3px solid #D97706' }}>
              {jalon.observation}
            </div>
          </div>
        )}

        {/* Barre avancement sous-tâches */}
        <div style={{ gridColumn:'1/-1' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase',
              color:'rgba(31,59,114,.35)' }}>Sous-tâches — {done}/{total} réalisées</span>
            <span style={{ fontSize:10, fontWeight:700, color:phaseColor }}>{pct}%</span>
          </div>
          <div style={{ background:'#f0f4fa', borderRadius:99, height:5 }}>
            <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${phaseColor}88,${phaseColor})`,
              borderRadius:99, transition:'width .4s' }} />
          </div>
        </div>

        {/* Liste sous-tâches */}
        <div style={{ gridColumn:'1/-1' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {jalon.sousTaches.map((st, i) => {
              const sm = STATUT_META[st.statut as RoadmapStatut]
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'flex-start', gap:10,
                  padding:'8px 10px', borderRadius:9,
                  background: st.statut==='FAIT' ? 'rgba(5,150,105,.04)' : '#fafbfe',
                  border:`1px solid ${st.statut==='FAIT'?'rgba(5,150,105,.12)':'rgba(31,59,114,.07)'}`,
                }}>
                  <div style={{
                    width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1,
                    background:sm.bg, border:`1.5px solid ${sm.dot}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:9, color:sm.color, fontWeight:800,
                  }}>
                    {st.statut==='FAIT'?'✓':st.statut==='EN COURS'?'◑':'○'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11.5, fontWeight:600,
                      color: st.statut==='FAIT'?'rgba(31,59,114,.5)':'#1F3B72',
                      textDecoration: st.statut==='FAIT'?'line-through':'none',
                      lineHeight:1.3 }}>
                      {st.titre}
                    </div>
                    {st.detail && (
                      <div style={{ fontSize:10, color:'rgba(31,59,114,.38)', marginTop:2 }}>{st.detail}</div>
                    )}
                  </div>
                  <span style={{ fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:99,
                    background:sm.bg, color:sm.color, letterSpacing:'.04em',
                    textTransform:'uppercase', flexShrink:0 }}>{sm.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────
function SectionFeuilleDeRoute() {
  const [selectedCode, setSelectedCode] = useState<string|null>(null)
  const stats   = roadmapStats()
  const pctFait    = Math.round((stats.fait    / stats.total) * 100)
  const pctEnCours = Math.round((stats.enCours / stats.total) * 100)

  const toggle = (code: string) => setSelectedCode(p => p === code ? null : code)

  const LEFT_W = 240 // px — colonne labels

  /* ── Calcul des alertes échéances (client-only — new Date() non-déterministe côté SSR) ── */
  type DeadlineAlert = { jalon: (typeof PHASES)[0]['jalons'][0]; phase: (typeof PHASES)[0]; days: number }
  const [deadlineAlerts, setDeadlineAlerts] = useState<DeadlineAlert[]>([])
  useEffect(() => {
    const alerts = PHASES.flatMap(phase =>
      phase.jalons
        .filter(j => j.statut !== 'FAIT')
        .map(j => ({ jalon: j, phase, days: daysUntil(parseDateFin(j.fin)) }))
        .filter(({ days }) => days >= 0 && days <= 30)
    ).sort((a, b) => a.days - b.days)
    setDeadlineAlerts(alerts)
  }, [])

  const critiques = deadlineAlerts.filter(a => a.days <= 15)
  const warnings  = deadlineAlerts.filter(a => a.days > 15)

  return (
    <div>
      <SH icon="🗺️" title="Feuille de route Entrepôt de données 2026-2027" />

      {/* ── KPI résumé ──────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom: deadlineAlerts.length > 0 ? 14 : 18 }}>
        {([
          { l:'Jalons totaux', v:stats.total,   c:'#1F3B72', bg:'rgba(31,59,114,.07)'   },
          { l:'Réalisés',      v:stats.fait,    c:'#059669', bg:'rgba(5,150,105,.07)'   },
          { l:'En cours',      v:stats.enCours, c:'#D97706', bg:'rgba(217,119,6,.07)'   },
          { l:'À planifier',   v:stats.aFaire,  c:'#6B7280', bg:'rgba(107,114,128,.07)' },
        ] as { l:string;v:number;c:string;bg:string }[]).map(k => (
          <div key={k.l} style={{ background:'#fff', borderRadius:12, padding:'12px 16px',
            border:'1px solid var(--border)', boxShadow:'0 1px 6px rgba(31,59,114,.05)',
            display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:k.bg, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:20, fontWeight:900, color:k.c, lineHeight:1 }}>{k.v}</span>
            </div>
            <span style={{ fontSize:11.5, fontWeight:600, color:'var(--text-muted)', lineHeight:1.3 }}>{k.l}</span>
          </div>
        ))}
      </div>

      {/* ── Alertes échéances J+15 / J+30 ───────────────────────────────── */}
      {deadlineAlerts.length > 0 && (
        <div style={{
          borderRadius:14, overflow:'hidden', marginBottom:18,
          border: critiques.length > 0 ? '1px solid rgba(232,64,64,.22)' : '1px solid rgba(217,119,6,.22)',
          background: critiques.length > 0 ? 'rgba(232,64,64,.03)' : 'rgba(217,119,6,.03)',
        }}>
          {/* En-tête alerte */}
          <div style={{
            padding:'10px 16px',
            borderBottom: critiques.length > 0 ? '1px solid rgba(232,64,64,.12)' : '1px solid rgba(217,119,6,.12)',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14 }}>{critiques.length > 0 ? '🔴' : '🟠'}</span>
              <span style={{ fontSize:12, fontWeight:800,
                color: critiques.length > 0 ? '#E84040' : '#D97706',
                fontFamily:"'Barlow Semi Condensed',sans-serif", letterSpacing:'.02em' }}>
                {critiques.length > 0
                  ? `${critiques.length} jalon${critiques.length>1?'s':''} à échéance dans ≤ 15 jours`
                  : `${warnings.length} jalon${warnings.length>1?'s':''} à échéance dans ≤ 30 jours`
                }
                {critiques.length > 0 && warnings.length > 0 && (
                  <span style={{ fontWeight:500, color:'#D97706', marginLeft:10 }}>
                    + {warnings.length} entre 16 et 30j
                  </span>
                )}
              </span>
            </div>
            <span suppressHydrationWarning style={{ fontSize:10, color:'rgba(31,59,114,.35)', fontWeight:500 }}>
              Aujourd'hui : {new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
            </span>
          </div>

          {/* Liste alertes */}
          <div style={{ display:'flex', flexDirection:'column' }}>
            {deadlineAlerts.map(({ jalon, phase, days }, idx) => {
              const isCrit  = days <= 15
              const urgColor = isCrit ? '#E84040' : '#D97706'
              const urgBg   = isCrit ? 'rgba(232,64,64,.06)' : 'rgba(217,119,6,.04)'
              const badge   = days === 0 ? "Aujourd'hui !" : days === 1 ? '1 jour' : `J+${days}`
              return (
                <div
                  key={jalon.code}
                  onClick={() => toggle(jalon.code)}
                  style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 16px', cursor:'pointer',
                    background: selectedCode === jalon.code ? urgBg : 'transparent',
                    borderBottom: idx < deadlineAlerts.length - 1
                      ? '1px solid rgba(31,59,114,.05)' : 'none',
                    transition:'background .15s',
                  }}
                  onMouseEnter={e => { if(selectedCode !== jalon.code)(e.currentTarget as HTMLDivElement).style.background = urgBg }}
                  onMouseLeave={e => { if(selectedCode !== jalon.code)(e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  {/* Badge urgence */}
                  <div style={{
                    flexShrink:0, minWidth:54, textAlign:'center',
                    padding:'3px 10px', borderRadius:99,
                    background: isCrit ? 'rgba(232,64,64,.12)' : 'rgba(217,119,6,.12)',
                    border:`1px solid ${urgColor}30`,
                  }}>
                    <span style={{ fontSize:10, fontWeight:900, color:urgColor,
                      fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{badge}</span>
                  </div>

                  {/* Code + titre */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:phase.color,
                        background:`${phase.color}12`, padding:'1px 7px', borderRadius:99 }}>
                        {jalon.code}
                      </span>
                      <span style={{ fontSize:12.5, fontWeight:700, color:'#1F3B72',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {jalon.titre}
                      </span>
                    </div>
                    <div style={{ fontSize:10.5, color:'rgba(31,59,114,.45)', display:'flex', gap:10, flexWrap:'wrap' }}>
                      <span>👤 {jalon.responsable}</span>
                      <span>🏁 Fin : {jalon.fin}</span>
                      {jalon.observation && (
                        <span style={{ fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260 }}>
                          {jalon.observation}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Statut + flèche */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{
                      fontSize:9.5, fontWeight:700, padding:'2px 8px', borderRadius:99,
                      background:STATUT_META[jalon.statut as RoadmapStatut].bg,
                      color:STATUT_META[jalon.statut as RoadmapStatut].color,
                    }}>
                      {STATUT_META[jalon.statut as RoadmapStatut].label}
                    </span>
                    <span style={{ fontSize:11, color:'rgba(31,59,114,.25)',
                      transform: selectedCode === jalon.code ? 'rotate(90deg)' : 'none',
                      transition:'transform .2s' }}>›</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Diagramme de Gantt ───────────────────────────────────────────── */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid var(--border)',
        boxShadow:'0 2px 12px rgba(31,59,114,.07)', overflow:'hidden' }}>

        {/* En-tête années + mois */}
        <div style={{ display:'flex', borderBottom:'2px solid #e8eef7', background:'#f4f7fb' }}>
          {/* Col labels (vide) */}
          <div style={{ width:LEFT_W, flexShrink:0, borderRight:'1px solid #e8eef7',
            padding:'0 16px', display:'flex', alignItems:'flex-end', paddingBottom:7 }}>
            <div style={{ display:'flex', gap:12 }}>
              {([['#059669','Fait'],['#D97706','En cours'],['#9CA3AF','À faire'],['#6366f1','Permanent']] as [string,string][]).map(([c,l])=>(
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:7, height:7, borderRadius:99, background:c }} />
                  <span style={{ fontSize:9, color:'var(--text-faint)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Années + mois */}
          <div style={{ flex:1, minWidth:0 }}>
            {/* Années */}
            <div style={{ display:'flex', borderBottom:'1px solid #e8eef7' }}>
              {GANTT_COLS.map(yr => (
                <div key={yr.y} style={{ flex:12, display:'flex', justifyContent:'center',
                  padding:'5px 0', borderRight:'1px solid #dde4ef' }}>
                  <span style={{ fontSize:10, fontWeight:800, color:'#1F3B72',
                    letterSpacing:'.05em', fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{yr.y}</span>
                </div>
              ))}
            </div>
            {/* Mois */}
            <div style={{ display:'flex' }}>
              {GANTT_COLS.flatMap(yr => yr.ms.map((m, mi) => (
                <div key={`${yr.y}-${m}`} style={{
                  flex:1, textAlign:'center', padding:'4px 0',
                  borderRight: mi===11 ? '1px solid #dde4ef' : '1px solid #edf1f7',
                  background: yr.y===2026 && mi===TODAY_IDX ? 'rgba(232,64,64,.06)' : 'transparent',
                }}>
                  <span style={{ fontSize:8.5, fontWeight:600,
                    color: yr.y===2026 && mi===TODAY_IDX ? '#E84040' : 'rgba(31,59,114,.35)',
                    letterSpacing:'.02em' }}>{m}</span>
                </div>
              )))}
            </div>
          </div>
        </div>

        {/* Lignes Gantt */}
        {PHASES.map((phase, pi) => (
          <div key={phase.id}>

            {/* ── En-tête de phase ─────────────────────────────────────── */}
            <div style={{
              display:'flex',
              background:`linear-gradient(90deg,${phase.color}0f,${phase.color}05)`,
              borderTop: pi > 0 ? '2px solid #e8eef7' : 'none',
              borderBottom:'1px solid #e8eef7',
            }}>
              <div style={{ width:LEFT_W, flexShrink:0, borderRight:'1px solid #e8eef7',
                padding:'8px 16px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:26, height:26, borderRadius:8, flexShrink:0,
                  background:`${phase.color}18`, border:`1px solid ${phase.color}30`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:900, color:phase.color,
                  fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{phase.numero}</div>
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:phase.color,
                    fontFamily:"'Barlow Semi Condensed',sans-serif",
                    textTransform:'uppercase', letterSpacing:'.04em' }}>Phase {phase.numero}</div>
                  <div style={{ fontSize:9.5, color:'rgba(31,59,114,.45)', lineHeight:1.2 }}>{phase.titre}</div>
                </div>
              </div>
              <div style={{ flex:1, padding:'8px 12px', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:9, fontWeight:700, color:'#059669',
                  background:'rgba(5,150,105,.08)', padding:'2px 8px', borderRadius:20 }}>
                  ✓ {phase.jalons.filter(j=>j.statut==='FAIT').length} fait{phase.jalons.filter(j=>j.statut==='FAIT').length>1?'s':''}
                </span>
                <span style={{ fontSize:9, fontWeight:700, color:'#D97706',
                  background:'rgba(217,119,6,.08)', padding:'2px 8px', borderRadius:20 }}>
                  ◑ {phase.jalons.filter(j=>j.statut==='EN COURS').length} en cours
                </span>
                <span style={{ fontSize:9, color:'rgba(31,59,114,.35)' }}>
                  {phase.jalons.length} jalons
                </span>
              </div>
            </div>

            {/* ── Lignes jalons ─────────────────────────────────────────── */}
            {phase.jalons.map((jalon, ji) => {
              const meta     = STATUT_META[jalon.statut as RoadmapStatut]
              const isOpen   = selectedCode === jalon.code
              const barLeft  = ganttLeft(jalon.debut)
              const barW     = ganttWidth(jalon.debut, jalon.fin)
              const stDone   = jalon.sousTaches.filter(s=>s.statut==='FAIT').length
              const stTotal  = jalon.sousTaches.length

              // Couleur barre
              const barColor = jalon.statut==='FAIT'      ? '#059669'
                             : jalon.statut==='EN COURS'  ? '#D97706'
                             : jalon.statut==='Permanent' ? '#6366f1'
                             : '#9CA3AF'

              return (
                <div key={jalon.code} style={{ borderBottom: ji < phase.jalons.length-1 ? '1px solid #f0f4fa' : 'none' }}>
                  {/* Ligne principale */}
                  <div
                    onClick={() => toggle(jalon.code)}
                    style={{ display:'flex', cursor:'pointer',
                      background: isOpen ? `${phase.color}05` : 'transparent',
                      transition:'background .15s',
                    }}
                    onMouseEnter={e=>{if(!isOpen)(e.currentTarget as HTMLDivElement).style.background='rgba(31,59,114,.025)'}}
                    onMouseLeave={e=>{if(!isOpen)(e.currentTarget as HTMLDivElement).style.background='transparent'}}
                  >
                    {/* Label */}
                    <div style={{ width:LEFT_W, flexShrink:0, borderRight:'1px solid #f0f4fa',
                      padding:'9px 14px', display:'flex', alignItems:'center', gap:9 }}>
                      <div style={{ width:6, height:6, borderRadius:99, background:meta.dot, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:9.5, fontWeight:700, color:phase.color,
                            background:`${phase.color}0e`, padding:'1px 5px', borderRadius:4,
                            fontFamily:'monospace', flexShrink:0 }}>{jalon.code}</span>
                          <span style={{ fontSize:11, fontWeight:600, color:'#1F3B72',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{jalon.titre}</span>
                        </div>
                        <div style={{ fontSize:9, color:'rgba(31,59,114,.35)', marginTop:1 }}>
                          {jalon.responsable.length > 28 ? jalon.responsable.slice(0,26)+'…' : jalon.responsable}
                        </div>
                      </div>
                      <span style={{ fontSize:12, color:'rgba(31,59,114,.25)',
                        transform:isOpen?'rotate(90deg)':'none', transition:'transform .18s', flexShrink:0 }}>›</span>
                    </div>

                    {/* Zone Gantt */}
                    <div style={{ flex:1, position:'relative', height:54, minWidth:0 }}>
                      {/* Grilles verticales */}
                      {Array.from({length:GANTT_TOTAL}).map((_,i) => (
                        <div key={i} style={{
                          position:'absolute', top:0, bottom:0,
                          left:`${(i/GANTT_TOTAL)*100}%`,
                          width:1,
                          background: i===TODAY_IDX ? 'rgba(232,64,64,.15)' : i%12===0 ? '#e8eef7' : '#f4f7fb',
                          zIndex:0,
                        }} />
                      ))}
                      {/* Ligne "aujourd'hui" */}
                      <div style={{
                        position:'absolute', top:0, bottom:0,
                        left:`${((TODAY_IDX + 0.5)/GANTT_TOTAL)*100}%`,
                        width:1.5, background:'rgba(232,64,64,.4)', zIndex:2,
                      }} />
                      {/* Barre */}
                      <div style={{
                        position:'absolute',
                        left:`${barLeft}%`,
                        width:`${barW}%`,
                        top:'50%', transform:'translateY(-50%)',
                        height:14, borderRadius:99,
                        background: barColor,
                        opacity: jalon.statut==='À FAIRE' ? .45 : 1,
                        zIndex:1, minWidth:4,
                        boxShadow: jalon.statut!=='À FAIRE' ? `0 2px 6px ${barColor}50` : 'none',
                      }} />
                      {/* % sous-tâches sur la barre (si espace) */}
                      {stTotal > 0 && barW > 12 && (
                        <div style={{
                          position:'absolute',
                          left:`${barLeft + 1}%`,
                          top:'50%', transform:'translateY(-50%)',
                          height:14, display:'flex', alignItems:'center',
                          zIndex:3, paddingLeft:5,
                        }}>
                          <span style={{ fontSize:8, fontWeight:700, color:'#fff',
                            textShadow:'0 1px 2px rgba(0,0,0,.2)' }}>
                            {stDone}/{stTotal}
                          </span>
                        </div>
                      )}
                      {/* Date début — au-dessus à gauche de la barre */}
                      <div style={{
                        position:'absolute',
                        left:`${barLeft}%`,
                        top:4, zIndex:3,
                        transform:'translateX(-2px)',
                      }}>
                        <span style={{
                          fontSize:8, fontWeight:700, color:barColor,
                          whiteSpace:'nowrap', letterSpacing:'.01em',
                          opacity: jalon.statut==='À FAIRE' ? .6 : 1,
                        }}>{jalon.debut}</span>
                      </div>
                      {/* Date fin — en dessous à droite de la barre */}
                      <div style={{
                        position:'absolute',
                        left:`${barLeft + barW}%`,
                        bottom:4, zIndex:3,
                        transform:'translateX(-100%)',
                      }}>
                        <span style={{
                          fontSize:8, fontWeight:700, color:barColor,
                          whiteSpace:'nowrap', letterSpacing:'.01em',
                          opacity: jalon.statut==='À FAIRE' ? .6 : 1,
                        }}>{jalon.fin}</span>
                      </div>
                      {/* Badge statut */}
                      <div style={{
                        position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', zIndex:3,
                      }}>
                        <span style={{ fontSize:8, fontWeight:700, padding:'1px 6px', borderRadius:99,
                          background:meta.bg, color:meta.color, letterSpacing:'.04em',
                          textTransform:'uppercase', whiteSpace:'nowrap' }}>{meta.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Détail expandable */}
                  {isOpen && (
                    <div style={{ padding:'0 0 12px 0' }}>
                      <JalonDetail jalon={jalon} phaseColor={phase.color} onClose={() => setSelectedCode(null)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Légende + barre de progression bas */}
        <div style={{ borderTop:'2px solid #e8eef7', padding:'12px 20px',
          background:'#f4f7fb', display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:16, height:2, background:'rgba(232,64,64,.5)', borderRadius:99 }} />
            <span style={{ fontSize:9.5, color:'rgba(31,59,114,.45)' }}>Aujourd'hui (Mar 2026)</span>
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:9.5, fontWeight:700, color:'rgba(31,59,114,.5)' }}>Avancement :</span>
            <div style={{ flex:1, background:'#e8eef7', borderRadius:99, height:6, overflow:'hidden' }}>
              <div style={{ display:'flex', height:'100%' }}>
                <div style={{ width:`${pctFait}%`, background:'#059669', transition:'width .6s' }} />
                <div style={{ width:`${pctEnCours}%`, background:'#D97706', transition:'width .6s' }} />
              </div>
            </div>
            <span style={{ fontSize:9.5, fontWeight:800, color:'#1F3B72', whiteSpace:'nowrap' }}>
              {pctFait}% fait · {pctFait+pctEnCours}% engagé
            </span>
          </div>
          <span style={{ fontSize:9, color:'rgba(31,59,114,.28)' }}>
            Source : Feuille_Route_Entrepot_2026-2027.xlsx · DSI SEN'EAU · Mar 2026
          </span>
        </div>
      </div>
    </div>
  )
}

function SH({ icon,title }:{ icon:string;title:string }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <h3 style={{ fontSize:14,fontWeight:700,color:'var(--text-primary)',fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{title}</h3>
      <div style={{ flex:1,height:1,background:'var(--border)' }} />
    </div>
  )
}
