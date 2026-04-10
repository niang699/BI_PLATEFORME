/**
 * POST /api/rapports/generate
 * Génère un rapport HTML PDF-ready à partir des vraies données (mêmes sources que l'Excel).
 * Body : { rapport_id: 'recouvrement'|'rh'|'facturation', filtres: Record<string,string> }
 */
import { NextRequest, NextResponse } from 'next/server'

/* ─── Helpers formatage ──────────────────────────────────────────────────── */
const fmt = (v: unknown) => Number(v ?? 0).toLocaleString('fr-FR')
const pct = (enc: number, ca: number) =>
  ca > 0 ? `${(Math.round((enc / ca) * 1000) / 10).toLocaleString('fr-FR')} %` : '—'

/* ─── Build query string depuis filtres (idem reportExcel.ts) ────────────── */
function buildQs(filtres: Record<string, string>, exclude: string[] = []): string {
  const MULTI_KEYS = ['groupe_facturation', 'cat_branchement']
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(filtres)) {
    if (exclude.includes(k) || !v) continue
    if (MULTI_KEYS.includes(k)) {
      v.split(',').map(s => s.trim()).filter(Boolean).forEach(val => sp.append(k, val))
    } else {
      sp.set(k, v)
    }
  }
  return sp.toString()
}

/* ─── CSS commun ─────────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Barlow+Semi+Condensed:wght@600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Nunito', sans-serif; background: #fff; color: #1F3B72; font-size: 12px; }

  .page { padding: 28px 32px; max-width: 1100px; margin: 0 auto; }

  /* Header */
  .report-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px; border-radius: 12px; margin-bottom: 28px;
    background: linear-gradient(135deg, #1F3B72 0%, #0e1f3d 100%);
    color: #fff;
  }
  .report-header .logo-area { display: flex; align-items: center; gap: 14px; }
  .report-header .logo-box {
    width: 44px; height: 44px; border-radius: 10px;
    background: rgba(150,193,30,.2); border: 1px solid rgba(150,193,30,.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }
  .report-header h1 { font-family: 'Barlow Semi Condensed', sans-serif; font-size: 18px; font-weight: 800; margin-bottom: 3px; }
  .report-header .sub { font-size: 11px; opacity: .6; font-weight: 500; }
  .report-header .meta { text-align: right; font-size: 10px; opacity: .55; line-height: 1.7; }

  /* KPI grid */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 28px; }
  .kpi-card {
    background: #f8fafc; border-radius: 10px; padding: 14px 16px;
    border: 1px solid rgba(31,59,114,.09);
  }
  .kpi-card .val { font-size: 18px; font-weight: 800; color: #1F3B72; line-height: 1; margin-bottom: 4px; }
  .kpi-card .val.green { color: #059669; }
  .kpi-card .val.red   { color: #DC2626; }
  .kpi-card .lbl { font-size: 10px; font-weight: 600; color: rgba(31,59,114,.45); text-transform: uppercase; letter-spacing: .05em; }
  .kpi-card .prev { font-size: 10px; color: rgba(31,59,114,.35); margin-top: 5px; }

  /* Sections */
  .section { margin-bottom: 28px; }
  .section-title {
    font-family: 'Barlow Semi Condensed', sans-serif; font-size: 13px; font-weight: 800;
    color: #1F3B72; text-transform: uppercase; letter-spacing: .06em;
    padding-bottom: 8px; border-bottom: 2px solid #96C11E; margin-bottom: 14px;
    display: flex; align-items: center; gap: 8px;
  }
  .section-title .dot { width: 8px; height: 8px; border-radius: 50%; background: #96C11E; flex-shrink: 0; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #1F3B72; color: #fff; }
  thead th { padding: 9px 12px; font-weight: 700; text-align: left; font-size: 10px;
    text-transform: uppercase; letter-spacing: .05em; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:hover { background: rgba(150,193,30,.06); }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  td.num { text-align: right; font-weight: 700; color: #1F3B72; }
  td.pct { text-align: right; font-weight: 800; }
  td.pct.ok  { color: #059669; }
  td.pct.bad { color: #DC2626; }

  /* Sub-header table */
  tr.sub-header td { background: rgba(31,59,114,.06); font-weight: 700; font-size: 10px;
    text-transform: uppercase; letter-spacing: .05em; color: rgba(31,59,114,.6); }

  /* Badges */
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 20px;
    font-size: 10px; font-weight: 700;
  }
  .badge.green  { background: rgba(5,150,105,.1);  color: #059669; }
  .badge.red    { background: rgba(220,38,38,.1);  color: #DC2626; }
  .badge.blue   { background: rgba(31,59,114,.08); color: #1F3B72; }

  /* Alerte objectif */
  .objectif-bar {
    background: rgba(150,193,30,.08); border: 1px solid rgba(150,193,30,.2);
    border-radius: 8px; padding: 10px 16px; margin-bottom: 16px;
    font-size: 11px; color: #5a7a10; display: flex; align-items: center; gap: 8px;
  }

  /* ── Points d'attention ── */
  .alertes-block {
    border-radius: 12px; margin-bottom: 28px; overflow: hidden;
    border: 1.5px solid rgba(220,38,38,.18);
    box-shadow: 0 2px 12px rgba(220,38,38,.06);
  }
  .alertes-header {
    display: flex; align-items: center; gap: 10; padding: 13px 18px;
    background: linear-gradient(135deg, #DC2626 0%, #b91c1c 100%);
    color: #fff;
  }
  .alertes-header .ah-icon { font-size: 16px; }
  .alertes-header .ah-title { font-family: 'Barlow Semi Condensed', sans-serif;
    font-size: 14px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  .alertes-header .ah-count {
    margin-left: auto; background: rgba(255,255,255,.2); border-radius: 20px;
    padding: 2px 10px; font-size: 11px; font-weight: 800;
  }
  .alertes-list { background: #fff; }
  .alerte-item {
    display: flex; align-items: flex-start; gap: 12; padding: 12px 18px;
    border-bottom: 1px solid rgba(220,38,38,.07);
  }
  .alerte-item:last-child { border-bottom: none; }
  .alerte-item .ai-icon {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 13px;
  }
  .alerte-item .ai-icon.critique { background: rgba(220,38,38,.1); }
  .alerte-item .ai-icon.warning  { background: rgba(217,119,6,.1); }
  .alerte-item .ai-icon.info     { background: rgba(8,145,178,.1); }
  .alerte-item .ai-body { flex: 1; min-width: 0; }
  .alerte-item .ai-label {
    font-size: 12px; font-weight: 700; margin-bottom: 2px;
  }
  .alerte-item .ai-label.critique { color: #DC2626; }
  .alerte-item .ai-label.warning  { color: #D97706; }
  .alerte-item .ai-label.info     { color: #0891B2; }
  .alerte-item .ai-detail { font-size: 11px; color: rgba(31,59,114,.5); line-height: 1.5; }
  .alerte-item .ai-val {
    font-size: 13px; font-weight: 800; flex-shrink: 0; text-align: right;
  }
  .alerte-item .ai-val.critique { color: #DC2626; }
  .alerte-item .ai-val.warning  { color: #D97706; }
  .alerte-item .ai-val.info     { color: #0891B2; }

  /* Bilan synthèse alertes */
  .alertes-bilan {
    display: flex; gap: 8px; padding: 10px 18px;
    background: rgba(248,250,252,1); border-top: 1px solid rgba(220,38,38,.08);
  }
  .bilan-pill {
    padding: 3px 12px; border-radius: 20px; font-size: 10px; font-weight: 700;
  }
  .bilan-pill.critique { background: rgba(220,38,38,.1);  color: #DC2626; }
  .bilan-pill.warning  { background: rgba(217,119,6,.1);  color: #D97706; }
  .bilan-pill.ok       { background: rgba(5,150,105,.1);  color: #059669; }

  /* Footer */
  .report-footer {
    margin-top: 40px; padding-top: 16px;
    border-top: 1px solid rgba(31,59,114,.1);
    font-size: 10px; color: rgba(31,59,114,.35); text-align: center;
    display: flex; justify-content: space-between; align-items: center;
  }

  /* Print */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .section { page-break-inside: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }

  /* Bouton imprimer */
  .print-btn {
    position: fixed; top: 20px; right: 20px; z-index: 999;
    background: #1F3B72; color: #fff; border: none; border-radius: 10px;
    padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 14px rgba(31,59,114,.3); font-family: 'Nunito', sans-serif;
    display: flex; align-items: center; gap: 8px;
  }
  .print-btn:hover { background: #162d58; }
`

/* ─── Render HTML complet ────────────────────────────────────────────────── */
function renderHtml(title: string, subtitle: string, body: string): string {
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — SEN'EAU BI</title>
  <style>${CSS}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">
    🖨 Enregistrer en PDF
  </button>

  <div class="page">
    <div class="report-header">
      <div class="logo-area">
        <div class="logo-box">📊</div>
        <div>
          <h1>${title}</h1>
          <div class="sub">${subtitle}</div>
        </div>
      </div>
      <div class="meta">
        Généré le ${now}<br />
        SEN'EAU · Portail BI Self-Service<br />
        <strong style="color: rgba(150,193,30,.9)">Données officielles · mv_recouvrement</strong>
      </div>
    </div>

    ${body}

    <div class="report-footer">
      <span>SEN'EAU — Sénégalaise Des Eaux</span>
      <span>${title} · ${now}</span>
      <span>Portail BI — Données certifiées</span>
    </div>
  </div>
</body>
</html>`
}

/* ═══════════════════════════════════════════════════════════════════════════
   POINTS D'ATTENTION — moteur d'alertes automatique
   Seuils métier SEN'EAU codés en dur, zéro IA.
════════════════════════════════════════════════════════════════════════════ */

/* Seuils de référence */
const SEUIL = {
  TAUX_OBJECTIF:      98.5,   // % taux recouvrement cible
  TAUX_CRITIQUE:      90,     // % en dessous = critique
  TAUX_WARNING:       95,     // % en dessous = avertissement
  IMPAYE_RATIO:       10,     // % du CA → alerte si impayés > 10 % du CA
  IMPAYE_HAUSSE:      5,      // % de hausse vs N-1 → alerte
  AGING_JS90_RATIO:   10,     // % du CA en créances >90j → alerte
  HS_RATIO:           2.5,    // % masse salariale en HS → alerte (objectif SEN'EAU)
  FORMATION_MIN_PCT:  50,     // % collaborateurs formés minimum
  TAUX_FEM_MIN:       20,     // % taux féminisation minimum
}

type Niveau = 'critique' | 'warning' | 'info'
interface Alerte {
  niveau:  Niveau
  label:   string
  detail:  string
  valeur?: string
}

const ICONE: Record<Niveau, string> = {
  critique: '🔴',
  warning:  '🟠',
  info:     '🔵',
}

function renderAlertes(alertes: Alerte[]): string {
  if (alertes.length === 0) return ''

  const nb_critique = alertes.filter(a => a.niveau === 'critique').length
  const nb_warning  = alertes.filter(a => a.niveau === 'warning').length
  const nb_info     = alertes.filter(a => a.niveau === 'info').length

  const items = alertes.map(a => `
    <div class="alerte-item">
      <div class="ai-icon ${a.niveau}">${ICONE[a.niveau]}</div>
      <div class="ai-body">
        <div class="ai-label ${a.niveau}">${a.label}</div>
        <div class="ai-detail">${a.detail}</div>
      </div>
      ${a.valeur ? `<div class="ai-val ${a.niveau}">${a.valeur}</div>` : ''}
    </div>`).join('')

  const bilan = [
    nb_critique > 0 ? `<span class="bilan-pill critique">${nb_critique} critique${nb_critique > 1 ? 's' : ''}</span>` : '',
    nb_warning  > 0 ? `<span class="bilan-pill warning">${nb_warning} avertissement${nb_warning > 1 ? 's' : ''}</span>` : '',
    nb_info     > 0 ? `<span class="bilan-pill ok">${nb_info} info${nb_info > 1 ? 's' : ''}</span>` : '',
  ].filter(Boolean).join('')

  return `
  <div class="alertes-block">
    <div class="alertes-header">
      <span class="ah-icon">⚠</span>
      <span class="ah-title">Points d'attention</span>
      <span class="ah-count">${alertes.length} alerte${alertes.length > 1 ? 's' : ''}</span>
    </div>
    <div class="alertes-list">${items}</div>
    <div class="alertes-bilan">${bilan}</div>
  </div>`
}

/* ── Alertes Recouvrement / Facturation (logique commune) ─────────────────── */
function computeAlertesRecouvrement(
  rapports: Record<string, unknown>,
  impayes:  Record<string, unknown>,
  aging:    Record<string, unknown>,
  prevLabel: string | null,
): Alerte[] {
  const alertes: Alerte[] = []
  const k    = (rapports.kpis  ?? {}) as Record<string, number>
  const prev = (rapports.kpis_prev ?? null) as Record<string, number> | null

  const ca   = Number(k.ca_total    ?? 0)
  const enc  = Number(k.encaissement ?? 0)
  const imp  = Number(k.impaye       ?? 0)
  const taux = ca > 0 ? Math.round(enc / ca * 1000) / 10 : 0

  /* 1 — Taux de recouvrement global */
  if (taux < SEUIL.TAUX_CRITIQUE) {
    alertes.push({
      niveau: 'critique',
      label:  'Taux de recouvrement critique',
      detail: `Le taux global est bien en dessous de l'objectif de ${SEUIL.TAUX_OBJECTIF} %. Une intervention immédiate sur les impayés est nécessaire.`,
      valeur: `${taux} %`,
    })
  } else if (taux < SEUIL.TAUX_WARNING) {
    alertes.push({
      niveau: 'warning',
      label:  'Taux de recouvrement sous la cible',
      detail: `Le taux global est en dessous de l'objectif de ${SEUIL.TAUX_OBJECTIF} %. Un suivi renforcé est recommandé.`,
      valeur: `${taux} %`,
    })
  }

  /* 2 — Ratio impayés / CA */
  if (ca > 0) {
    const ratioImp = Math.round(imp / ca * 1000) / 10
    if (ratioImp > SEUIL.IMPAYE_RATIO) {
      alertes.push({
        niveau: ratioImp > 20 ? 'critique' : 'warning',
        label:  'Impayés élevés par rapport au CA',
        detail: `Les impayés représentent ${ratioImp} % du chiffre d'affaires facturé (seuil : ${SEUIL.IMPAYE_RATIO} %).`,
        valeur: `${fmt(imp)} FCFA`,
      })
    }
  }

  /* 3 — Hausse des impayés vs N-1 */
  if (prev && Number(prev.impaye ?? 0) > 0) {
    const impPrev  = Number(prev.impaye)
    const hausse   = Math.round((imp - impPrev) / impPrev * 1000) / 10
    if (hausse > SEUIL.IMPAYE_HAUSSE) {
      alertes.push({
        niveau: hausse > 20 ? 'critique' : 'warning',
        label:  `Hausse des impayés vs ${prevLabel ?? 'N-1'}`,
        detail: `Les impayés ont progressé de ${hausse} % par rapport à la période précédente.`,
        valeur: `+${hausse} %`,
      })
    }
  }

  /* 4 — DT sous l'objectif */
  const parDr = Array.isArray(rapports.par_dr) ? rapports.par_dr as Record<string, unknown>[] : []
  const dtsCritiques = parDr.filter(r => {
    const t = Number(r.ca_total ?? 0) > 0
      ? Math.round(Number(r.encaissement ?? 0) / Number(r.ca_total) * 1000) / 10
      : 0
    return t < SEUIL.TAUX_CRITIQUE
  })
  const dtsWarning = parDr.filter(r => {
    const t = Number(r.ca_total ?? 0) > 0
      ? Math.round(Number(r.encaissement ?? 0) / Number(r.ca_total) * 1000) / 10
      : 0
    return t >= SEUIL.TAUX_CRITIQUE && t < SEUIL.TAUX_WARNING
  })

  if (dtsCritiques.length > 0) {
    alertes.push({
      niveau: 'critique',
      label:  `${dtsCritiques.length} Direction${dtsCritiques.length > 1 ? 's' : ''} Territoriale${dtsCritiques.length > 1 ? 's' : ''} en zone critique`,
      detail: dtsCritiques.map(r => {
        const t = Number(r.ca_total ?? 0) > 0
          ? Math.round(Number(r.encaissement ?? 0) / Number(r.ca_total) * 1000) / 10 : 0
        return `${r.dr ?? '—'} : ${t} %`
      }).join(' · '),
      valeur: `< ${SEUIL.TAUX_CRITIQUE} %`,
    })
  }
  if (dtsWarning.length > 0) {
    alertes.push({
      niveau: 'warning',
      label:  `${dtsWarning.length} Direction${dtsWarning.length > 1 ? 's' : ''} Territoriale${dtsWarning.length > 1 ? 's' : ''} sous l'objectif`,
      detail: dtsWarning.map(r => {
        const t = Number(r.ca_total ?? 0) > 0
          ? Math.round(Number(r.encaissement ?? 0) / Number(r.ca_total) * 1000) / 10 : 0
        return `${r.dr ?? '—'} : ${t} %`
      }).join(' · '),
      valeur: `< ${SEUIL.TAUX_WARNING} %`,
    })
  }

  /* 5 — Créances > 90j */
  if (aging && ca > 0) {
    const globalAging = Array.isArray(aging.global) ? (aging.global[0] ?? {}) : (aging.global ?? {})
    const js90 = Number((globalAging as Record<string, unknown>).a_js90 ?? (globalAging as Record<string, unknown>).ajs90 ?? 0)
    const ratioJs90 = Math.round(js90 / ca * 1000) / 10
    if (ratioJs90 > SEUIL.AGING_JS90_RATIO) {
      alertes.push({
        niveau: ratioJs90 > 25 ? 'critique' : 'warning',
        label:  'Créances très anciennes (> 90 jours)',
        detail: `Les créances de plus de 90 jours représentent ${ratioJs90} % du CA (seuil : ${SEUIL.AGING_JS90_RATIO} %). Risque de passage en irrécouvrables.`,
        valeur: `${fmt(js90)} FCFA`,
      })
    }
  }

  /* 6 — Impayés par DR depuis endpoint impayes */
  if (impayes && ca > 0) {
    const globalImp = (impayes.global ?? {}) as Record<string, number>
    const tauxImpGlobal = Number(globalImp.taux_impaye ?? 0)
    if (tauxImpGlobal > 15) {
      alertes.push({
        niveau: 'info',
        label:  'Taux d\'impayé global élevé',
        detail: `Le taux d'impayé global est de ${tauxImpGlobal} % — au-delà du seuil de vigilance de 15 %.`,
        valeur: `${tauxImpGlobal} %`,
      })
    }
  }

  return alertes
}

/* ── Alertes RH ──────────────────────────────────────────────────────────── */
function computeAlertesRH(kpis: Record<string, number>): Alerte[] {
  const alertes: Alerte[] = []

  /* 1 — Taux HS / Masse */
  const tauxHs = Number(kpis.taux_hs ?? 0)
  if (tauxHs >= SEUIL.HS_RATIO) {
    alertes.push({
      niveau: tauxHs > 5 ? 'critique' : 'warning',
      label:  'Heures supplémentaires au-dessus de l\'objectif',
      detail: `Le montant des HS représente ${tauxHs} % de la masse salariale (objectif SEN'EAU : ${SEUIL.HS_RATIO} %). Risque de surcharge et coût RH en hausse.`,
      valeur: `${tauxHs} %`,
    })
  }

  /* 2 — Taux de formation */
  const pctFormes = Number(kpis.pct_formes ?? 0)
  if (pctFormes < SEUIL.FORMATION_MIN_PCT) {
    alertes.push({
      niveau: pctFormes < 25 ? 'critique' : 'warning',
      label:  'Couverture de formation insuffisante',
      detail: `Seulement ${pctFormes} % des collaborateurs ont été formés (objectif : ${SEUIL.FORMATION_MIN_PCT} %). Le plan de formation doit être renforcé.`,
      valeur: `${pctFormes} %`,
    })
  }

  /* 3 — Taux de féminisation */
  const tauxFem = Number(kpis.taux_feminisation ?? 0)
  if (tauxFem < SEUIL.TAUX_FEM_MIN) {
    alertes.push({
      niveau: 'info',
      label:  'Taux de féminisation sous l\'objectif',
      detail: `Le taux de féminisation est de ${tauxFem} % (cible minimale : ${SEUIL.TAUX_FEM_MIN} %). Un effort de recrutement féminin est à envisager.`,
      valeur: `${tauxFem} %`,
    })
  }

  /* 4 — Aucun salarié */
  const nbSalaries = Number(kpis.nb_salaries ?? 0)
  if (nbSalaries === 0) {
    alertes.push({
      niveau: 'info',
      label:  'Aucun effectif sur la période',
      detail: 'Aucun salarié trouvé pour les filtres sélectionnés. Vérifiez les paramètres de période ou de direction.',
    })
  }

  return alertes
}

/* ─── Section HTML helpers ───────────────────────────────────────────────── */
function section(title: string, content: string): string {
  return `<div class="section">
    <div class="section-title"><span class="dot"></span>${title}</div>
    ${content}
  </div>`
}

function kpiGrid(cards: { label: string; value: string; prev?: string; color?: 'green' | 'red' | '' }[]): string {
  return `<div class="kpi-grid">
    ${cards.map(c => `
      <div class="kpi-card">
        <div class="val ${c.color ?? ''}">${c.value}</div>
        <div class="lbl">${c.label}</div>
        ${c.prev ? `<div class="prev">Préc. : ${c.prev}</div>` : ''}
      </div>`).join('')}
  </div>`
}

function table(headers: string[], rows: (string | number)[][], rightCols?: number[]): string {
  const rCols = rightCols ?? []
  return `<table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${row.map((cell, ci) => {
        const isRight = rCols.includes(ci)
        // Detect pct columns to colorize
        const str = String(cell)
        const isPct = isRight && str.includes('%')
        const numVal = isPct ? parseFloat(str.replace(',', '.')) : 0
        const pctClass = isPct ? (numVal >= 98.5 ? 'pct ok' : numVal >= 90 ? 'pct' : 'pct bad') : ''
        return `<td class="${isRight ? (pctClass || 'num') : ''}">${cell}</td>`
      }).join('')}</tr>`).join('')}
    </tbody>
  </table>`
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUILDERS RECOUVREMENT
════════════════════════════════════════════════════════════════════════════ */
async function buildRecouvrementHtml(filtres: Record<string, string>, baseUrl: string): Promise<string> {
  const indList = filtres.indicateurs
    ? filtres.indicateurs.split(',').map(s => s.trim()).filter(Boolean)
    : ['kpis', 'par_dt', 'par_bimestre', 'impayes', 'aging']
  const has = (id: string) => indList.includes(id)
  const qs = buildQs(filtres, ['indicateurs'])

  const [rapports, impayes, aging] = await Promise.all([
    (has('kpis') || has('par_dt') || has('par_bimestre'))
      ? fetch(`${baseUrl}/api/rapports?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    has('impayes')
      ? fetch(`${baseUrl}/api/rapports/impayes?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    has('aging')
      ? fetch(`${baseUrl}/api/rapports/reglements?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
  ])

  /* ── Points d'attention (calculés sur toutes les données disponibles) ── */
  const alertesHtml = renderAlertes(
    computeAlertesRecouvrement(rapports, impayes, aging, rapports.prev_label as string | null)
  )

  let html = alertesHtml
  const dateLabel = `Année : ${filtres.annee ?? 'Toutes années'}`

  /* ── KPIs ── */
  if (has('kpis')) {
    const k = rapports.kpis ?? {}
    const p = rapports.kpis_prev ?? null
    const taux = Number(k.taux_recouvrement ?? 0)
    html += section('KPIs Synthèse — Recouvrement', `
      <div class="objectif-bar">
        ✅ Objectif taux de recouvrement : <strong>98,5 %</strong>
        &nbsp;·&nbsp; Taux actuel :
        <strong style="color: ${taux >= 98.5 ? '#059669' : taux >= 90 ? '#D97706' : '#DC2626'}">${taux} %</strong>
      </div>
      ${kpiGrid([
        { label: 'CA Facturé (FCFA)',      value: fmt(k.ca_total),      prev: p ? fmt(p.ca_total) : undefined },
        { label: 'Encaissement (FCFA)',    value: fmt(k.encaissement),  prev: p ? fmt(p.encaissement) : undefined },
        { label: 'Impayés (FCFA)',         value: fmt(k.impaye),        prev: p ? fmt(p.impaye) : undefined, color: 'red' },
        { label: 'Taux recouvrement',      value: `${taux} %`,          color: taux >= 98.5 ? 'green' : 'red' },
        { label: 'Nombre de factures',     value: fmt(k.nb_factures) },
        { label: 'Directions Territoriales', value: fmt(k.nb_dr) },
      ])}
    `)
  }

  /* ── Par DT ── */
  if (has('par_dt') && Array.isArray(rapports.par_dr) && rapports.par_dr.length > 0) {
    html += section('Recouvrement par Direction Territoriale', table(
      ['Direction', 'CA (FCFA)', 'Encaissé (FCFA)', 'Impayés (FCFA)', 'Taux recouvrement', 'Nb factures'],
      rapports.par_dr.map((r: Record<string, unknown>) => [
        String(r.dr ?? ''),
        fmt(r.ca_total), fmt(r.encaissement), fmt(r.impaye),
        pct(Number(r.encaissement), Number(r.ca_total)),
        fmt(r.nb_factures),
      ]),
      [1, 2, 3, 4, 5],
    ))
  }

  /* ── Par bimestre ── */
  if (has('par_bimestre') && Array.isArray(rapports.par_bimestre) && rapports.par_bimestre.length > 0) {
    html += section('Évolution par Bimestre', `
      <p style="font-size:11px;color:rgba(31,59,114,.4);margin-bottom:10px;">${dateLabel}</p>
      ${table(
        ['Bimestre', 'Année', 'CA (FCFA)', 'Encaissé (FCFA)', 'Taux recouvrement'],
        rapports.par_bimestre.map((r: Record<string, unknown>) => [
          `B${r.bimestre}`, String(r.annee),
          fmt(r.ca_total), fmt(r.encaissement),
          pct(Number(r.encaissement), Number(r.ca_total)),
        ]),
        [2, 3, 4],
      )}
    `)
  }

  /* ── Impayés ── */
  if (has('impayes')) {
    const byDr     = Array.isArray(impayes.par_dr)     ? impayes.par_dr     : []
    const byStatut = Array.isArray(impayes.par_statut) ? impayes.par_statut : []
    html += section('Analyse des Impayés', `
      ${byDr.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin-bottom:8px;">Par Direction Territoriale</p>
        ${table(
          ['Direction', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb factures'],
          byDr.map((r: Record<string, unknown>) => [
            String(r.label ?? r.dr ?? ''), fmt(r.ca_total ?? r.ca), fmt(r.impaye_total ?? r.imp), fmt(r.nb_factures ?? r.nb),
          ]),
          [1, 2, 3],
        )}` : ''}
      ${byStatut.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin:14px 0 8px;">Par Statut Facture</p>
        ${table(
          ['Statut', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb'],
          byStatut.map((r: Record<string, unknown>) => [
            String(r.label ?? r.statut ?? ''), fmt(r.ca_total ?? r.ca), fmt(r.impaye_total ?? r.imp), fmt(r.nb_factures ?? r.nb),
          ]),
          [1, 2, 3],
        )}` : ''}
    `)
  }

  /* ── Aging ── */
  if (has('aging')) {
    const global = Array.isArray(aging.global) ? (aging.global[0] ?? {}) : (aging.global ?? {})
    const byDr   = Array.isArray(aging.par_dr) ? aging.par_dr : []
    const agingRow = (label: string, r: Record<string, unknown>) => [
      label, fmt(r.a_j ?? r.aj), fmt(r.a_jp15 ?? r.aj15), fmt(r.a_jp30 ?? r.aj30),
      fmt(r.a_jp45 ?? r.aj45), fmt(r.a_jp60 ?? r.aj60),
      fmt(r.a_jp75 ?? r.aj75), fmt(r.a_jp90 ?? r.aj90), fmt(r.a_js90 ?? r.ajs90),
    ]
    html += section('Aging des Créances (FCFA)', table(
      ['DT / Global', 'J', 'J+15', 'J+30', 'J+45', 'J+60', 'J+75', 'J+90', '>90j'],
      [agingRow('TOTAL', global), ...byDr.map((r: Record<string, unknown>) => agingRow(String(r.dr ?? r.lbl ?? '—'), r))],
      [1, 2, 3, 4, 5, 6, 7, 8],
    ))
  }

  return html
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUILDERS RH
════════════════════════════════════════════════════════════════════════════ */
async function buildRhHtml(filtres: Record<string, string>, baseUrl: string): Promise<string> {
  const indList = filtres.indicateurs
    ? filtres.indicateurs.split(',').map(s => s.trim()).filter(Boolean)
    : ['kpis', 'masse', 'effectif', 'hs', 'formation', 'anciennete']
  const has = (id: string) => indList.includes(id)
  const qs  = buildQs(filtres, ['indicateurs'])

  const [kpis, evol, details] = await Promise.all([
    has('kpis')
      ? fetch(`${baseUrl}/api/rh/kpis?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    has('masse')
      ? fetch(`${baseUrl}/api/rh/evolution?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    (has('effectif') || has('hs') || has('formation') || has('anciennete'))
      ? fetch(`${baseUrl}/api/rh/details?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
  ])

  /* ── Points d'attention RH ── */
  const alertesHtml = has('kpis')
    ? renderAlertes(computeAlertesRH(kpis as Record<string, number>))
    : ''

  let html = alertesHtml

  /* ── KPIs RH ── */
  if (has('kpis')) {
    html += section('KPIs Ressources Humaines', kpiGrid([
      { label: 'Effectif total',          value: fmt(kpis.nb_salaries) },
      { label: 'dont Femmes',             value: fmt(kpis.nb_femmes) },
      { label: 'Taux féminisation',       value: `${kpis.taux_feminisation ?? 0} %` },
      { label: 'Masse salariale (FCFA)',  value: fmt(kpis.masse_salariale) },
      { label: 'Salaire moyen (FCFA)',    value: fmt(kpis.salaire_moyen) },
      { label: 'Montant HS (FCFA)',       value: fmt(kpis.montant_hs), color: 'red' },
      { label: 'Taux HS / Masse',         value: `${kpis.taux_hs ?? 0} %` },
      { label: 'Heures formation',        value: fmt(kpis.nb_heures_formation) },
      { label: 'Collaborateurs formés',   value: fmt(kpis.nb_collaborateurs_formes) },
      { label: '% formés',               value: `${kpis.pct_formes ?? 0} %`, color: 'green' },
    ]))
  }

  /* ── Masse mensuelle ── */
  if (has('masse') && Array.isArray(evol.mensuel) && evol.mensuel.length > 0) {
    html += section('Masse Salariale Mensuelle', table(
      ['Mois', 'Masse N (FCFA)', 'Masse N-1 (FCFA)', 'Cumul N (FCFA)', 'Montant HS (FCFA)'],
      evol.mensuel.map((r: Record<string, unknown>) => [
        String(r.label ?? ''), fmt(r.masse), fmt(r.masse_n1), fmt(r.masse_cumul), fmt(r.montant_hs),
      ]),
      [1, 2, 3, 4],
    ))
  }

  /* ── Effectif ── */
  if (has('effectif')) {
    const byEta  = Array.isArray(details.effectif_par_eta)           ? details.effectif_par_eta           : []
    const byQual = Array.isArray(details.effectif_par_qualification) ? details.effectif_par_qualification : []
    html += section('Effectif & Structure', `
      ${byEta.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin-bottom:8px;">Par Établissement</p>
        ${table(['Établissement', 'Effectif'], byEta.map((r: Record<string, unknown>) => [String(r.etablissement ?? ''), fmt(r.effectif)]), [1])}
      ` : ''}
      ${byQual.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin:14px 0 8px;">Par Qualification</p>
        ${table(['Qualification', 'Effectif'], byQual.map((r: Record<string, unknown>) => [String(r.qualification ?? ''), fmt(r.effectif)]), [1])}
      ` : ''}
    `)
  }

  /* ── HS ── */
  if (has('hs')) {
    const byEta = Array.isArray(details.hs_par_eta)     ? details.hs_par_eta     : []
    const byRub = Array.isArray(details.hs_par_rubrique) ? details.hs_par_rubrique : []
    html += section('Heures Supplémentaires', `
      ${byEta.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin-bottom:8px;">Par Établissement</p>
        ${table(
          ['Établissement', 'Montant HS (FCFA)', 'Nb heures', 'Nb collaborateurs'],
          byEta.map((r: Record<string, unknown>) => [String(r.etablissement ?? ''), fmt(r.montant), fmt(r.nb_heures), fmt(r.nb_collab)]),
          [1, 2, 3],
        )}
      ` : ''}
      ${byRub.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin:14px 0 8px;">Par Rubrique</p>
        ${table(
          ['Rubrique', 'Montant (FCFA)', 'Nb collaborateurs'],
          byRub.map((r: Record<string, unknown>) => [String(r.rubrique ?? ''), fmt(r.montant), fmt(r.nb_collab)]),
          [1, 2],
        )}
      ` : ''}
    `)
  }

  /* ── Formation ── */
  if (has('formation')) {
    const byTheme = Array.isArray(details.formation_par_theme) ? details.formation_par_theme : []
    const byEta   = Array.isArray(details.formation_par_eta)   ? details.formation_par_eta   : []
    html += section('Plan de Formation', `
      ${byTheme.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin-bottom:8px;">Par Thème</p>
        ${table(['Thème', 'Heures', 'Nb collaborateurs'], byTheme.map((r: Record<string, unknown>) => [String(r.theme ?? ''), fmt(r.heures), fmt(r.nb_collab)]), [1, 2])}
      ` : ''}
      ${byEta.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin:14px 0 8px;">Par Établissement</p>
        ${table(['Établissement', 'Heures', 'Nb collaborateurs'], byEta.map((r: Record<string, unknown>) => [String(r.etablissement ?? ''), fmt(r.heures), fmt(r.nb_collab)]), [1, 2])}
      ` : ''}
    `)
  }

  /* ── Ancienneté ── */
  if (has('anciennete')) {
    const rows = Array.isArray(details.anciennete_feminisation) ? details.anciennete_feminisation : []
    if (rows.length > 0) {
      html += section('Ancienneté & Féminisation', table(
        ['Tranche ancienneté', 'Effectif total', 'dont Femmes', 'Taux féminisation'],
        rows.map((r: Record<string, unknown>) => [
          String(r.tranche ?? ''), fmt(r.nb_total), fmt(r.nb_femmes), `${r.taux_feminisation ?? 0} %`,
        ]),
        [1, 2, 3],
      ))
    }
  }

  return html
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUILDERS FACTURATION
════════════════════════════════════════════════════════════════════════════ */
async function buildFacturationHtml(filtres: Record<string, string>, baseUrl: string): Promise<string> {
  const indList = filtres.indicateurs
    ? filtres.indicateurs.split(',').map(s => s.trim()).filter(Boolean)
    : ['kpis', 'par_dt', 'par_bimestre', 'impayes', 'aging', 'ca_detail', 'matrice']
  const has = (id: string) => indList.includes(id)
  const qs  = buildQs(filtres, ['indicateurs'])

  const [rapports, impayes, aging, caDetail, matrice] = await Promise.all([
    (has('kpis') || has('par_dt') || has('par_bimestre'))
      ? fetch(`${baseUrl}/api/rapports?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    has('impayes')
      ? fetch(`${baseUrl}/api/rapports/impayes?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    has('aging')
      ? fetch(`${baseUrl}/api/rapports/reglements?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    has('ca_detail')
      ? fetch(`${baseUrl}/api/rapports/ca?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    has('matrice')
      ? fetch(`${baseUrl}/api/rapports/matrice?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
  ])

  /* ── Points d'attention Facturation ── */
  const alertesHtml = renderAlertes(
    computeAlertesRecouvrement(rapports, impayes, aging, rapports.prev_label as string | null)
  )

  let html = alertesHtml

  /* ── KPIs ── */
  if (has('kpis')) {
    const k = rapports.kpis ?? {}
    const p = rapports.kpis_prev ?? null
    const taux = Number(k.taux_recouvrement ?? 0)
    html += section('KPIs Synthèse — Facturation', `
      <div class="objectif-bar">
        ✅ Objectif taux de recouvrement : <strong>98,5 %</strong>
        &nbsp;·&nbsp; Taux actuel :
        <strong style="color: ${taux >= 98.5 ? '#059669' : taux >= 90 ? '#D97706' : '#DC2626'}">${taux} %</strong>
      </div>
      ${kpiGrid([
        { label: 'CA Facturé (FCFA)',        value: fmt(k.ca_total),      prev: p ? fmt(p.ca_total)      : undefined },
        { label: 'Encaissement (FCFA)',      value: fmt(k.encaissement),  prev: p ? fmt(p.encaissement)  : undefined },
        { label: 'Impayés (FCFA)',           value: fmt(k.impaye),        prev: p ? fmt(p.impaye)        : undefined, color: 'red' },
        { label: 'Taux recouvrement',        value: `${taux} %`,          color: taux >= 98.5 ? 'green' : 'red' },
        { label: 'Nombre de factures',       value: fmt(k.nb_factures),   prev: p ? fmt(p.nb_factures)   : undefined },
        { label: 'Nb Directions Territoriales', value: fmt(k.nb_dr) },
      ])}
    `)
  }

  /* ── Par DT ── */
  if (has('par_dt') && Array.isArray(rapports.par_dr) && rapports.par_dr.length > 0) {
    html += section('Recouvrement par Direction Territoriale', table(
      ['Direction', 'CA (FCFA)', 'Encaissé (FCFA)', 'Impayés (FCFA)', 'Taux recouvrement', 'Nb factures'],
      rapports.par_dr.map((r: Record<string, unknown>) => [
        String(r.dr ?? ''), fmt(r.ca_total), fmt(r.encaissement), fmt(r.impaye),
        pct(Number(r.encaissement), Number(r.ca_total)), fmt(r.nb_factures),
      ]),
      [1, 2, 3, 4, 5],
    ))
  }

  /* ── Par bimestre ── */
  if (has('par_bimestre') && Array.isArray(rapports.par_bimestre) && rapports.par_bimestre.length > 0) {
    html += section('Évolution par Bimestre', table(
      ['Bimestre', 'Année', 'CA (FCFA)', 'Encaissé (FCFA)', 'Taux recouvrement'],
      rapports.par_bimestre.map((r: Record<string, unknown>) => [
        `B${r.bimestre}`, String(r.annee), fmt(r.ca_total), fmt(r.encaissement),
        pct(Number(r.encaissement), Number(r.ca_total)),
      ]),
      [2, 3, 4],
    ))
  }

  /* ── Impayés ── */
  if (has('impayes')) {
    const byDr     = Array.isArray(impayes.par_dr)     ? impayes.par_dr     : []
    const byStatut = Array.isArray(impayes.par_statut) ? impayes.par_statut : []
    const byGroupe = Array.isArray(impayes.par_groupe) ? impayes.par_groupe : []
    html += section('Analyse des Impayés', `
      ${byDr.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin-bottom:8px;">Par Direction Territoriale</p>
        ${table(['Direction', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb'], byDr.map((r: Record<string, unknown>) => [String(r.label ?? r.dr ?? ''), fmt(r.ca_total ?? r.ca), fmt(r.impaye_total ?? r.imp), fmt(r.nb_factures ?? r.nb)]), [1, 2, 3])}
      ` : ''}
      ${byStatut.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin:14px 0 8px;">Par Statut Facture</p>
        ${table(['Statut', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb'], byStatut.map((r: Record<string, unknown>) => [String(r.label ?? r.statut ?? ''), fmt(r.ca_total ?? r.ca), fmt(r.impaye_total ?? r.imp), fmt(r.nb_factures ?? r.nb)]), [1, 2, 3])}
      ` : ''}
      ${byGroupe.length > 0 ? `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin:14px 0 8px;">Par Groupe Facturation</p>
        ${table(['Groupe', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb'], byGroupe.map((r: Record<string, unknown>) => [String(r.label ?? r.groupe ?? ''), fmt(r.ca_total ?? r.ca), fmt(r.impaye_total ?? r.imp), fmt(r.nb_factures ?? r.nb)]), [1, 2, 3])}
      ` : ''}
    `)
  }

  /* ── Aging ── */
  if (has('aging')) {
    const global = Array.isArray(aging.global) ? (aging.global[0] ?? {}) : (aging.global ?? {})
    const byDr   = Array.isArray(aging.par_dr) ? aging.par_dr : []
    const agingRow = (label: string, r: Record<string, unknown>) => [
      label, fmt(r.a_j ?? r.aj), fmt(r.a_jp15 ?? r.aj15), fmt(r.a_jp30 ?? r.aj30),
      fmt(r.a_jp45 ?? r.aj45), fmt(r.a_jp60 ?? r.aj60),
      fmt(r.a_jp75 ?? r.aj75), fmt(r.a_jp90 ?? r.aj90), fmt(r.a_js90 ?? r.ajs90),
    ]
    html += section('Aging des Créances (FCFA)', table(
      ['DT / Global', 'J', 'J+15', 'J+30', 'J+45', 'J+60', 'J+75', 'J+90', '>90j'],
      [agingRow('TOTAL', global), ...byDr.map((r: Record<string, unknown>) => agingRow(String(r.dr ?? r.lbl ?? '—'), r))],
      [1, 2, 3, 4, 5, 6, 7, 8],
    ))
  }

  /* ── Détail CA ── */
  if (has('ca_detail')) {
    const dims: [string, string][] = [
      ['groupe', 'Par Groupe Facturation'],
      ['type', 'Par Type Facture'],
      ['branchement', 'Par Catégorie Branchement'],
      ['dr', 'Par Direction Territoriale'],
    ]
    let caHtml = ''
    for (const [dim, label] of dims) {
      const rows: Record<string, unknown>[] = Array.isArray(caDetail[dim]) ? caDetail[dim] : []
      if (rows.length === 0) continue
      caHtml += `
        <p style="font-size:10px;font-weight:700;color:rgba(31,59,114,.5);text-transform:uppercase;margin:${caHtml ? 14 : 0}px 0 8px;">${label}</p>
        ${table([label, 'CA (FCFA)', 'Encaissé (FCFA)', 'Impayés (FCFA)', 'Nb'], rows.map(r => [String(r.lbl ?? '—'), fmt(r.ca), fmt(r.enc), fmt(r.imp), fmt(r.nb)]), [1, 2, 3, 4])}
      `
    }
    if (caHtml) html += section('Détail du Chiffre d\'Affaires', caHtml)
  }

  /* ── Matrice DR × UO ── */
  if (has('matrice') && Array.isArray(matrice.lignes) && matrice.lignes.length > 0) {
    const cols: string[] = Array.isArray(matrice.colonnes) ? matrice.colonnes : []
    const rightIdx = cols.map((_, i) => i + 2)
    html += section('Matrice DR × UO × Bimestres — Taux recouvrement', table(
      ['Direction', 'UO', ...cols],
      matrice.lignes.map((r: Record<string, unknown>) => [
        String(r.dr ?? ''), String(r.uo ?? 'TOTAL DR'),
        ...cols.map(c => r[c] != null ? `${r[c]} %` : '—'),
      ]),
      rightIdx,
    ))
  }

  return html
}

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLER POST
════════════════════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rapport_id, filtres = {} } = body as { rapport_id: string; filtres: Record<string, string> }

    const baseUrl = req.nextUrl.origin

    const LABELS: Record<string, string> = {
      recouvrement: "Recouvrement & Facturation",
      rh:           "Ressources Humaines",
      facturation:  "Facturation",
    }

    let bodyHtml = ''
    const title    = LABELS[rapport_id] ?? rapport_id
    const dateStr  = filtres.annee ? `Année ${filtres.annee}` : 'Toutes années'
    const drStr    = filtres.dr    ? ` · DR : ${filtres.dr}`  : ''
    const subtitle = `${dateStr}${drStr}`

    if (rapport_id === 'recouvrement') bodyHtml = await buildRecouvrementHtml(filtres, baseUrl)
    else if (rapport_id === 'rh')      bodyHtml = await buildRhHtml(filtres, baseUrl)
    else if (rapport_id === 'facturation') bodyHtml = await buildFacturationHtml(filtres, baseUrl)
    else return NextResponse.json({ error: 'rapport_id invalide' }, { status: 400 })

    if (!bodyHtml) {
      return NextResponse.json({ error: 'Aucune donnée disponible pour cette sélection.' }, { status: 404 })
    }

    const html = renderHtml(title, subtitle, bodyHtml)
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rapports/generate]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
