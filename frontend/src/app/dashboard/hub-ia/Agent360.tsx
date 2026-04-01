'use client'
import React, { useState, useEffect, useMemo } from 'react'

/* ── Types ─────────────────────────────────────────────────────────────────── */
type DomainStatus = 'live' | 'partial' | 'soon'
type KpiStatut    = 'ok' | 'warning' | 'alert'

interface KpiMini {
  label:    string
  value:    string
  unit?:    string
  statut:   KpiStatut
  target?:  string
  trend?:   'up' | 'down' | 'stable'
  sparkline?: number[]   // valeurs relatives 0-100 pour mini-courbe
  periode?: string       // ex: "Fév 2026", "7 derniers jours", "T1 2026"
  source?:  string       // source de la donnée
}

interface Domain {
  id:       string
  icon:     string
  title:    string
  subtitle: string
  color:    string
  status:   DomainStatus
  lastUpdate?: string
  expectedDate?: string
  progress?: number       // % si partial
  kpis:     KpiMini[]
  insight:  string
  roles:    string[]      // rôles autorisés
}

/* ── Helpers couleurs ───────────────────────────────────────────────────────── */
const SC = (s: KpiStatut) => s === 'ok' ? '#059669' : s === 'warning' ? '#D97706' : '#E84040'
const SB = (s: KpiStatut) => s === 'ok' ? 'rgba(5,150,105,.10)' : s === 'warning' ? 'rgba(217,119,6,.10)' : 'rgba(232,64,64,.10)'
const SI = (s: KpiStatut) => s === 'ok' ? '↑' : s === 'warning' ? '→' : '↓'

