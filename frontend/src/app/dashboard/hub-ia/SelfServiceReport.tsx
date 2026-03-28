'use client'
import React, { useState } from 'react'

/* ── Types (uniformisés mv_recouvrement) ─────────────────────────────────── */
type DtRecouvrement = {
  dr: string
  nb_factures: number
  ca_total: number        // SUM(chiffre_affaire)
  encaissement: number    // SUM(montant_regle)
  impaye: number          // SUM(impaye)
  taux_recouvrement: number
  taux_impaye: number
  a_risque: boolean       // taux < objectif_taux
  ecart_objectif: number  // taux − objectif (négatif = sous l'objectif)
}

type DtBimestre = {
  bimestre: number; annee: number
  nb_factures: number; ca_total: number; encaissement: number; taux_recouvrement: number
}

type FactKpis = {
  // Indicateurs globaux
  ca_total: number        // SUM(chiffre_affaire)
  encaissement: number    // SUM(montant_regle)
  impaye: number          // SUM(impaye)
  taux_recouvrement: number
  taux_impaye: number
  nb_factures: number
  nb_dr: number
  objectif_taux: number   // 98.5%
  // Breakdowns
  par_dr: DtRecouvrement[]
  par_bimestre: DtBimestre[]
  dts_a_risque: DtRecouvrement[]
  meilleure_dt: { direction_territoriale: string; taux_recouvrement: number } | null
  pire_dt:      { direction_territoriale: string; taux_recouvrement: number } | null
  // Alias rétrocompat (fourni par l'API)
  ca?: number; nb_clients?: number
} | null

type RhKpis = {
  nb_salaries: number; nb_femmes: number; taux_feminisation: number
  masse_salariale: number; salaire_moyen: number
  montant_hs: number; taux_hs: number
  nb_heures_formation: number; nb_collaborateurs_formes: number; pct_formes: number
} | null

type ReportKPI = { label: string; valeur: string; unite: string; cible: string; statut: 'ok' | 'warning' | 'alert' }
type ReportData = {
  titre: string; periode: string; synthese: string
  kpis: ReportKPI[]
  positifs: string[]; vigilances: string[]; recommandations: string[]
  tableau?: { titre: string; colonnes: string[]; lignes: string[][] } | null
}

type SelfConfig = {
  sources: { fact: boolean; rh: boolean; croise: boolean }
  annee: number
  mois: number   // 0 = toute l'année
  typeRapport: string
  demandeLibre: string
}

const MOIS_LABELS = ['Toute l\'année','Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const TYPES_RAPPORT = [
  { val:'synthese',    label:'Rapport de synthèse global',            sources:['fact','rh'] },
  { val:'facturation', label:'Performance commerciale & recouvrement', sources:['fact'] },
  { val:'rh',          label:'Ressources humaines & effectifs',        sources:['rh'] },
  { val:'salariale',   label:'Masse salariale & heures supp.',          sources:['rh'] },
  { val:'absences',    label:'Suivi des absences & présences',          sources:['rh'] },
  { val:'formation',   label:'Plan de formation & compétences',         sources:['rh'] },
  { val:'croise',      label:'Analyse croisée RH × Facturation',        sources:['fact','rh'] },
  { val:'dg',          label:'Tableau de bord Direction Générale',      sources:['fact','rh'] },
]

const ANNEES = [2020,2021,2022,2023,2024,2025,2026]

/* ── Utilitaires ──────────────────────────────────────────────────────────── */
function fmtM(v?: number) {
  if (!v) return 'N/A'
  return v >= 1e9 ? `${(v/1e9).toFixed(2)} Mrd FCFA` : `${(v/1e6).toFixed(2)} M FCFA`
}
function fmtN(v?: number) {
  if (v == null) return 'N/A'
  return new Intl.NumberFormat('fr-FR').format(v)
}

