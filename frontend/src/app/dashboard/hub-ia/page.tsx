'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import TopBar from '@/components/TopBar'
import { INDICATEURS, SERVICES, GROUPES } from '@/lib/indicateurs'
import { getCurrentUser } from '@/lib/auth'
import Agent360 from './Agent360'
import SelfServiceReport from './SelfServiceReport'
import { BarChart2, BookOpen, FileText } from 'lucide-react'

/* ── KPIs injectés dans le contexte ─────────────────────────────────────── */
const TOTAL    = INDICATEURS.length
const ATTEINTS = INDICATEURS.filter(i => i.atteint_cible).length
const PCT      = Math.round(ATTEINTS / TOTAL * 100)
const P1       = INDICATEURS.filter(i => i.priorite === 1).length
const CALC     = INDICATEURS.filter(i => i.calcule).length
const NB_SVC   = Object.keys(SERVICES).length
const NB_PROC  = Object.keys(GROUPES).length

const KPI_CONTEXT = {
  total: String(TOTAL), atteints: String(ATTEINTS), pct: String(PCT),
  priorite1: String(P1), calcules: String(CALC),
  services: String(NB_SVC), processus: String(NB_PROC),
}

/* ── Types données live (uniformisés mv_recouvrement) ────────────────────── */
type DtRecouvrement = {
  dr: string
  nb_factures: number; ca_total: number; encaissement: number; impaye: number
  taux_recouvrement: number; taux_impaye: number; a_risque: boolean; ecart_objectif: number
}

type DtBimestre = {
  bimestre: number; annee: number
  nb_factures: number; ca_total: number; encaissement: number; taux_recouvrement: number
}

type FactKpis = {
  // Indicateurs globaux
  ca_total: number; encaissement: number; impaye: number
  taux_recouvrement: number; taux_impaye: number
  nb_factures: number; nb_dr: number
  objectif_taux: number
  // Breakdowns
  par_dr: DtRecouvrement[]
  par_bimestre: DtBimestre[]
  dts_a_risque: DtRecouvrement[]
  meilleure_dt: { direction_territoriale: string; taux_recouvrement: number } | null
  pire_dt:      { direction_territoriale: string; taux_recouvrement: number } | null
  // Alias rétrocompat
  ca?: number; nb_clients?: number
  source: string; timestamp: string
} | null

type RhKpis = {
  nb_salaries: number; nb_femmes: number; taux_feminisation: number
  masse_salariale: number; salaire_moyen: number
  montant_hs: number; taux_hs: number
  nb_heures_formation: number; nb_collaborateurs_formes: number; pct_formes: number
  source: string; timestamp: string
} | null

/* ── Types ───────────────────────────────────────────────────────────────── */
type Mode = 'analyse' | 'glossaire' | 'rapport'
type Msg  = { role: 'user' | 'assistant'; content: string }

type ReportKPI = { label: string; valeur: string; unite: string; cible: string; statut: 'ok' | 'warning' | 'alert' }
type ReportData = {
  titre: string; periode: string; synthese: string
  kpis: ReportKPI[]
  positifs: string[]; vigilances: string[]; recommandations: string[]
  tableau?: { titre: string; colonnes: string[]; lignes: string[][] } | null
}