/* ── Données domaines ────────────────────────────────────────────────────────
   Ces données sont liées aux sources disponibles sur la plateforme.
   Elles évolueront automatiquement à mesure que de nouveaux datamarts seront
   connectés (voir Feuille de Route — Phase II).
─────────────────────────────────────────────────────────────────────────── */
export const DOMAINS: Domain[] = [
  // ── LIVE ──────────────────────────────────────────────────────────────────
  {
    id: 'facturation',
    icon: '💳',
    title: 'Facturation & Recouvrement',
    subtitle: 'CA · Encaissements · Impayés · Taux recouvrement',
    color: '#1F3B72',
    status: 'live',
    lastUpdate: 'Il y a 15 min',
    roles: ['super_admin','admin_metier','analyste','lecteur_dt'],
    kpis: [
      { label:'CA mensuel',         value:'485,2', unit:'M FCFA', statut:'warning', target:'520 M',    trend:'down',   sparkline:[68,72,75,70,74,71,68], periode:'Fév 2026',           source:'Datamart Facturation' },
      { label:'Taux recouvrement',  value:'73,4',  unit:'%',      statut:'warning', target:'80%',      trend:'stable', sparkline:[71,73,72,74,73,73,73], periode:'Fév 2026',           source:'Datamart Facturation' },
      { label:'Impayés cumulés',    value:'2,1',   unit:'Mds',    statut:'alert',   target:'< 1,5 Mds', trend:'up',   sparkline:[55,60,65,70,75,82,90], periode:'Jan – Mar 2026',      source:'Datamart Facturation' },
      { label:'Encaissements (7j)', value:'18,6',  unit:'M FCFA', statut:'ok',      target:'15 M',     trend:'up',    sparkline:[60,65,70,72,68,75,80], periode:'09 – 15 Mar 2026',   source:'Datamart Facturation' },
    ],
    insight: '⚠️ Taux de recouvrement à 73,4% — sous la cible de 80%. DR Tambacounda (37,6%) et DR Saint Louis (44,1%) tirent la moyenne vers le bas. Action corrective urgente recommandée.',
  },
  {
    id: 'score360',
    icon: '🎯',
    title: 'Score Client 360°',
    subtitle: 'Segmentation ML · 5 profils comportementaux',
    color: '#7C3AED',
    status: 'live',
    lastUpdate: 'Il y a 3h',
    roles: ['super_admin','admin_metier','analyste'],
    kpis: [
      { label:'Clients Premium',      value:'23',   unit:'%',   statut:'ok',      target:'> 20%',  trend:'up',    sparkline:[18,20,21,22,22,23,23], periode:'Jan 2026',   source:'Modèle ML Score 360°' },
      { label:'Clients Stables',      value:'41',   unit:'%',   statut:'ok',      target:'> 35%',  trend:'stable',sparkline:[40,41,41,42,41,41,41], periode:'Jan 2026',   source:'Modèle ML Score 360°' },
      { label:'Clients Sensibles',    value:'12',   unit:'%',   statut:'warning', target:'< 10%',  trend:'up',    sparkline:[8,9,10,11,11,12,12],  periode:'Jan 2026',   source:'Modèle ML Score 360°' },
      { label:'Clients Critiques',    value:'6',    unit:'%',   statut:'alert',   target:'< 5%',   trend:'up',    sparkline:[3,4,4,5,5,6,6],       periode:'Jan 2026',   source:'Modèle ML Score 360°' },
    ],
    insight: '🔴 6% de clients classés Critiques — soit 321 comptes à risque élevé. 4 nouveaux basculements Sensible→Critique détectés cette semaine. Relance ciblée requise.',
  },
  {
    id: 'releveurs',
    icon: '📍',
    title: 'Suivi Releveurs',
    subtitle: 'Tournées · Performance terrain · Anomalies',
    color: '#0891B2',
    status: 'live',
    lastUpdate: 'Il y a 30 min',
    roles: ['super_admin','admin_metier','analyste','lecteur_dt','releveur'],
    kpis: [
      { label:'Taux couverture',     value:'87,3', unit:'%',    statut:'warning', target:'95%',  trend:'up',    sparkline:[80,82,83,85,86,87,87], periode:'Tournée Mar 2026',    source:'Système Relevé SEN\'EAU' },
      { label:'Compteurs relevés',   value:'3 420',unit:'/3920', statut:'ok',     target:'3 920',trend:'up',    sparkline:[60,68,75,80,84,87,87], periode:'Tournée Mar 2026',    source:'Système Relevé SEN\'EAU' },
      { label:'Anomalies détectées', value:'12',   unit:'',     statut:'warning', target:'< 5',  trend:'down',  sparkline:[20,18,15,12,14,13,12], periode:'7 derniers jours',    source:'Système Relevé SEN\'EAU' },
      { label:'Secteurs en retard',  value:'3',    unit:'',     statut:'warning', target:'0',    trend:'stable',sparkline:[5,4,4,3,4,3,3],       periode:'Tournée Mar 2026',    source:'Système Relevé SEN\'EAU' },
    ],
    insight: '📍 Secteur Guediawaye II : 12 compteurs sans données depuis 48h (DR Dakar 2). Taux de couverture global en progression (+7,3 pts depuis Jan 2026) mais encore sous la cible.',
  },
  {
    id: 'cartographie',
    icon: '🗺️',
    title: 'Cartographie SIG',
    subtitle: 'Géolocalisation clients · Impayés · Tournées',
    color: '#059669',
    status: 'live',
    lastUpdate: 'Il y a 2h',
    roles: ['super_admin','admin_metier','analyste'],
    kpis: [
      { label:'Clients géolocalisés', value:'94,2', unit:'%',        statut:'ok', target:'> 90%',trend:'up',    sparkline:[85,88,90,92,93,94,94], periode:'Mar 2026',  source:'Datamart SIG / Référentiel Clients' },
      { label:'Secteurs actifs',      value:'67',   unit:'secteurs',  statut:'ok', target:'67',   trend:'stable',sparkline:[67,67,67,67,67,67,67], periode:'Mar 2026',  source:'Datamart SIG' },
      { label:'Impayés géolocalisés', value:'89,7', unit:'%',         statut:'ok', target:'> 85%',trend:'up',    sparkline:[82,84,86,87,89,90,90], periode:'Fév 2026',  source:'Croisement Facturation × SIG' },
      { label:'DT couvertes',         value:'12',   unit:'/12',       statut:'ok', target:'12/12',trend:'stable',sparkline:[10,11,12,12,12,12,12], periode:'Mar 2026',  source:'Datamart SIG' },
    ],
    insight: '✅ Couverture SIG quasi-complète (94,2%). La carte interactive permet d\'identifier visuellement les zones de concentration d\'impayés et d\'optimiser les tournées de recouvrement.',
  },

  // ── EN COURS (partial) ────────────────────────────────────────────────────
  {
    id: 'production',
    icon: '💧',
    title: 'Production & Distribution',
    subtitle: 'Volumes · NRW · Pression · Qualité eau',
    color: '#3B82F6',
    status: 'partial',
    lastUpdate: '7 zones / 12',
    progress: 58,
    roles: ['super_admin','admin_metier','analyste'],
    kpis: [
      { label:'Volumes produits/j',  value:'~142 000', unit:'m³', statut:'warning', target:'148 000 m³', trend:'stable', sparkline:[95,94,96,95,95,96,95], periode:'Moy. Fév 2026',    source:'Télémétrie (7 zones)' },
      { label:'NRW estimé',          value:'~22',       unit:'%',  statut:'warning', target:'< 20%',      trend:'down',   sparkline:[25,24,23,23,22,22,22], periode:'T1 2026 (partiel)', source:'Télémétrie (7 zones)' },
      { label:'Zones raccordées',    value:'7',         unit:'/12',statut:'warning', target:'12/12',      trend:'up',     sparkline:[3,4,5,6,6,7,7],       periode:'Mar 2026',          source:'Déploiement télémétrique' },
    ],
    insight: '⏳ Collecte en cours de déploiement — 7 zones sur 12 raccordées. Les données restantes (zones 8-12, rurales) seront disponibles en Q3 2026 après déploiement télémétrique.',
  },
  {
    id: 'maintenance',
    icon: '🔧',
    title: 'Maintenance & Interventions',
    subtitle: 'Pannes · MTTR · Interventions préventives',
    color: '#F59E0B',
    status: 'partial',
    lastUpdate: 'GMAO Gordon 80%',
    progress: 80,
    roles: ['super_admin','admin_metier','analyste'],
    kpis: [
      { label:'Intégration GMAO',   value:'80',  unit:'%', statut:'warning', target:'100%', trend:'up', sparkline:[40,50,60,65,70,75,80], periode:'Mar 2026', source:'GMAO Gordon' },
    ],
    insight: '⏳ Intégration Gordon en cours (80% réalisé). Les tableaux de bord maintenance seront disponibles dès la finalisation de la connexion GMAO, prévue Q2 2026.',
  },

  // ── À VENIR ────────────────────────────────────────────────────────────────
  {
    id: 'finance',
    icon: '📊',
    title: 'Finance & Budget',
    subtitle: 'Budget · Trésorerie · Charges · Investissements',
    color: '#6366F1',
    status: 'soon',
    expectedDate: 'Nov 2026',
    roles: ['super_admin','admin_metier'],
    kpis: [],
    insight: 'Datamart Finance en cours de conception. Connexion source comptable DAF prévue pour Nov 2026 (voir Feuille de Route II.8).',
  },
  {
    id: 'rh',
    icon: '👥',
    title: 'RH & Ressources Humaines',
    subtitle: 'Effectifs · Masse salariale · Heures sup · Formation',
    color: '#EC4899',
    status: 'live',
    lastUpdate: 'Données 2025',
    roles: ['super_admin','admin_metier'],
    kpis: [
      { label:'Effectif actif',        value:'1 243',  unit:'salariés', statut:'ok',      target:'',         trend:'stable', sparkline:[100,100,100,100,100,100,100], periode:'2025',         source:'Oracle DWH — DRHT' },
      { label:'Taux féminisation',     value:'18,4',   unit:'%',        statut:'warning', target:'≥ 20%',    trend:'up',     sparkline:[15,16,16,17,17,18,18],       periode:'2025',         source:'Oracle DWH — DRHT' },
      { label:'Masse salariale',       value:'4 218',  unit:'M FCFA',   statut:'ok',      target:'Annuel',   trend:'stable', sparkline:[340,348,352,356,350,354,358], periode:'2025 (cumul)', source:'Oracle DWH — DRHT' },
      { label:'Taux heures sup',       value:'2,1',    unit:'%',        statut:'ok',      target:'≤ 2,5%',   trend:'down',   sparkline:[3,2.8,2.6,2.4,2.2,2.1,2.1], periode:'2025',         source:'Oracle DWH — DRHT' },
      { label:'Heures formation',      value:'19 450', unit:'h',        statut:'warning', target:'25 000 h', trend:'up',     sparkline:[30,40,52,62,68,74,78],       periode:'2025 (cumul)', source:'Oracle DWH — DRHT' },
      { label:'Collaborateurs formés', value:'61,2',   unit:'%',        statut:'warning', target:'≥ 80%',    trend:'up',     sparkline:[42,48,52,55,58,60,61],       periode:'2025',         source:'Oracle DWH — DRHT' },
    ],
    insight: 'Effectif stable à 1 243 salariés actifs. Taux de féminisation à 18,4% — sous la cible de 20% (écart : 1,6 pt). Heures supplémentaires maîtrisées (2,1% vs seuil 2,5%). Formation en progression mais objectif 25 000 h non encore atteint (19 450 h, soit 78% de l\'objectif annuel 2025).',
  },
  {
    id: 'smqse',
    icon: '🛡️',
    title: 'Qualité · Sécurité · Environnement',
    subtitle: 'SMQSE · Conformité ISO · Incidents sécurité',
    color: '#10B981',
    status: 'soon',
    expectedDate: 'Déc 2026',
    roles: ['super_admin','admin_metier','analyste'],
    kpis: [],
    insight: 'Indicateurs SMQSE et conformité ISO/OHSAS seront disponibles après connexion des sources qualité (Feuille de Route II.9).',
  },
  {
    id: 'travaux',
    icon: '🏗️',
    title: 'Travaux & Investissements',
    subtitle: 'Chantiers · Marchés · Délais · Coûts',
    color: '#D97706',
    status: 'soon',
    expectedDate: 'Déc 2026',
    roles: ['super_admin','admin_metier'],
    kpis: [],
    insight: 'Suivi des chantiers et investissements prévu pour Déc 2026 après intégration du planning et des marchés (Feuille de Route II.10).',
  },
]