/* ── Construction du prompt ──────────────────────────────────────────────── */
function buildPrompt(cfg: SelfConfig, factKpis: FactKpis, rhKpis: RhKpis): string {
  const type = TYPES_RAPPORT.find(t => t.val === cfg.typeRapport)
  const periode = cfg.mois === 0
    ? `Année ${cfg.annee} (complète)`
    : `${MOIS_LABELS[cfg.mois]} ${cfg.annee}`
  const sourcesLabel = [
    cfg.sources.fact  && 'Facturation',
    cfg.sources.rh    && 'RH',
    cfg.sources.croise && 'Analyse croisée',
  ].filter(Boolean).join(', ')

  const objectif = factKpis?.objectif_taux ?? 98.5

  let dataSection = ''
  if (cfg.sources.fact && factKpis) {
    // Format compact : une ligne par DT
    const drLines = factKpis.par_dr.map(d =>
      `  ${d.a_risque ? '⚠' : '✓'} ${d.dr} | CA ${fmtM(d.ca_total)} | Enc ${fmtM(d.encaissement)} | Imp ${fmtM(d.impaye)} | Taux ${d.taux_recouvrement.toFixed(1)}% (obj ${objectif}% / écart ${d.ecart_objectif.toFixed(1)} pts)`
    ).join('\n')

    const risqueResume = factKpis.dts_a_risque.length
      ? `${factKpis.dts_a_risque.length} DT(s) sous objectif : ${factKpis.dts_a_risque.map(d => `${d.dr} ${d.taux_recouvrement.toFixed(1)}%`).join(', ')}`
      : 'Toutes les DTs atteignent l\'objectif'

    dataSection += `
DONNÉES FACTURATION — sen_ods · mv_recouvrement (${periode}) :
• CA total             : ${fmtM(factKpis.ca_total)}
• Encaissement         : ${fmtM(factKpis.encaissement)}
• Impayés              : ${fmtM(factKpis.impaye)}
• Taux recouvrement    : ${factKpis.taux_recouvrement.toFixed(1)}%  [objectif : ${objectif}%]
• Taux impayés         : ${factKpis.taux_impaye.toFixed(1)}%
• Nb factures          : ${fmtN(factKpis.nb_factures)} | Nb DTs : ${factKpis.nb_dr}
RECOUVREMENT PAR DT :
${drLines}
DTs A RISQUE : ${risqueResume}`
  }

  if (cfg.sources.rh && rhKpis) {
    dataSection += `
DONNÉES RH — sen_dwh (${periode}) :
• Effectif total          : ${fmtN(rhKpis.nb_salaries)} collaborateurs
• Effectif féminin        : ${fmtN(rhKpis.nb_femmes)}  — Féminisation : ${rhKpis.taux_feminisation?.toFixed(1)}%  [seuil > 20%]
• Masse salariale         : ${fmtM(rhKpis.masse_salariale)}
• Salaire moyen           : ${fmtM(rhKpis.salaire_moyen)}
• Heures supp. (montant)  : ${fmtM(rhKpis.montant_hs)}  — Taux HS : ${rhKpis.taux_hs?.toFixed(2)}%  [seuil > 5%]
• Formation               : ${fmtN(rhKpis.nb_heures_formation)} h — ${fmtN(rhKpis.nb_collaborateurs_formes)} formés (${rhKpis.pct_formes?.toFixed(1)}%)`
  }

  if (cfg.sources.croise && factKpis && rhKpis) {
    const caRef = factKpis.ca_total ?? factKpis.ca ?? 0
    const ratio = caRef && rhKpis.masse_salariale
      ? ((rhKpis.masse_salariale / caRef) * 100).toFixed(1)
      : 'N/A'
    dataSection += `
CROISEMENT RH × FACTURATION :
• Ratio masse salariale / CA  : ${ratio}%
• Analyse demandée : corrélations entre performance RH et taux de recouvrement par DT`
  }

  const demandeSection = cfg.demandeLibre.trim()
    ? `\nANALYSE SPÉCIFIQUE DEMANDÉE PAR L'UTILISATEUR :\n"${cfg.demandeLibre.trim()}"\n`
    : ''

  return `Génère un rapport self-service SEN'EAU avec les paramètres suivants :

TYPE DE RAPPORT     : ${type?.label ?? cfg.typeRapport}
SOURCES DE DONNÉES  : ${sourcesLabel}
PÉRIODE             : ${periode}
${demandeSection}
${dataSection}

INSTRUCTIONS :
- Utilise UNIQUEMENT les données réelles ci-dessus
- Produis une analyse approfondie avec croisements si plusieurs sources sélectionnées
- Formule des recommandations concrètes et actionnables
- Réponds avec le JSON structuré demandé`
}