/* ── Export PDF ──────────────────────────────────────────────────────────── */
function exportReport(data: ReportData) {
  const statusColor = (s: string) => s === 'ok' ? '#16a34a' : s === 'warning' ? '#d97706' : '#dc2626'
  const statusLabel = (s: string) => s === 'ok' ? '✓' : s === 'warning' ? '!' : '✗'
  const kpiPct = (v: string) => Math.min(parseFloat(v.replace(',', '.')) || 0, 100)

  const kpiHtml = data.kpis.map(k => `
    <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:10px;padding:14px 16px">
      <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">${k.label}</div>
      <div style="font-size:22px;font-weight:800;color:${statusColor(k.statut)}">${k.valeur}${k.unite}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px">Cible : ${k.cible}${k.unite} ${statusLabel(k.statut)}</div>
      <div style="height:5px;background:#e2e8f0;border-radius:99px;margin-top:8px">
        <div style="height:5px;background:${statusColor(k.statut)};border-radius:99px;width:${kpiPct(k.valeur)}%"></div>
      </div>
    </div>`).join('')

  const tableHtml = data.tableau ? `
    <h3 style="font-size:13px;font-weight:700;color:#1F3B72;margin:24px 0 10px">📊 ${data.tableau.titre}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>${data.tableau.colonnes.map(c => `<th style="background:#1F3B72;color:#fff;padding:8px 12px;text-align:left;font-weight:600">${c}</th>`).join('')}</tr></thead>
      <tbody>${data.tableau.lignes.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">${row.map(cell => `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${data.titre}</title>
    <style>body{font-family:'Segoe UI',sans-serif;padding:32px;color:#1e293b;max-width:900px;margin:auto}
    h1{font-size:22px;font-weight:800;color:#1F3B72;margin:0}
    @media print{body{padding:16px}}</style></head>
  <body>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h1>${data.titre}</h1>
      <span style="font-size:12px;color:#64748b;font-weight:600">${data.periode}</span>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,#1F3B72,#96C11E);border-radius:99px;margin-bottom:20px"></div>
    <div style="background:#f0f9ff;border-left:4px solid #1F3B72;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:#1F3B72;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">🎯 Synthèse exécutive</div>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#334155">${data.synthese}</p>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">${kpiHtml}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:20px">
      <div style="background:#f0fdf4;border-radius:10px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:8px;text-transform:uppercase">✅ Points positifs</div>
        ${data.positifs.map(p => `<div style="font-size:12px;color:#166534;margin-bottom:5px;padding-left:8px;border-left:2px solid #86efac">• ${p}</div>`).join('')}
      </div>
      <div style="background:#fffbeb;border-radius:10px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:8px;text-transform:uppercase">⚠️ Vigilances</div>
        ${data.vigilances.map(v => `<div style="font-size:12px;color:#92400e;margin-bottom:5px;padding-left:8px;border-left:2px solid #fcd34d">• ${v}</div>`).join('')}
      </div>
      <div style="background:#eff6ff;border-radius:10px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:8px;text-transform:uppercase">💡 Recommandations</div>
        ${data.recommandations.map((r, i) => `<div style="font-size:12px;color:#1e3a8a;margin-bottom:5px;padding-left:8px;border-left:2px solid #93c5fd">${i + 1}. ${r}</div>`).join('')}
      </div>
    </div>
    ${tableHtml}
    <div style="margin-top:24px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center">
      Généré par JAMBAR — Assistant Analytique SEN'EAU · ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}
    </div>
    <script>window.onload=()=>window.print()</script>
  </body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

/* ── Composant ReportView ────────────────────────────────────────────────── */
function ReportView({ data }: { data: ReportData }) {
  const statusColor = (s: string) => s === 'ok' ? '#16a34a' : s === 'warning' ? '#d97706' : '#dc2626'
  const statusBg    = (s: string) => s === 'ok' ? '#f0fdf4' : s === 'warning' ? '#fffbeb' : '#fef2f2'
  const statusLabel = (s: string) => s === 'ok' ? '✓' : s === 'warning' ? '!' : '✗'
  const kpiPct = (v: string) => Math.min(parseFloat(v.replace(',', '.')) || 0, 100)
  const ciblePct = (v: string) => Math.min(parseFloat(v.replace(',', '.')) || 0, 100)

  return (
    <div style={{
      borderRadius:16, overflow:'hidden',
      boxShadow:'0 2px 16px rgba(31,59,114,.10), 0 0 0 1px rgba(31,59,114,.08)',
      background:'#fff', marginTop:4,
    }}>
      {/* Header */}
      <div style={{
        padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'#fff', borderBottom:'1px solid #f0f4fa',
      }}>
        <div>
          <div style={{ fontFamily:"'Barlow Semi Condensed',sans-serif", fontSize:15, fontWeight:800, color:'#1F3B72', letterSpacing:'-.01em' }}>
            {data.titre}
          </div>
          <div style={{ fontSize:11, color:'rgba(31,59,114,.45)', marginTop:2, fontWeight:500 }}>{data.periode}</div>
        </div>
        <button onClick={() => exportReport(data)} style={{
          display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
          background:'rgba(150,193,30,.10)', border:'1px solid rgba(150,193,30,.25)',
          color:'#4d6610', fontSize:11, fontWeight:700, cursor:'pointer',
          transition:'all .18s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(150,193,30,.18)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(150,193,30,.10)' }}
        >
          ↓ Exporter PDF
        </button>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Synthèse */}
        <div style={{
          background:'#f0f6ff', borderLeft:'3px solid #1F3B72',
          borderRadius:'0 10px 10px 0', padding:'12px 16px',
        }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:'#1F3B72', letterSpacing:'.07em', textTransform:'uppercase', marginBottom:5 }}>
            Synthèse exécutive
          </div>
          <p style={{ margin:0, fontSize:13, color:'#334155', lineHeight:1.65, fontFamily:"'Nunito',sans-serif" }}>{data.synthese}</p>
        </div>

        {/* KPIs */}
        {data.kpis.length > 0 && (
          <div>
            <div style={{ fontSize:10.5, fontWeight:700, color:'rgba(31,59,114,.4)', letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>
              Indicateurs clés
            </div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(data.kpis.length, 3)},1fr)`, gap:8 }}>
              {data.kpis.map((k, i) => (
                <div key={i} style={{
                  background: statusBg(k.statut), borderRadius:10, padding:'12px 14px',
                  borderLeft:`3px solid ${statusColor(k.statut)}`,
                  boxShadow:'0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <div style={{ fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>{k.label}</div>
                  <div style={{ fontSize:20, fontWeight:800, color: statusColor(k.statut), lineHeight:1 }}>
                    {k.valeur}{k.unite}
                  </div>
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>
                    Cible : {k.cible}{k.unite} {statusLabel(k.statut)}
                  </div>
                  {/* Barre de progression */}
                  <div style={{ position:'relative', height:5, background:'#e2e8f0', borderRadius:99, marginTop:8 }}>
                    {/* Cible marker */}
                    <div style={{
                      position:'absolute', top:-2, width:2, height:9, background:'#94a3b8', borderRadius:1,
                      left:`${ciblePct(k.cible)}%`, transform:'translateX(-50%)',
                    }} />
                    <div style={{ height:5, background: statusColor(k.statut), borderRadius:99, width:`${kpiPct(k.valeur)}%`, transition:'width .6s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3 colonnes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          {/* Positifs */}
          <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Points positifs</div>
            {data.positifs.map((p, i) => (
              <div key={i} style={{ fontSize:12, color:'#166534', marginBottom:5, paddingLeft:8, borderLeft:'2px solid #86efac', lineHeight:1.4 }}>{p}</div>
            ))}
          </div>
          {/* Vigilances */}
          <div style={{ background:'#fffbeb', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Vigilances</div>
            {data.vigilances.map((v, i) => (
              <div key={i} style={{ fontSize:12, color:'#92400e', marginBottom:5, paddingLeft:8, borderLeft:'2px solid #fcd34d', lineHeight:1.4 }}>{v}</div>
            ))}
          </div>
          {/* Recommandations */}
          <div style={{ background:'#eff6ff', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Recommandations</div>
            {data.recommandations.map((r, i) => (
              <div key={i} style={{ fontSize:12, color:'#1e3a8a', marginBottom:5, paddingLeft:8, borderLeft:'2px solid #93c5fd', lineHeight:1.4 }}><strong>{i + 1}.</strong> {r}</div>
            ))}
          </div>
        </div>

        {/* Tableau */}
        {data.tableau && data.tableau.colonnes.length > 0 && (
          <div>
            <div style={{ fontSize:10.5, fontWeight:700, color:'rgba(31,59,114,.4)', letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>
              {data.tableau.titre}
            </div>
            <div style={{ borderRadius:10, overflow:'hidden', boxShadow:'0 0 0 1px rgba(31,59,114,.08)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>{data.tableau.colonnes.map((c, i) => (
                    <th key={i} style={{ background:'#1F3B72', color:'#fff', padding:'9px 12px', textAlign:'left', fontWeight:600, fontSize:11 }}>{c}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {data.tableau.lignes.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? '#f8fafc' : '#fff' }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding:'8px 12px', borderBottom:'1px solid #e2e8f0', color:'#334155' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div suppressHydrationWarning style={{ fontSize:10, color:'rgba(31,59,114,.3)', textAlign:'right', borderTop:'1px solid #f1f5f9', paddingTop:8, fontWeight:500 }}>
          Généré par JAMBAR · SEN&#x27;EAU · {new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}
        </div>
      </div>
    </div>
  )
}

/* ── Données par mode ────────────────────────────────────────────────────── */
const MODES: { id: Mode; icon: React.ReactNode; label: string; color: string }[] = [
  { id:'analyse',  icon:<BarChart2 size={14}/>, label:'Analyse',          color:'#1F3B72' },
  { id:'glossaire',icon:<BookOpen  size={14}/>, label:'Glossaire',        color:'#0891B2' },
  { id:'rapport',  icon:<FileText  size={14}/>, label:'Rapport Narratif', color:'#7C3AED' },
]

const MODE_DESC: Record<Mode, { headline: string; sub: string; badge: string; badgeColor: string }> = {
  analyse: {
    headline: 'Analyse des performances',
    sub: `Interrogez JAMBAR sur vos ${TOTAL} indicateurs SEN'EAU. Identifiez les écarts, les tendances et obtenez des recommandations ciblées.`,
    badge: `${ATTEINTS}/${TOTAL} cibles atteintes`,
    badgeColor: PCT >= 80 ? '#16a34a' : PCT >= 60 ? '#d97706' : '#dc2626',
  },
  glossaire: {
    headline: 'Référentiel métier SEN\'EAU',
    sub: 'Définitions officielles, formules de calcul, seuils cibles et exemples concrets pour tous les indicateurs et concepts métier.',
    badge: '13 directions · 5 segments',
    badgeColor: '#0891B2',
  },
  rapport: {
    headline: 'Génération de rapports narratifs',
    sub: 'Produisez des synthèses exécutives prêtes à l\'emploi pour le CODIR, la Direction Générale ou vos revues de performance.',
    badge: 'Rapport prêt en quelques secondes',
    badgeColor: '#7C3AED',
  },
}

const SUGGESTIONS: Record<Mode, { text: string; sub: string }[]> = {
  analyse: [
    { text:'Performance globale',    sub:'Taux global de cibles atteintes ?' },
    { text:'Services en difficulté', sub:'Quels services sous-performent ?' },
    { text:'Meilleurs résultats',    sub:'Top 3 services par performance' },
    { text:'Plan d\'action',         sub:'Recommandations prioritaires' },
    { text:'Tendances positives',    sub:'Indicateurs en progression' },
    { text:'Indicateurs P1',         sub:'Priorités stratégiques en attente' },
  ],
  glossaire: [
    { text:'Taux de recouvrement',    sub:'Définition et formule de calcul' },
    { text:'Score Client 360°',       sub:'Segmentation et critères d\'évaluation' },
    { text:'Rendement réseau',        sub:'Comment est-il calculé ?' },
    { text:'Impayé chronique',        sub:'Seuils et profil client critique' },
    { text:'Gouvernance des données', sub:'Cadre et responsabilités' },
    { text:'CA vs encaissement',      sub:'Différence comptable clé' },
  ],
  rapport: [
    { text:'Rapport Facturation',      sub:'Génère un rapport facturation complet avec les données réelles : CA, encaissement, impayés, taux de recouvrement par DT, et recommandations ciblées.' },
    { text:'Rapport RH',              sub:'Génère un rapport RH mensuel avec les données réelles : effectifs, taux de féminisation, masse salariale, heures supplémentaires et formation.' },
    { text:'Rapport CODIR',           sub:'Génère un rapport CODIR complet en utilisant les données réelles de facturation (CA, encaissement, taux recouvrement, impayés) et de RH (effectifs, masse salariale, formation). Inclure synthèse, KPIs, points positifs, vigilances et recommandations.' },
    { text:'Impayés & recouvrement',  sub:'Analyse les impayés et le taux de recouvrement avec les données réelles. Identifie les écarts par rapport à la cible de 85% et propose un plan d\'action.' },
    { text:'Masse salariale',         sub:'Génère un rapport masse salariale avec les données réelles : montant total, salaire moyen, heures supplémentaires, drift salarial et recommandations.' },
    { text:'Tableau de bord DG',      sub:'Génère une synthèse consolidée pour la Direction Générale avec les indicateurs clés facturation et RH issus des données réelles.' },
  ],
}

/* ── Markdown basique ────────────────────────────────────────────────────── */
function renderMd(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(31,59,114,.08);padding:1px 6px;border-radius:4px;font-size:.9em">$1</code>')
    .replace(/\n/g, '<br/>')
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function HubIAPage() {
  const [mode, setMode]           = useState<Mode>('analyse')
  const [allMsgs, setAllMsgs]     = useState<Record<Mode, Msg[]>>({ analyse:[], glossaire:[], rapport:[] })
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [user, setUser]           = useState<ReturnType<typeof getCurrentUser>>(null)
  const [allReports, setAllReports] = useState<Record<Mode, Record<number, ReportData>>>({ analyse:{}, glossaire:{}, rapport:{} })
  const [factKpis, setFactKpis] = useState<FactKpis>(null)
  const [rhKpis,   setRhKpis]   = useState<RhKpis>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const msgs    = allMsgs[mode]
  const reports = allReports[mode]

  useEffect(() => { setUser(getCurrentUser()) }, [])

  // Charger les KPIs live facturation + RH (parallèle, un seul re-render)
  useEffect(() => {
    Promise.all([
      fetch('/api/facturation/kpis').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/rh/kpis').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([fact, rh]) => {
      if (fact && !fact.error) setFactKpis(fact)
      if (rh   && !rh.error)  setRhKpis(rh)
    })
  }, [])

  const isWelcome = msgs.length === 0

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior:'smooth' })
  }, [msgs, loading])

  const switchMode = (m: Mode) => { setMode(m); setInput(''); if (textRef.current) textRef.current.style.height = 'auto' }

  const autoResize = () => {
    const t = textRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 140) + 'px'
  }

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim()
    if (!q || loading) return

    const newMsgs: Msg[] = [...msgs, { role:'user', content: q }]
    setAllMsgs(prev => ({ ...prev, [mode]: newMsgs }))
    setInput('')
    if (textRef.current) textRef.current.style.height = 'auto'
    setLoading(true)

    const assistantIdx = newMsgs.length // index du message assistant à venir
    const currentMode  = mode           // capturer le mode au moment de l'envoi

    // En mode rapport, remplacer les longues réponses JSON par un placeholder
    // évite de renvoyer ~1000 tokens de JSON inutile dans l'historique
    const apiMessages = newMsgs.map(m => ({
      role: m.role,
      content: (currentMode === 'rapport' && m.role === 'assistant' && (m.content?.length ?? 0) > 300)
        ? '[rapport précédent généré]'
        : m.content,
    }))

    try {
      const res = await fetch('/api/seni', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          mode: currentMode,
          kpis: KPI_CONTEXT,
          // liveData uniquement en mode rapport — inutile pour analyse/glossaire
          ...(currentMode === 'rapport' ? { liveData: { fact: factKpis, rh: rhKpis } } : {}),
        }),
      })
      if (!res.ok || !res.body) throw new Error()

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   reply   = ''

      setAllMsgs(prev => ({ ...prev, [currentMode]: [...prev[currentMode], { role:'assistant', content:'' }] }))
      setLoading(false)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        setAllMsgs(prev => {
          const next = [...prev[currentMode]]
          next[next.length - 1] = { role:'assistant', content: reply }
          return { ...prev, [currentMode]: next }
        })
      }

      // Mode rapport : parser le JSON et stocker le rapport
      if (currentMode === 'rapport') {
        try {
          const cleaned = reply.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
          const parsed = JSON.parse(cleaned) as ReportData
          if (parsed.titre && parsed.synthese) {
            setAllReports(prev => ({ ...prev, [currentMode]: { ...prev[currentMode], [assistantIdx]: parsed } }))
          }
        } catch { /* fallback markdown */ }
      }
    } catch {
      setLoading(false)
      setAllMsgs(prev => ({ ...prev, [currentMode]: [...prev[currentMode], {
        role:'assistant',
        content:'⚠️ **Clé API manquante.** Ajoutez `ANTHROPIC_API_KEY` dans `.env.local` et redémarrez le serveur.',
      }] }))
    }
  }, [input, loading, msgs, mode, factKpis, rhKpis])  // factKpis/rhKpis chargés une fois au montage

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const activeMode = MODES.find(m => m.id === mode)!

  return (
    <>
      <TopBar title="Hub IA" subtitle="JAMBAR — Assistant Analytique SEN'EAU" />

      <div style={{
        flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
        background:'#fff', height:'calc(100vh - 56px)',
      }}>

        {/* ── Barre mode + identité ──────────────────────────────────────── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 28px', background:'#fff',
          boxShadow:'0 1px 0 rgba(31,59,114,.07)',
        }}>
          {/* Identité JAMBAR */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:'linear-gradient(135deg,#1F3B72,#2B50A0)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 3px 10px rgba(31,59,114,.25)', overflow:'hidden',
            }}>
              <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width:36, height:36, objectFit:'cover', objectPosition:'center 30%' }} />
            </div>
            <div>
              <div style={{ fontFamily:"'Barlow Semi Condensed',sans-serif",
                fontSize:16, fontWeight:800, color:'#1F3B72', lineHeight:1.1,
                display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:'#96C11E' }}>JAMBAR</span>
                <span style={{ display:'flex', alignItems:'center', gap:5,
                  fontSize:10, fontWeight:600, color:'rgba(31,59,114,.4)',
                  background:'rgba(150,193,30,.10)', padding:'2px 9px',
                  borderRadius:99, letterSpacing:'.04em' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#96C11E',
                    boxShadow:'0 0 0 2px rgba(150,193,30,.3)', animation:'pulseJ 2s infinite', display:'inline-block' }} />
                  En ligne
                </span>
              </div>
              <div style={{ fontSize:10.5, color:'rgba(31,59,114,.38)', fontWeight:500, marginTop:1 }}>
                Spécialisé données SEN&#x27;EAU
              </div>
            </div>
          </div>

          {/* Mode tabs + reset */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => switchMode(m.id)} style={{
                padding:'7px 16px', borderRadius:99, border:'none', outline:'none',
                background: mode === m.id ? m.color : 'transparent',
                color: mode === m.id ? '#fff' : '#4B5E7E',
                fontSize:12, fontWeight: mode === m.id ? 700 : 500,
                cursor:'pointer', transition:'all .18s',
                display:'flex', alignItems:'center', gap:5,
                boxShadow: mode === m.id ? `0 3px 12px ${m.color}40` : 'none',
              }}
              onMouseEnter={e => { if(mode !== m.id)(e.currentTarget as HTMLButtonElement).style.background='#f0f4fa' }}
              onMouseLeave={e => { if(mode !== m.id)(e.currentTarget as HTMLButtonElement).style.background='transparent' }}
              >
                <span style={{ display:'flex', alignItems:'center' }}>{m.icon}</span>{m.label}
              </button>
            ))}
            <div style={{ width:1, height:20, background:'rgba(31,59,114,.10)', margin:'0 4px' }} />
            <button onClick={() => { setAllMsgs(prev => ({...prev, [mode]:[]})); setAllReports(prev => ({...prev, [mode]:{}})); setInput(''); if (textRef.current) textRef.current.style.height='auto' }} title="Nouvelle conversation" style={{
              width:32, height:32, borderRadius:8, border:'none', outline:'none',
              background:'transparent', color:'rgba(31,59,114,.35)',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:15, transition:'all .15s',
            }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='#fef2f2'; b.style.color='#EF4444' }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='transparent'; b.style.color='rgba(31,59,114,.35)' }}
            >✕</button>
          </div>
        </div>

        {/* ── Zone conversation ──────────────────────────────────────────── */}
        <div ref={chatRef} style={{
          flex:1, overflowY:'auto', padding:'0 24px',
          scrollbarWidth:'thin', scrollbarColor:'rgba(31,59,114,.12) transparent',
        }}>
          <div style={{ maxWidth:760, margin:'0 auto', paddingBottom:20 }}>

            {/* ── Écran d'accueil ── */}
            {isWelcome && (
              <div style={{ paddingTop:40, paddingBottom:8 }}>

                {/* Hero — identité + salutation */}
                <div style={{ textAlign:'center', marginBottom:28 }}>
                  <div style={{
                    width:72, height:72, borderRadius:22, margin:'0 auto 18px',
                    background:'linear-gradient(135deg,#1F3B72,#2B50A0)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 10px 36px rgba(31,59,114,.26)', overflow:'hidden',
                  }}>
                  <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width:72, height:72, objectFit:'cover', objectPosition:'center 30%' }} />
                  </div>
                  <h2 style={{ fontFamily:"'Barlow Semi Condensed',sans-serif",
                    fontSize:28, fontWeight:800, color:'#1F3B72', marginBottom:6,
                    letterSpacing:'-.01em' }}>
                    Bonjour{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                  </h2>
                  <p style={{ fontSize:14, color:'rgba(31,59,114,.5)', fontWeight:500, marginBottom:20 }}>
                    Je suis <strong style={{ color:'#96C11E' }}>JAMBAR</strong>, votre assistant analytique SEN&#x27;EAU.
                  </p>

                  {/* KPI stats mini-row */}
                  <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:24, flexWrap:'wrap' }}>
                    {[
                      { label:'Indicateurs',        value: String(TOTAL),           color:'#1F3B72' },
                      { label:'Cibles atteintes',   value: `${ATTEINTS}/${TOTAL}`,  color: PCT >= 80 ? '#16a34a' : '#d97706' },
                      { label:'Taux de réalisation',value: `${PCT}%`,               color: PCT >= 80 ? '#16a34a' : '#d97706' },
                      { label:'Priorité 1',          value: String(P1),              color:'#E84040' },
                    ].map(k => (
                      <div key={k.label} style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'8px 16px', borderRadius:12,
                        background:'#f7f9fc',
                        boxShadow:'0 1px 3px rgba(31,59,114,.07), 0 0 0 1px rgba(31,59,114,.06)',
                      }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:k.color, flexShrink:0 }} />
                        <div style={{ textAlign:'left' }}>
                          <div style={{ fontSize:15, fontWeight:800, color: k.color, lineHeight:1.1 }}>{k.value}</div>
                          <div style={{ fontSize:10, color:'rgba(31,59,114,.4)', fontWeight:600, letterSpacing:'.02em' }}>{k.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bandeau contextuel par mode */}
                {(() => {
                  const d = MODE_DESC[mode]
                  const modeColor = MODES.find(m => m.id === mode)!.color
                  return (
                    <div style={{
                      borderRadius:16, padding:'16px 20px', marginBottom:24,
                      background:`${modeColor}08`,
                      boxShadow:`inset 0 0 0 1px ${modeColor}18`,
                      display:'flex', alignItems:'center', gap:16,
                    }}>
                      <div style={{
                        width:36, height:36, borderRadius:10, flexShrink:0,
                        background:`${modeColor}12`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color: modeColor,
                      }}>{MODES.find(m => m.id === mode)!.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Barlow Semi Condensed',sans-serif",
                          fontSize:14, fontWeight:800, color: modeColor, marginBottom:4 }}>
                          {d.headline}
                        </div>
                        <p style={{ fontSize:12.5, color:'rgba(31,59,114,.55)', lineHeight:1.55,
                          margin:0, fontWeight:500 }}>{d.sub}</p>
                      </div>
                      <span style={{
                        flexShrink:0, fontSize:10.5, fontWeight:700, padding:'4px 11px',
                        borderRadius:99, color: d.badgeColor,
                        background: `${d.badgeColor}12`,
                        whiteSpace:'nowrap',
                      }}>{d.badge}</span>
                    </div>
                  )
                })()}

                {/* Suggestions */}
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'rgba(31,59,114,.35)',
                    letterSpacing:'.08em', textTransform:'uppercase', marginBottom:10 }}>
                    Suggestions
                  </div>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns: SUGGESTIONS[mode].length <= 4 ? 'repeat(2,1fr)' : 'repeat(3,1fr)',
                    gap:8,
                  }}>
                    {SUGGESTIONS[mode].map(s => (
                      <button key={s.text} onClick={() => send(s.sub)} style={{
                        padding:'13px 15px', borderRadius:13, border:'none', outline:'none',
                        background:'#f7f9fc', cursor:'pointer', textAlign:'left',
                        transition:'all .18s',
                        boxShadow:'0 1px 3px rgba(31,59,114,.07), 0 0 0 1px rgba(31,59,114,.06)',
                        display:'flex', flexDirection:'column', gap:4,
                      }}
                      onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='#eef2fb'; b.style.transform='translateY(-1px)'; b.style.boxShadow='0 4px 14px rgba(31,59,114,.10)' }}
                      onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background='#f7f9fc'; b.style.transform='none'; b.style.boxShadow='0 1px 3px rgba(31,59,114,.07), 0 0 0 1px rgba(31,59,114,.06)' }}
                      >
                        <span style={{ fontSize:12.5, fontWeight:700, color:'#1F3B72', lineHeight:1.3 }}>{s.text}</span>
                        <span style={{ fontSize:11.5, color:'rgba(31,59,114,.45)', lineHeight:1.4 }}>{s.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Messages ── */}
            {msgs.map((m, i) => (
              <div key={i} style={{ marginTop: i === 0 ? 28 : 0, marginBottom:8 }}>
                {m.role === 'user' ? (
                  /* Message utilisateur — bulle droite */
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
                    <div style={{
                      maxWidth:'72%', padding:'12px 18px', borderRadius:'18px 4px 18px 18px',
                      background:'linear-gradient(135deg,#1F3B72,#2B50A0)',
                      color:'#fff', fontSize:14, lineHeight:1.6,
                      boxShadow:'0 3px 14px rgba(31,59,114,.22)',
                    }}>{m.content}</div>
                  </div>
                ) : (
                  /* Message JAMBAR */
                  <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'12px 0' }}>
                    <div style={{
                      width:30, height:30, borderRadius:8, flexShrink:0,
                      background:'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      filter:'drop-shadow(0 2px 6px rgba(31,59,114,.18))', marginTop:2, overflow:'hidden',
                    }}>
                      <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width:30, height:30, objectFit:'cover', objectPosition:'center 30%' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Rapport parsé → ReportView */}
                      {reports[i] ? (
                        <ReportView data={reports[i]} />
                      ) : mode === 'rapport' && m.content && !reports[i] ? (
                        /* Streaming rapport en cours → placeholder */
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 16px',
                          background:'#f0f6ff', borderRadius:12, fontSize:13, color:'#1F3B72', fontWeight:600 }}>
                          <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #1F3B72',
                            borderTopColor:'transparent', animation:'spin 1s linear infinite', flexShrink:0 }} />
                          Génération du rapport en cours…
                        </div>
                      ) : (
                        <div style={{ fontSize:14, color:'#111827', lineHeight:1.7, fontFamily:"'Nunito',sans-serif" }}
                          dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing ── */}
            {loading && (
              <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'12px 0' }}>
                <div style={{
                  width:30, height:30, borderRadius:8, flexShrink:0,
                  background:'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  filter:'drop-shadow(0 2px 6px rgba(31,59,114,.18))', marginTop:2, overflow:'hidden',
                }}>
                  <img src="/jambar_ia_simple_icon.svg" alt="JAMBAR" style={{ width:30, height:30, objectFit:'cover', objectPosition:'center 30%' }} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5, paddingTop:8 }}>
                  {[0, .2, .4].map((d, i) => (
                    <span key={i} style={{
                      width:7, height:7, borderRadius:'50%', background:'#1F3B72',
                      display:'block', animation:`typingJ 1.4s ${d}s infinite`,
                      opacity:.5,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Input zone — style ChatGPT ─────────────────────────────────── */}
        {<div style={{ padding:'16px 24px 20px', background:'#fff' }}>
          <div style={{ maxWidth:760, margin:'0 auto' }}>
            <div style={{
              display:'flex', alignItems:'flex-end', gap:10,
              background:'#fff',
              borderRadius:18, padding:'12px 12px 12px 20px',
              boxShadow:'0 0 0 1px rgba(31,59,114,.12), 0 4px 24px rgba(31,59,114,.08)',
              transition:'box-shadow .2s',
            }}>
              <textarea
                ref={textRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize() }}
                onKeyDown={onKey}
                placeholder={`Posez votre question à JAMBAR…`}
                rows={1}
                style={{
                  flex:1, border:'none', background:'transparent', outline:'none',
                  fontFamily:"'Nunito',sans-serif", fontSize:14, color:'#111827',
                  resize:'none', lineHeight:1.6, maxHeight:140,
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                style={{
                  width:40, height:40, borderRadius:12, border:'none', outline:'none',
                  background: input.trim() && !loading ? '#1F3B72' : '#e5e7eb',
                  color: input.trim() && !loading ? '#fff' : '#9ca3af',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, transition:'all .18s', fontSize:16,
                  boxShadow: input.trim() && !loading ? '0 3px 10px rgba(31,59,114,.30)' : 'none',
                }}
              >↑</button>
            </div>
            <p style={{ textAlign:'center', fontSize:10.5, color:'rgba(31,59,114,.28)',
              marginTop:8, fontWeight:500 }}>
              JAMBAR est spécialisé sur les données SEN&#x27;EAU · Entrée pour envoyer · Shift+Entrée pour nouvelle ligne
            </p>
          </div>
        </div>}
      </div>

      <style>{`
        @keyframes pulseJ {
          0%,100%{ box-shadow:0 0 0 2px rgba(150,193,30,.25); }
          50%    { box-shadow:0 0 0 5px rgba(150,193,30,.08); }
        }
        @keyframes typingJ {
          0%,80%,100%{ transform:scale(.7); opacity:.35; }
          40%        { transform:scale(1);  opacity:1;   }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </>
  )
}