/* ── Sparkline mini SVG ─────────────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null
  const w = 56, h = 24, pad = 2
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} style={{ overflow:'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" opacity={.7} />
      <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]}
        r={2.5} fill={color} opacity={.9} />
    </svg>
  )
}

/* ── Jauge arc (health score) ───────────────────────────────────────────────── */
function HealthGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#059669' : score >= 55 ? '#D97706' : '#E84040'
  const r = 44, cx = 56, cy = 56
  const circ = Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={112} height={70} viewBox="0 0 112 70">
      <path d={`M ${cx-r},${cy} A ${r},${r} 0 0,1 ${cx+r},${cy}`}
        fill="none" stroke="#f0f4fa" strokeWidth={9} strokeLinecap="round" />
      <path d={`M ${cx-r},${cy} A ${r},${r} 0 0,1 ${cx+r},${cy}`}
        fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} style={{ transition:'stroke-dasharray .8s ease' }} />
      <text x={cx} y={cy-6} textAnchor="middle" fontSize={22} fontWeight={900}
        fill={color} fontFamily="'Barlow Semi Condensed',sans-serif">{score}</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize={9} fontWeight={600}
        fill="rgba(31,59,114,.4)" letterSpacing=".04em">SCORE 360°</text>
    </svg>
  )
}