/* ── Composant ReportView (allégé, local) ────────────────────────────────── */
function ReportView({ data, onReset, generatedAt }: { data: ReportData; onReset: () => void; generatedAt: string }) {
  const sc = (s: string) => s === 'ok' ? '#16a34a' : s === 'warning' ? '#d97706' : '#dc2626'
  const sb = (s: string) => s === 'ok' ? '#f0fdf4' : s === 'warning' ? '#fffbeb' : '#fef2f2'
  const sl = (s: string) => s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : '🔴'

  const exportPDF = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${data.titre}</title>
      <style>body{font-family:'Segoe UI',sans-serif;padding:32px;color:#1e293b;max-width:900px;margin:auto}
      h1{font-size:22px;font-weight:800;color:#1F3B72;margin:0}@media print{body{padding:16px}}</style></head>
    <body>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <h1>${data.titre}</h1>
        <span style="font-size:12px;color:#64748b">${data.periode}</span>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#1F3B72,#96C11E);border-radius:99px;margin-bottom:20px"></div>
      <div style="background:#f0f9ff;border-left:4px solid #1F3B72;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;color:#1F3B72;margin-bottom:5px;text-transform:uppercase">🎯 Synthèse</div>
        <p style="margin:0;font-size:13px;line-height:1.6">${data.synthese}</p>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        ${data.kpis.map(k => `
          <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:10px;padding:14px 16px">
            <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:6px;text-transform:uppercase">${k.label}</div>
            <div style="font-size:22px;font-weight:800;color:${sc(k.statut)}">${k.valeur}${k.unite}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px">Cible : ${k.cible} ${sl(k.statut)}</div>
          </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:20px">
        <div style="background:#f0fdf4;border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:8px;text-transform:uppercase">✅ Points positifs</div>
          ${data.positifs.map(p=>`<div style="font-size:12px;color:#166534;margin-bottom:5px;padding-left:8px;border-left:2px solid #86efac">• ${p}</div>`).join('')}
        </div>
        <div style="background:#fffbeb;border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:8px;text-transform:uppercase">⚠️ Vigilances</div>
          ${data.vigilances.map(v=>`<div style="font-size:12px;color:#92400e;margin-bottom:5px;padding-left:8px;border-left:2px solid #fcd34d">• ${v}</div>`).join('')}
        </div>
        <div style="background:#eff6ff;border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:8px;text-transform:uppercase">💡 Recommandations</div>
          ${data.recommandations.map((r,i)=>`<div style="font-size:12px;color:#1e3a8a;margin-bottom:5px;padding-left:8px;border-left:2px solid #93c5fd">${i+1}. ${r}</div>`).join('')}
        </div>
      </div>
      <div style="margin-top:24px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center">
        Généré par JAMBAR — Self-Service SEN'EAU · ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}
      </div>
      <script>window.onload=()=>window.print()</script>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div style={{ borderRadius:16, overflow:'hidden', boxShadow:'0 2px 16px rgba(31,59,114,.10), 0 0 0 1px rgba(31,59,114,.08)', background:'#fff' }}>
      {/* Header */}
      <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #f0f4fa' }}>
        <div>
          <div style={{ fontFamily:"'Barlow Semi Condensed',sans-serif", fontSize:15, fontWeight:800, color:'#1F3B72' }}>
            📋 {data.titre}
          </div>
          <div style={{ fontSize:11, color:'rgba(31,59,114,.45)', marginTop:2 }}>{data.periode}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onReset} style={{
            padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700,
            background:'rgba(31,59,114,.06)', border:'1px solid rgba(31,59,114,.12)', color:'#1F3B72',
          }}>
            + Nouveau rapport
          </button>
          <button onClick={exportPDF} style={{
            display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8,
            background:'rgba(150,193,30,.10)', border:'1px solid rgba(150,193,30,.25)',
            color:'#4d6610', fontSize:11, fontWeight:700, cursor:'pointer',
          }}>
            ↓ Exporter PDF
          </button>
        </div>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Synthèse */}
        <div style={{ background:'#f0f6ff', borderLeft:'3px solid #1F3B72', borderRadius:'0 10px 10px 0', padding:'12px 16px' }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:'#1F3B72', letterSpacing:'.07em', textTransform:'uppercase', marginBottom:5 }}>🎯 Synthèse exécutive</div>
          <p style={{ margin:0, fontSize:13, color:'#334155', lineHeight:1.65 }}>{data.synthese}</p>
        </div>

        {/* KPIs */}
        {data.kpis.length > 0 && (
          <div>
            <div style={{ fontSize:10.5, fontWeight:700, color:'rgba(31,59,114,.4)', letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>Indicateurs clés</div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(data.kpis.length,3)},1fr)`, gap:8 }}>
              {data.kpis.map((k, i) => (
                <div key={i} style={{ background:sb(k.statut), borderRadius:10, padding:'12px 14px', borderLeft:`3px solid ${sc(k.statut)}` }}>
                  <div style={{ fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>{k.label}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:sc(k.statut) }}>{k.valeur}<span style={{ fontSize:12, fontWeight:600, marginLeft:3 }}>{k.unite}</span></div>
                  <div style={{ fontSize:10, color:'rgba(31,59,114,.4)', marginTop:3 }}>Cible : {k.cible} {sl(k.statut)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grille 3 colonnes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:7 }}>✅ Points positifs</div>
            {data.positifs.map((p, i) => <div key={i} style={{ fontSize:12, color:'#166534', marginBottom:5, paddingLeft:8, borderLeft:'2px solid #86efac', lineHeight:1.4 }}>• {p}</div>)}
          </div>
          <div style={{ background:'#fffbeb', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:7 }}>⚠️ Vigilances</div>
            {data.vigilances.map((v, i) => <div key={i} style={{ fontSize:12, color:'#92400e', marginBottom:5, paddingLeft:8, borderLeft:'2px solid #fcd34d', lineHeight:1.4 }}>• {v}</div>)}
          </div>
          <div style={{ background:'#eff6ff', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:7 }}>💡 Recommandations</div>
            {data.recommandations.map((r, i) => <div key={i} style={{ fontSize:12, color:'#1e3a8a', marginBottom:5, paddingLeft:8, borderLeft:'2px solid #93c5fd', lineHeight:1.4 }}><strong>{i+1}.</strong> {r}</div>)}
          </div>
        </div>

        {/* Tableau */}
        {data.tableau?.colonnes.length ? (
          <div>
            <div style={{ fontSize:10.5, fontWeight:700, color:'rgba(31,59,114,.4)', textTransform:'uppercase', marginBottom:8 }}>📊 {data.tableau.titre}</div>
            <div style={{ borderRadius:10, overflow:'hidden', boxShadow:'0 0 0 1px rgba(31,59,114,.08)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>{data.tableau.colonnes.map((c,i) => <th key={i} style={{ background:'#1F3B72', color:'#fff', padding:'9px 12px', textAlign:'left', fontWeight:600, fontSize:11 }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {data.tableau.lignes.map((row,ri) => (
                    <tr key={ri} style={{ background: ri%2===0 ? '#f8fafc' : '#fff' }}>
                      {row.map((cell,ci) => <td key={ci} style={{ padding:'8px 12px', borderBottom:'1px solid #e2e8f0', color:'#334155' }}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div style={{ fontSize:10, color:'rgba(31,59,114,.3)', textAlign:'right', borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
          Généré par JAMBAR Self-Service · SEN&apos;EAU · {generatedAt}
        </div>
      </div>
    </div>
  )
}

/* ── Formulaire ──────────────────────────────────────────────────────────── */
// Calculé une fois au chargement du module (côté client) — pas dans le render
const THIS_YEAR = typeof window !== 'undefined' ? new Date().getFullYear() : new Date().getUTCFullYear()

function SelfServiceForm({ onGenerate, loading }: {
  onGenerate: (cfg: SelfConfig) => void
  loading: boolean
}) {
  const [cfg, setCfg] = useState<SelfConfig>({
    sources:     { fact:true, rh:true, croise:false },
    annee:       THIS_YEAR,
    mois:        0,
    typeRapport: 'synthese',
    demandeLibre: '',
  })

  const set = (patch: Partial<SelfConfig>) => setCfg(p => ({ ...p, ...patch }))
  const setSrc = (key: keyof SelfConfig['sources'], val: boolean) =>
    setCfg(p => ({ ...p, sources: { ...p.sources, [key]: val } }))

  const canGenerate = cfg.sources.fact || cfg.sources.rh

  const labelStyle: React.CSSProperties = {
    fontSize:11, fontWeight:700, color:'rgba(31,59,114,.55)',
    textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8, display:'block',
  }
  const inputBase: React.CSSProperties = {
    width:'100%', padding:'10px 14px', borderRadius:10,
    border:'1px solid rgba(31,59,114,.14)', background:'#f9fafb',
    fontSize:13, color:'#1e293b', outline:'none', boxSizing:'border-box',
    fontFamily:"'Nunito',sans-serif",
  }
  const checkStyle: React.CSSProperties = {
    display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
    borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600,
    border:'1.5px solid', transition:'all .15s',
  }

  return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'32px 0' }}>
      {/* Titre */}
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{
          width:56, height:56, borderRadius:16, margin:'0 auto 16px',
          background:'linear-gradient(135deg,#7C3AED,#9F67F7)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:24,
          boxShadow:'0 8px 24px rgba(124,58,237,.25)',
        }}>📊</div>
        <h2 style={{ fontFamily:"'Barlow Semi Condensed',sans-serif", fontSize:24, fontWeight:800, color:'#1F3B72', margin:'0 0 8px' }}>
          Rapport Self-Service
        </h2>
        <p style={{ fontSize:13, color:'rgba(31,59,114,.5)', margin:0 }}>
          Configurez votre rapport, JAMBAR l'analyse et génère une synthèse complète.
        </p>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

        {/* Sources de données */}
        <div style={{ background:'#fff', borderRadius:14, padding:'18px 20px', boxShadow:'0 0 0 1px rgba(31,59,114,.09), 0 2px 8px rgba(31,59,114,.05)' }}>
          <span style={labelStyle}>📂 Données à inclure</span>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {([
              { key:'fact' as const,   label:'💧 Facturation',      color:'#1F3B72' },
              { key:'rh'   as const,   label:'👥 Ressources humaines', color:'#059669' },
              { key:'croise' as const, label:'🔀 Analyse croisée',   color:'#7C3AED' },
            ] as const).map(s => {
              const active = cfg.sources[s.key]
              return (
                <div key={s.key}
                  onClick={() => setSrc(s.key, !active)}
                  style={{
                    ...checkStyle,
                    background: active ? `${s.color}12` : '#f8fafc',
                    borderColor: active ? s.color : 'rgba(31,59,114,.12)',
                    color: active ? s.color : 'rgba(31,59,114,.45)',
                  }}>
                  <span style={{
                    width:16, height:16, borderRadius:4, border:`2px solid ${active ? s.color : 'rgba(31,59,114,.25)'}`,
                    background: active ? s.color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, color:'#fff', flexShrink:0, transition:'all .15s',
                  }}>
                    {active ? '✓' : ''}
                  </span>
                  {s.label}
                </div>
              )
            })}
          </div>
          {cfg.sources.croise && (
            <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'rgba(124,58,237,.06)', fontSize:12, color:'rgba(124,58,237,.8)', borderLeft:'3px solid rgba(124,58,237,.3)' }}>
              JAMBAR croisera facturation et RH : ratio masse salariale/CA, corrélations absences/recouvrement, etc.
            </div>
          )}
        </div>

        {/* Période + Type */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Période */}
          <div style={{ background:'#fff', borderRadius:14, padding:'18px 20px', boxShadow:'0 0 0 1px rgba(31,59,114,.09), 0 2px 8px rgba(31,59,114,.05)' }}>
            <span style={labelStyle}>📅 Période</span>
            <div style={{ display:'flex', gap:8 }}>
              <select value={cfg.annee} onChange={e => set({ annee:+e.target.value })} style={{ ...inputBase, flex:1 }}>
                {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={cfg.mois} onChange={e => set({ mois:+e.target.value })} style={{ ...inputBase, flex:1.4 }}>
                {MOIS_LABELS.map((m,i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Type de rapport */}
          <div style={{ background:'#fff', borderRadius:14, padding:'18px 20px', boxShadow:'0 0 0 1px rgba(31,59,114,.09), 0 2px 8px rgba(31,59,114,.05)' }}>
            <span style={labelStyle}>📋 Type de rapport</span>
            <select value={cfg.typeRapport} onChange={e => set({ typeRapport:e.target.value })} style={{ ...inputBase, width:'100%' }}>
              {TYPES_RAPPORT.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Demande spécifique */}
        <div style={{ background:'#fff', borderRadius:14, padding:'18px 20px', boxShadow:'0 0 0 1px rgba(31,59,114,.09), 0 2px 8px rgba(31,59,114,.05)' }}>
          <span style={labelStyle}>✍️ Demande spécifique <span style={{ textTransform:'none', fontWeight:500, opacity:.6 }}>(optionnel)</span></span>
          <textarea
            value={cfg.demandeLibre}
            onChange={e => set({ demandeLibre:e.target.value })}
            placeholder="Ex : Compare les absences par direction et identifie les équipes à risque de désengagement…"
            rows={3}
            style={{ ...inputBase, resize:'none', lineHeight:1.6 }}
          />
        </div>

        {/* Bouton générer */}
        <button
          onClick={() => canGenerate && !loading && onGenerate(cfg)}
          disabled={!canGenerate || loading}
          style={{
            width:'100%', padding:'14px', borderRadius:14, border:'none', cursor: canGenerate && !loading ? 'pointer' : 'not-allowed',
            background: canGenerate ? 'linear-gradient(135deg,#7C3AED,#9F67F7)' : '#e2e8f0',
            color: canGenerate ? '#fff' : '#94a3b8',
            fontSize:14, fontWeight:800, letterSpacing:'.02em',
            boxShadow: canGenerate ? '0 6px 20px rgba(124,58,237,.30)' : 'none',
            transition:'all .2s', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}>
          {loading ? (
            <>
              <span style={{ display:'inline-flex', gap:4 }}>
                {[0,.15,.3].map((d,i) => (
                  <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#fff', display:'inline-block', animation:`typingJ 1.4s ${d}s infinite`, opacity:.8 }} />
                ))}
              </span>
              JAMBAR génère votre rapport…
            </>
          ) : (
            <>✨ Générer le rapport avec JAMBAR</>
          )}
        </button>

        {!canGenerate && (
          <div style={{ fontSize:12, color:'#d97706', textAlign:'center' }}>
            Sélectionnez au moins une source de données.
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════════════════ */
/* ── Réparation JSON tronqué ─────────────────────────────────────────────── */
// Quand max_tokens est atteint, le JSON peut être coupé au milieu d'une chaîne.
// Cette fonction referme les structures ouvertes pour permettre un JSON.parse partiel.
function repairJson(raw: string): string {
  let s = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

  const stack: string[] = []
  let inStr = false
  let esc   = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (esc)              { esc = false; continue }
    if (c === '\\' && inStr) { esc = true;  continue }
    if (c === '"')        { inStr = !inStr; continue }
    if (inStr)            continue
    if (c === '{')        stack.push('}')
    else if (c === '[')   stack.push(']')
    else if (c === '}' || c === ']') stack.pop()
  }

  if (inStr) s += '"'               // fermer la chaîne non terminée
  s = s.replace(/,\s*$/, '')        // supprimer la virgule traînante
  while (stack.length) s += stack.pop()! // refermer { et [
  return s
}

/* ── Helpers période ─────────────────────────────────────────────────────── */
// mois 1-2 → B1, 3-4 → B2 … 11-12 → B6 ; 0 = toute l'année
function moisToBimestre(mois: number): number | null {
  if (mois === 0) return null
  return Math.ceil(mois / 2)
}

function buildKpisUrl(cfg: SelfConfig): string {
  const params = new URLSearchParams({ annee: String(cfg.annee) })
  const bim = moisToBimestre(cfg.mois)
  if (bim !== null) params.set('bimestre', String(bim))
  return `/api/facturation/kpis?${params}`
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════════════════ */
export default function SelfServiceReport({ rhKpis }: { factKpis: FactKpis; rhKpis: RhKpis }) {
  const [loading,     setLoading]     = useState(false)
  const [report,      setReport]      = useState<ReportData | null>(null)
  const [generatedAt, setGeneratedAt] = useState('')
  const [errMsg,      setErrMsg]      = useState<string | null>(null)
  const [stream,      setStream]      = useState('')

  const generate = async (cfg: SelfConfig) => {
    setLoading(true)
    setErrMsg(null)
    setStream('')
    setReport(null)

    // Fetch les KPIs facturation pour la période exacte choisie par l'utilisateur
    let periodFactKpis: FactKpis = null
    if (cfg.sources.fact || cfg.sources.croise) {
      try {
        const r = await fetch(buildKpisUrl(cfg))
        if (r.ok) {
          const d = await r.json()
          if (!d.error) periodFactKpis = d as FactKpis
        }
      } catch { /* laisse null, buildPrompt gérera */ }
    }

    const prompt = buildPrompt(cfg, periodFactKpis, rhKpis)
    const liveData = {
      ...(cfg.sources.fact ? { fact: periodFactKpis } : {}),
      ...(cfg.sources.rh   ? { rh:   rhKpis         } : {}),
    }

    try {
      const res = await fetch('/api/seni', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          messages: [{ role:'user', content: prompt }],
          mode: 'rapport',
          liveData,
        }),
      })
      if (!res.ok || !res.body) throw new Error('Erreur API')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   raw     = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value, { stream:true })
        setStream(raw)
      }

      // 1er essai : JSON direct ; 2e essai : réparation si tronqué
      let parsed: ReportData | null = null
      try {
        parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()) as ReportData
      } catch {
        try {
          parsed = JSON.parse(repairJson(raw)) as ReportData
        } catch (e2) {
          throw new Error(`JSON invalide : ${e2 instanceof Error ? e2.message : e2}`)
        }
      }
      if (!parsed || !parsed.titre || !parsed.synthese) throw new Error('Format invalide')
      // S'assurer que les tableaux existent même si le JSON était partiel
      parsed.kpis            = parsed.kpis            ?? []
      parsed.positifs        = parsed.positifs        ?? []
      parsed.vigilances      = parsed.vigilances      ?? []
      parsed.recommandations = parsed.recommandations ?? []
      // Capturer la date côté client uniquement (évite l'erreur d'hydratation)
      setGeneratedAt(new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }))
      setReport(parsed)
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Erreur de génération. Réessayez.')
    } finally {
      setLoading(false)
      setStream('')
    }
  }

  const reset = () => { setReport(null); setGeneratedAt(''); setErrMsg(null); setStream('') }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'0 24px', scrollbarWidth:'thin', scrollbarColor:'rgba(31,59,114,.12) transparent' }}>
      <div style={{ maxWidth:760, margin:'0 auto', paddingBottom:32 }}>

        {/* Erreur */}
        {errMsg && (
          <div style={{ margin:'16px 0', padding:'12px 16px', borderRadius:10, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:13 }}>
            ⚠️ {errMsg}
            <button onClick={reset} style={{ marginLeft:12, fontSize:12, color:'#dc2626', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Réessayer</button>
          </div>
        )}

        {/* Streaming en cours */}
        {loading && stream && (
          <div style={{ marginTop:16, padding:'12px 16px', borderRadius:10, background:'#f8fafc', border:'1px solid rgba(31,59,114,.08)', fontSize:12, color:'rgba(31,59,114,.5)', fontFamily:'monospace' }}>
            {stream.slice(-200)}
          </div>
        )}

        {/* Résultat */}
        {report ? (
          <div style={{ marginTop:16 }}>
            <ReportView data={report} onReset={reset} generatedAt={generatedAt} />
          </div>
        ) : !loading && (
          <SelfServiceForm onGenerate={generate} loading={loading} />
        )}

        {/* Loading sans stream */}
        {loading && !stream && (
          <div style={{ marginTop:60, textAlign:'center' }}>
            <div style={{ display:'inline-flex', gap:6, marginBottom:12 }}>
              {[0,.2,.4].map((d,i) => (
                <span key={i} style={{ width:10, height:10, borderRadius:'50%', background:'#7C3AED', display:'inline-block', animation:`typingJ 1.4s ${d}s infinite`, opacity:.7 }} />
              ))}
            </div>
            <p style={{ fontSize:13, color:'rgba(31,59,114,.45)', margin:0 }}>JAMBAR analyse vos données…</p>
          </div>
        )}
      </div>
    </div>
  )
}