/* ── Card KPI mini ──────────────────────────────────────────────────────────── */
function KpiMiniCard({ kpi }: { kpi: KpiMini }) {
  const c = SC(kpi.statut)
  const pct = Math.min(parseFloat(kpi.value.replace(',','.').replace(/\s/g,'')) || 0, 100)
  const tPct = Math.min(parseFloat((kpi.target||'0').replace(/[^0-9.,]/g,'').replace(',','.')) || 0, 100)
  return (
    <div style={{ background:SB(kpi.statut), borderRadius:10, padding:'10px 12px',
      border:`1px solid ${c}20`, position:'relative', overflow:'hidden' }}>

      {/* En-tête : label + période */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5, gap:4 }}>
        <div style={{ fontSize:9.5, fontWeight:700, color:'rgba(31,59,114,.45)',
          textTransform:'uppercase', letterSpacing:'.06em', lineHeight:1.3 }}>{kpi.label}</div>
        {kpi.periode && (
          <span style={{
            fontSize:8.5, fontWeight:700, padding:'1px 6px', borderRadius:99, flexShrink:0,
            background:`${c}14`, color:c, letterSpacing:'.03em', whiteSpace:'nowrap',
            border:`1px solid ${c}22`,
          }}>
            📅 {kpi.periode}
          </span>
        )}
      </div>

      {/* Valeur + sparkline */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <span style={{ fontSize:20, fontWeight:900, color:c, lineHeight:1,
            fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{kpi.value}</span>
          {kpi.unit && <span style={{ fontSize:10, color:c, fontWeight:600, marginLeft:3 }}>{kpi.unit}</span>}
          {kpi.target && (
            <div style={{ fontSize:9, color:'rgba(31,59,114,.35)', marginTop:2 }}>
              Cible : {kpi.target} <span style={{ color:c }}>{SI(kpi.statut)}</span>
            </div>
          )}
        </div>
        {kpi.sparkline && <Sparkline data={kpi.sparkline} color={c} />}
      </div>

      {/* Barre progression */}
      <div style={{ height:3, background:'rgba(31,59,114,.06)', borderRadius:99, marginTop:8 }}>
        <div style={{ height:'100%', width:`${pct}%`, background:c, borderRadius:99, transition:'width .6s',
          maxWidth:'100%', position:'relative' }}>
          {tPct > 0 && (
            <div style={{ position:'absolute', right:0, top:-2, width:2, height:7,
              background:'rgba(31,59,114,.3)', borderRadius:1 }} />
          )}
        </div>
      </div>

      {/* Source de donnée */}
      {kpi.source && (
        <div style={{ fontSize:8, color:'rgba(31,59,114,.28)', marginTop:5, fontStyle:'italic',
          display:'flex', alignItems:'center', gap:3 }}>
          <span style={{ opacity:.6 }}>⊙</span> {kpi.source}
        </div>
      )}
    </div>
  )
}

/* ── Carte domaine ──────────────────────────────────────────────────────────── */
function DomainCard({ domain, userRole }: { domain: Domain; userRole: string }) {
  const [open, setOpen] = useState(false)
  const isLive    = domain.status === 'live'
  const isPartial = domain.status === 'partial'
  const isSoon    = domain.status === 'soon'

  const statusBadge = isLive
    ? { label:'● LIVE',      color:'#059669', bg:'rgba(5,150,105,.10)'    }
    : isPartial
    ? { label:'◑ EN COURS',  color:'#D97706', bg:'rgba(217,119,6,.10)'    }
    : { label:'○ À VENIR',   color:'#9CA3AF', bg:'rgba(107,114,128,.08)'  }

  const alertCount = domain.kpis.filter(k => k.statut !== 'ok').length

  return (
    <div style={{
      background:'#fff', borderRadius:14,
      border:`1px solid ${isLive ? domain.color+'22' : '#dde3ef'}`,
      boxShadow: isLive
        ? `0 2px 12px ${domain.color}10, 0 1px 3px rgba(31,59,114,.06)`
        : '0 1px 4px rgba(31,59,114,.06), 0 0 0 1px rgba(31,59,114,.04)',
      overflow:'hidden', opacity: isSoon ? .7 : 1,
      transition:'box-shadow .2s, transform .2s',
    }}
    onMouseEnter={e => { if(!isSoon)(e.currentTarget as HTMLDivElement).style.boxShadow=`0 8px 28px ${domain.color}20` }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = isLive ? `0 2px 14px ${domain.color}12` : '0 1px 6px rgba(31,59,114,.05)' }}
    >
      {/* ── Header carte ── */}
      <div
        onClick={() => !isSoon && setOpen(p => !p)}
        style={{ padding:'14px 16px', cursor: isSoon ? 'default' : 'pointer',
          background: open ? `${domain.color}06` : 'transparent',
          borderBottom: open ? `1px solid ${domain.color}12` : 'none',
        }}
      >
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          {/* Icône */}
          <div style={{ width:40, height:40, borderRadius:11, flexShrink:0,
            background:`${domain.color}12`, border:`1px solid ${domain.color}20`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
            {domain.icon}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
              <span style={{ fontSize:12.5, fontWeight:800, color:'#1F3B72',
                fontFamily:"'Barlow Semi Condensed',sans-serif" }}>{domain.title}</span>
              {alertCount > 0 && isLive && (
                <span style={{ fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:99,
                  background:'rgba(232,64,64,.10)', color:'#E84040' }}>
                  {alertCount} alerte{alertCount>1?'s':''}
                </span>
              )}
            </div>
            <p style={{ fontSize:10.5, color:'rgba(31,59,114,.42)', margin:0, lineHeight:1.4 }}>{domain.subtitle}</p>
          </div>
          {/* Badges droite */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
            <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:99,
              background:statusBadge.bg, color:statusBadge.color, letterSpacing:'.04em',
              textTransform:'uppercase', whiteSpace:'nowrap' }}>{statusBadge.label}</span>
            {domain.lastUpdate && (
              <span style={{ fontSize:9, color:'rgba(31,59,114,.28)' }}>⟳ {domain.lastUpdate}</span>
            )}
            {domain.expectedDate && isSoon && (
              <span style={{ fontSize:9, color:'rgba(31,59,114,.35)' }}>📅 {domain.expectedDate}</span>
            )}
            {!isSoon && (
              <span style={{ fontSize:11, color:'rgba(31,59,114,.25)',
                transform: open ? 'rotate(90deg)':'none', transition:'transform .2s' }}>›</span>
            )}
          </div>
        </div>

        {/* Barre progression pour partial */}
        {isPartial && domain.progress !== undefined && (
          <div style={{ marginTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:9, color:'rgba(31,59,114,.4)' }}>Déploiement en cours</span>
              <span style={{ fontSize:9, fontWeight:700, color:domain.color }}>{domain.progress}%</span>
            </div>
            <div style={{ height:4, background:'#f0f4fa', borderRadius:99 }}>
              <div style={{ width:`${domain.progress}%`, height:'100%',
                background:`linear-gradient(90deg,${domain.color}88,${domain.color})`,
                borderRadius:99, transition:'width .6s' }} />
            </div>
          </div>
        )}

        {/* Mini KPIs inline (résumé toujours visible pour live) */}
        {isLive && !open && domain.kpis.length > 0 && (
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            {domain.kpis.slice(0,3).map(k => (
              <div key={k.label} style={{ display:'flex', alignItems:'center', gap:5,
                padding:'4px 10px', borderRadius:99,
                background:`${SC(k.statut)}0e`, border:`1px solid ${SC(k.statut)}20` }}>
                <span style={{ fontSize:10, fontWeight:800, color:SC(k.statut) }}>{k.value}{k.unit && <span style={{ fontWeight:600 }}> {k.unit}</span>}</span>
                <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                  <span style={{ fontSize:9, color:'rgba(31,59,114,.4)' }}>{k.label}</span>
                  {k.periode && <span style={{ fontSize:7.5, color:SC(k.statut), opacity:.7, fontWeight:600 }}>{k.periode}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* À venir — message */}
        {isSoon && (
          <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8,
            background:'rgba(31,59,114,.04)', border:'1px dashed rgba(31,59,114,.12)' }}>
            <p style={{ fontSize:10.5, color:'rgba(31,59,114,.45)', margin:0, lineHeight:1.5 }}>
              {domain.insight}
            </p>
          </div>
        )}
      </div>

      {/* ── Détail expandable ── */}
      {open && !isSoon && (
        <div style={{ padding:'14px 16px', background:'#fafbfe',
          display:'flex', flexDirection:'column', gap:12,
          animation:'fadeIn .18s ease' }}>
          {/* KPI grid */}
          {domain.kpis.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {domain.kpis.map(k => <KpiMiniCard key={k.label} kpi={k} />)}
            </div>
          )}
          {/* AI Insight */}
          <div style={{ padding:'10px 14px', borderRadius:10,
            background:'rgba(31,59,114,.04)', borderLeft:`3px solid ${domain.color}`,
            display:'flex', alignItems:'flex-start', gap:8 }}>
            <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width:16, height:16, objectFit:'cover', objectPosition:'center 30%', borderRadius:3, flexShrink:0 }} />
            <p style={{ fontSize:11.5, color:'rgba(31,59,114,.65)', margin:0, lineHeight:1.6,
              fontStyle:'italic' }}>{domain.insight}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   TABLEAU DE BORD AGENT 360°
════════════════════════════════════════════════════════════════════════════ */
/* ── Types pour la réponse API KPIs Facturation ─────────────────────────────── */
interface KpisApiResponse {
  nb_factures:        number
  ca_total:           number
  encaissement_total: number
  impaye_mensuel:     number
  impaye_cumul:       number
  taux_recouvrement:  number
  derniere_periode:   string
  nb_dr:              number
  source:             string
  timestamp:          string
}

/* ── Types pour la réponse API KPIs RH ──────────────────────────────────────── */
interface RhKpisApiResponse {
  annee:                    string
  nb_salaries:              number
  nb_femmes:                number
  taux_feminisation:        number
  masse_salariale:          number
  salaire_moyen:            number
  montant_hs:               number
  nb_heures_sup:            number
  taux_hs:                  number
  nb_heures_formation:      number
  nb_collaborateurs_formes: number
  pct_formes:               number
  sparkline_masse:          number[]
  source:                   string
  timestamp:                string
}

/* ── Formatage montant FCFA ─────────────────────────────────────────────────── */
function fmtFcfa(v: number): { value: string; unit: string } {
  if (v >= 1_000_000_000) {
    return { value: (v / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }), unit: 'Mds FCFA' }
  }
  return { value: (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }), unit: 'M FCFA' }
}

export default function Agent360({ user }: { user: { name?: string; role?: string; dt?: string } | null }) {
  const role      = (user?.role ?? 'analyste') as string
  const firstName = user?.name ? user.name.split(' ')[0] : ''
  const isDG      = ['super_admin','admin_metier'].includes(role)
  const dtLabel   = user?.dt ? user.dt.replace('Direction Regionale ','DR ') : ''

  /* ── Données réelles : PostgreSQL sen_ods (Facturation) + Oracle DWH (RH) ── */
  const [kpisDB,   setKpisDB]   = useState<KpisApiResponse | null>(null)
  const [rhKpisDB, setRhKpisDB] = useState<RhKpisApiResponse | null>(null)
  const [dbError,  setDbError]  = useState(false)
  // Date côté client uniquement — évite la divergence SSR/hydratation
  const [today, setToday] = useState<string | null>(null)

  useEffect(() => {
    setToday(new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }))
    Promise.all([
      fetch('/api/kpis').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/rh/kpis').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([fact, rh]) => {
      if (fact && !fact.error) setKpisDB(fact)
      else setDbError(true)
      if (rh && rh.nb_salaries !== undefined) setRhKpisDB(rh)
    })
  }, [])

  /* ── Domaines avec valeurs réelles injectées (facturation + RH) ─────────── */
  const domains = useMemo<Domain[]>(() => {
    return DOMAINS.map(d => {

      /* ── RH — injection Oracle DWH ─────────────────────────────────────── */
      if (d.id === 'rh' && rhKpisDB) {
        const annee   = rhKpisDB.annee
        const ts      = new Date(rhKpisDB.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const masse   = fmtFcfa(rhKpisDB.masse_salariale)
        const spk     = (rhKpisDB.sparkline_masse?.length ?? 0) > 0 ? rhKpisDB.sparkline_masse : d.kpis[2]?.sparkline

        const tauxFemOk  = rhKpisDB.taux_feminisation >= 20
        const tauxHsOk   = rhKpisDB.taux_hs <= 2.5
        const formOk     = rhKpisDB.nb_heures_formation >= 25000
        const pctFormOk  = rhKpisDB.pct_formes >= 80

        return {
          ...d,
          lastUpdate: `Données ${annee} · ${ts}`,
          kpis: [
            {
              label:    'Effectif actif',
              value:    rhKpisDB.nb_salaries.toLocaleString('fr-FR'),
              unit:     'salariés',
              statut:   'ok' as KpiStatut,
              trend:    'stable' as const,
              sparkline: d.kpis[0]?.sparkline,
              periode:  annee,
              source:   rhKpisDB.source,
            },
            {
              label:    'Taux féminisation',
              value:    rhKpisDB.taux_feminisation.toLocaleString('fr-FR', { maximumFractionDigits: 1 }),
              unit:     '%',
              statut:   (tauxFemOk ? 'ok' : 'warning') as KpiStatut,
              target:   '≥ 20%',
              trend:    'up' as const,
              sparkline: d.kpis[1]?.sparkline,
              periode:  annee,
              source:   rhKpisDB.source,
            },
            {
              label:    'Masse salariale',
              value:    masse.value,
              unit:     masse.unit,
              statut:   'ok' as KpiStatut,
              target:   'Annuel',
              trend:    'stable' as const,
              sparkline: spk,
              periode:  `${annee} (cumul)`,
              source:   rhKpisDB.source,
            },
            {
              label:    'Taux heures sup',
              value:    rhKpisDB.taux_hs.toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
              unit:     '%',
              statut:   (tauxHsOk ? 'ok' : 'warning') as KpiStatut,
              target:   '≤ 2,5%',
              trend:    tauxHsOk ? 'down' as const : 'up' as const,
              sparkline: d.kpis[3]?.sparkline,
              periode:  annee,
              source:   rhKpisDB.source,
            },
            {
              label:    'Heures formation',
              value:    rhKpisDB.nb_heures_formation.toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
              unit:     'h',
              statut:   (formOk ? 'ok' : 'warning') as KpiStatut,
              target:   '25 000 h',
              trend:    'up' as const,
              sparkline: d.kpis[4]?.sparkline,
              periode:  `${annee} (cumul)`,
              source:   rhKpisDB.source,
            },
            {
              label:    'Collaborateurs formés',
              value:    rhKpisDB.pct_formes.toLocaleString('fr-FR', { maximumFractionDigits: 1 }),
              unit:     '%',
              statut:   (pctFormOk ? 'ok' : 'warning') as KpiStatut,
              target:   '≥ 80%',
              trend:    'up' as const,
              sparkline: d.kpis[5]?.sparkline,
              periode:  annee,
              source:   rhKpisDB.source,
            },
          ],
          insight: `Effectif actif : ${rhKpisDB.nb_salaries.toLocaleString('fr-FR')} salariés — ${rhKpisDB.nb_femmes} femmes (${rhKpisDB.taux_feminisation.toFixed(1)}% / cible 20%${tauxFemOk ? ' ✓' : ' — sous la cible'}). Heures sup : ${rhKpisDB.taux_hs.toFixed(2)}%${tauxHsOk ? ' — maîtrisées.' : ' — dépassement du seuil 2,5%.'} Formation : ${rhKpisDB.nb_heures_formation.toLocaleString('fr-FR')} h / 25 000 h objectif (${Math.round(rhKpisDB.nb_heures_formation / 250)}%).`,
        }
      }

      /* ── Facturation — injection sen_ods ───────────────────────────────── */
      if (d.id !== 'facturation' || !kpisDB) return d
      const ca     = fmtFcfa(kpisDB.ca_total)
      const enc    = fmtFcfa(kpisDB.encaissement_total)
      const impCum = fmtFcfa(kpisDB.impaye_cumul)
      const taux   = kpisDB.taux_recouvrement
      const per    = kpisDB.derniere_periode || 'sen_ods'
      const ts     = new Date(kpisDB.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      return {
        ...d,
        lastUpdate: `Données live · ${ts}`,
        kpis: [
          {
            label:    'CA mensuel',
            value:    ca.value,
            unit:     ca.unit,
            statut:   (kpisDB.ca_total > 500_000_000 ? 'ok' : kpisDB.ca_total > 400_000_000 ? 'warning' : 'alert') as KpiStatut,
            target:   '520 M',
            trend:    'stable' as const,
            sparkline: d.kpis[0]?.sparkline,
            periode:  per,
            source:   'sen_ods · mv_recouvrement',
          },
          {
            label:    'Taux recouvrement',
            value:    taux.toLocaleString('fr-FR', { maximumFractionDigits: 1 }),
            unit:     '%',
            statut:   (taux >= 80 ? 'ok' : taux >= 65 ? 'warning' : 'alert') as KpiStatut,
            target:   '80%',
            trend:    'stable' as const,
            sparkline: d.kpis[1]?.sparkline,
            periode:  per,
            source:   'sen_ods · mv_recouvrement',
          },
          {
            label:    'Impayés cumulés',
            value:    impCum.value,
            unit:     impCum.unit,
            statut:   (kpisDB.impaye_cumul <= 1_500_000_000 ? 'ok' : kpisDB.impaye_cumul <= 2_500_000_000 ? 'warning' : 'alert') as KpiStatut,
            target:   '< 1,5 Mds',
            trend:    'up' as const,
            sparkline: d.kpis[2]?.sparkline,
            periode:  per,
            source:   'sen_ods · mv_recouvrement',
          },
          {
            label:    'Encaissements période',
            value:    enc.value,
            unit:     enc.unit,
            statut:   'ok' as KpiStatut,
            target:   '15 M',
            trend:    'up' as const,
            sparkline: d.kpis[3]?.sparkline,
            periode:  per,
            source:   'sen_ods · mv_recouvrement',
          },
        ],
        insight: `📊 Données réelles SEN_ODS · ${kpisDB.nb_factures.toLocaleString('fr-FR')} factures · ${kpisDB.nb_dr} DR · Taux recouvrement : ${taux.toFixed(1)}%. ${taux < 80 ? '⚠️ Sous la cible de 80% — action corrective requise.' : '✅ Cible atteinte.'}`,
      }
    })
  }, [kpisDB, rhKpisDB])

  /* ── Indicateur DB live dans le bandeau ─────────────────────────────────── */
  const dbBadge = kpisDB
    ? { label: '● DB Live', color: '#059669', bg: 'rgba(5,150,105,.10)' }
    : dbError
    ? { label: '⚠ DB hors ligne', color: '#D97706', bg: 'rgba(217,119,6,.10)' }
    : { label: '⟳ Connexion…', color: '#9CA3AF', bg: 'rgba(156,163,175,.10)' }

  // Filtrer les domaines accessibles selon le rôle
  const visibleDomains = domains.filter(d => d.roles.includes(role))

  // Score santé global (moyenne pondérée des KPIs live)
  const liveKpis = visibleDomains.filter(d => d.status === 'live').flatMap(d => d.kpis)
  const ok       = liveKpis.filter(k=>k.statut==='ok').length
  const warn     = liveKpis.filter(k=>k.statut==='warning').length
  const alert    = liveKpis.filter(k=>k.statut==='alert').length
  const total    = liveKpis.length || 1
  const health   = Math.round((ok * 100 + warn * 55 + alert * 15) / total)

  const liveDomains    = visibleDomains.filter(d=>d.status==='live')
  const partialDomains = visibleDomains.filter(d=>d.status==='partial')
  const soonDomains    = visibleDomains.filter(d=>d.status==='soon')

  const roleLabel: Record<string,string> = {
    super_admin: 'Direction Générale', admin_metier: 'Admin Métier',
    analyste: 'Analyste', lecteur_dt: 'Lecteur DT', releveur: 'Releveur',
  }

  return (
    <div style={{
      flex:1, overflowY:'auto', background:'#fff',
      scrollbarWidth:'thin', scrollbarColor:'rgba(31,59,114,.12) transparent',
    }}>

      {/* ── Bandeau titre page — même style que les autres onglets ─────────── */}
      <div style={{
        padding:'18px 28px 16px',
        borderBottom:'1px solid rgba(31,59,114,.08)',
        background:'#fff',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:36, height:36, borderRadius:10, flexShrink:0,
            background:'linear-gradient(135deg,rgba(5,150,105,.12),rgba(5,150,105,.06))',
            border:'1px solid rgba(5,150,105,.20)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:17,
          }}>🔮</div>
          <div>
            <div style={{ fontFamily:"'Barlow Semi Condensed',sans-serif",
              fontSize:15, fontWeight:800, color:'#1F3B72', letterSpacing:'-.01em' }}>
              Mon Agent 360°
            </div>
            <div style={{ fontSize:10.5, color:'rgba(31,59,114,.4)', fontWeight:500, marginTop:1 }}>
              Vue consolidée de tous vos indicateurs · {isDG ? 'Toutes DT' : dtLabel}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:9, fontWeight:700, padding:'3px 10px', borderRadius:99,
            background:'rgba(5,150,105,.10)', color:'#059669', letterSpacing:'.06em',
            textTransform:'uppercase', border:'1px solid rgba(5,150,105,.15)' }}>
            ● En direct
          </span>
          {/* Badge état connexion DB */}
          <span style={{
            fontSize:9, fontWeight:700, padding:'3px 10px', borderRadius:99,
            background: dbBadge.bg, color: dbBadge.color,
            border:`1px solid ${dbBadge.color}30`,
            letterSpacing:'.04em',
          }}>
            {dbBadge.label}
            {kpisDB && (
              <span style={{ fontWeight:500, marginLeft:4, opacity:.8 }}>
                · {kpisDB.nb_factures.toLocaleString('fr-FR')} factures
              </span>
            )}
          </span>
          <span style={{ fontSize:10, color:'rgba(31,59,114,.3)',
            background:'#f7f9fc', padding:'3px 10px', borderRadius:99,
            border:'1px solid rgba(31,59,114,.08)' }}>
            {today ? `MAJ ${today}` : 'MAJ …'}
          </span>
        </div>
      </div>

      <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', flexDirection:'column', gap:20 }}>

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <div style={{
          background:'linear-gradient(135deg,#1F3B72 0%,#2B50A0 60%,#1F3B72 100%)',
          borderRadius:16, padding:'22px 28px', color:'#fff',
          boxShadow:'0 6px 28px rgba(31,59,114,.18), 0 1px 4px rgba(31,59,114,.10)',
          position:'relative', overflow:'hidden',
          border:'1px solid rgba(31,59,114,.12)',
        }}>
          {/* Décor fond */}
          <div style={{ position:'absolute', top:-30, right:-30, width:200, height:200, borderRadius:'50%',
            background:'rgba(150,193,30,.08)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-40, right:120, width:140, height:140, borderRadius:'50%',
            background:'rgba(255,255,255,.04)', pointerEvents:'none' }} />

          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            {/* Texte */}
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:99,
                  background:'rgba(150,193,30,.20)', color:'#c8e063', letterSpacing:'.06em',
                  textTransform:'uppercase' }}>Agent 360°</span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>
                  {isDG ? 'Vue nationale · Toutes DT' : `Vue ${dtLabel}`}
                </span>
              </div>
              <h2 style={{ fontFamily:"'Barlow Semi Condensed',sans-serif",
                fontSize:26, fontWeight:900, margin:'0 0 6px', letterSpacing:'-.01em',
                lineHeight:1.1 }}>
                Bonjour{firstName ? `, ${firstName}` : ''} 👋
              </h2>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.6)', margin:'0 0 14px', fontWeight:500 }}>
                {roleLabel[role]} · {isDG ? 'Toutes directions régionales' : dtLabel}
              </p>
              {/* Compteurs rapides */}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {[
                  { l:`${liveDomains.length} domaines LIVE`,      c:'#96C11E' },
                  { l:`${partialDomains.length} en déploiement`,  c:'#FBBF24' },
                  { l:`${alert} alertes actives`,                  c:'#F87171' },
                  { l:`${ok}/${total} indicateurs OK`,             c:'#6EE7B7' },
                ].map(b => (
                  <span key={b.l} style={{ fontSize:11, fontWeight:700, padding:'4px 12px',
                    borderRadius:99, background:'rgba(255,255,255,.10)', color:b.c,
                    border:`1px solid ${b.c}30`, backdropFilter:'blur(4px)' }}>
                    {b.l}
                  </span>
                ))}
              </div>
            </div>

            {/* Score Santé */}
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <HealthGauge score={health} />
              <div style={{ fontSize:9.5, color:'rgba(255,255,255,.45)', marginTop:2, letterSpacing:'.04em',
                textTransform:'uppercase' }}>
                {health >= 75 ? '✅ Situation saine' : health >= 55 ? '⚠️ Vigilance' : '🔴 Action requise'}
              </div>
            </div>

            {/* Heure MAJ */}
            <div suppressHydrationWarning style={{ fontSize:10, color:'rgba(255,255,255,.30)', alignSelf:'flex-end', flexShrink:0,
              paddingBottom:2 }}>
              {new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
            </div>
          </div>
        </div>

        {/* ── ALERTES ACTIVES ───────────────────────────────────────────────── */}
        {(alert > 0 || warn > 0) && (
          <div style={{
            borderRadius:14, border:'1px solid rgba(232,64,64,.14)',
            background:'rgba(232,64,64,.03)', overflow:'hidden',
          }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(232,64,64,.10)',
              display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, fontWeight:800, color:'#E84040' }}>
                ⚠ {alert + warn} alerte{(alert+warn)>1?'s':''} active{(alert+warn)>1?'s':''}
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:0 }}>
              {[
                { label:'Taux recouvrement critique — DR Tambacounda', detail:'37,6% — sous le seuil d\'alerte (< 40%)', color:'#E84040', icon:'🔴' },
                { label:'Impayés en hausse — DR Saint Louis',          detail:'+18,4% sur 7 jours · Secteur Podor',       color:'#E84040', icon:'🔴' },
                { label:'Anomalies releveurs — Guediawaye II',         detail:'12 compteurs sans données depuis 48h',      color:'#D97706', icon:'⚠️' },
                { label:'Clients Critiques en hausse',                  detail:'6% du portefeuille · +4 basculements',     color:'#D97706', icon:'⚠️' },
              ].map((a, i) => (
                <div key={a.label} style={{
                  padding:'11px 16px',
                  borderRight: i % 2 === 0 ? '1px solid rgba(31,59,114,.06)' : 'none',
                  borderBottom:'1px solid rgba(31,59,114,.05)',
                  display:'flex', alignItems:'flex-start', gap:9,
                  background:'transparent', transition:'background .15s',
                }}
                onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='rgba(31,59,114,.02)'}
                onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='transparent'}
                >
                  <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize:11.5, fontWeight:700, color:a.color, marginBottom:2 }}>{a.label}</div>
                    <div style={{ fontSize:10.5, color:'rgba(31,59,114,.45)' }}>{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DOMAINES LIVE ─────────────────────────────────────────────────── */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14,
            paddingBottom:10, borderBottom:'1px solid rgba(31,59,114,.07)' }}>
            <span style={{ width:3, height:16, borderRadius:99, background:'#059669', display:'block', flexShrink:0 }} />
            <h3 style={{ fontFamily:"'Barlow Semi Condensed',sans-serif", fontSize:13, fontWeight:800,
              color:'#1F3B72', margin:0, textTransform:'uppercase', letterSpacing:'.06em', flex:1 }}>
              Données disponibles — {liveDomains.length} domaine{liveDomains.length>1?'s':''}
            </h3>
            <span style={{ fontSize:9, fontWeight:800, padding:'2px 9px', borderRadius:99,
              background:'rgba(5,150,105,.10)', color:'#059669',
              border:'1px solid rgba(5,150,105,.15)' }}>● En direct</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:12 }}>
            {liveDomains.map(d => <DomainCard key={d.id} domain={d} userRole={role} />)}
          </div>
        </div>

        {/* ── DOMAINES EN COURS ─────────────────────────────────────────────── */}
        {partialDomains.length > 0 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14,
              paddingBottom:10, borderBottom:'1px solid rgba(31,59,114,.07)' }}>
              <span style={{ width:3, height:16, borderRadius:99, background:'#D97706', display:'block', flexShrink:0 }} />
              <h3 style={{ fontFamily:"'Barlow Semi Condensed',sans-serif", fontSize:13, fontWeight:800,
                color:'#1F3B72', margin:0, textTransform:'uppercase', letterSpacing:'.06em', flex:1 }}>
                En cours de déploiement — {partialDomains.length} domaine{partialDomains.length>1?'s':''}
              </h3>
              <span style={{ fontSize:9, fontWeight:800, padding:'2px 9px', borderRadius:99,
                background:'rgba(217,119,6,.10)', color:'#D97706',
                border:'1px solid rgba(217,119,6,.15)' }}>◑ Partiel</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:12 }}>
              {partialDomains.map(d => <DomainCard key={d.id} domain={d} userRole={role} />)}
            </div>
          </div>
        )}

        {/* ── DOMAINES À VENIR ──────────────────────────────────────────────── */}
        {soonDomains.length > 0 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14,
              paddingBottom:10, borderBottom:'1px solid rgba(31,59,114,.07)' }}>
              <span style={{ width:3, height:16, borderRadius:99, background:'#9CA3AF', display:'block', flexShrink:0 }} />
              <h3 style={{ fontFamily:"'Barlow Semi Condensed',sans-serif", fontSize:13, fontWeight:800,
                color:'#1F3B72', margin:0, textTransform:'uppercase', letterSpacing:'.06em', flex:1 }}>
                Prochainement disponibles — {soonDomains.length} domaine{soonDomains.length>1?'s':''}
              </h3>
              <span style={{ fontSize:9, fontWeight:800, padding:'2px 9px', borderRadius:99,
                background:'rgba(107,114,128,.10)', color:'#6B7280',
                border:'1px solid rgba(107,114,128,.15)' }}>○ Feuille de route</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
              {soonDomains.map(d => <DomainCard key={d.id} domain={d} userRole={role} />)}
            </div>
          </div>
        )}

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', borderRadius:12,
          background:'#f7f9fc',
          border:'1px solid rgba(31,59,114,.08)', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <img src="/jambar_ia_simple_icon.svg" alt="" style={{ width:20, height:20, opacity:.5 }} />
            <span style={{ fontSize:10.5, color:'rgba(31,59,114,.4)', fontWeight:500 }}>
              Tableau de bord généré par <strong style={{ color:'#96C11E' }}>JAMBAR Agent 360°</strong> ·
              Données liées à la plateforme SEN'EAU · Évolution continue
            </span>
          </div>
          <span style={{ fontSize:10, color:'rgba(31,59,114,.25)' }}>
            {liveDomains.length}/{DOMAINS.length} domaines connectés ·
            Prochaine connexion : {partialDomains[0]?.title ?? soonDomains[0]?.title}
          </span>
        </div>

      </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  )
}
