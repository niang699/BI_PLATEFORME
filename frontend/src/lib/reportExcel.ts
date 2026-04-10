/**
 * Générateur de rapports Excel (exceljs)
 * Chaque rapport récupère les données depuis les APIs internes
 * et produit un Buffer xlsx prêt à attacher dans un email.
 */
import ExcelJS from 'exceljs'
import type { ReportId } from './schedulerDb'

/* ─── Palette SEN'EAU ────────────────────────────────────────────────────── */
const PRIMARY   = '1F3B72'
const SECONDARY = '96C11E'
const LIGHT_BG  = 'EEF2FF'
const GRAY      = 'F8FAFC'

/* ─── Helpers URL ───────────────────────────────────────────────────────── */
/**
 * Construit une query-string depuis filtres en gérant les champs multi-valeurs
 * (groupe_facturation, cat_branchement) stockés comme "val1,val2" dans filtres.
 */
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

/* ─── Helpers style ─────────────────────────────────────────────────────── */
function headerStyle(wb: ExcelJS.Workbook, bgHex: string): Partial<ExcelJS.Style> {
  void wb
  return {
    font:      { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgHex } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    },
  }
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, nbCols: number) {
  ws.mergeCells(1, 1, 1, nbCols)
  const t = ws.getCell('A1')
  t.value = title
  t.font  = { bold: true, size: 14, color: { argb: 'FF' + PRIMARY } }
  t.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + LIGHT_BG } }
  t.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 28

  ws.mergeCells(2, 1, 2, nbCols)
  const s = ws.getCell('A2')
  s.value = subtitle
  s.font  = { size: 9, color: { argb: 'FF888888' } }
  s.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + LIGHT_BG } }
  s.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

  ws.getRow(3).height = 4
}

/* ═══════════════════════════════════════════════════════════════════════════
   RAPPORT RECOUVREMENT
════════════════════════════════════════════════════════════════════════════ */
async function buildRecouvrement(
  wb: ExcelJS.Workbook,
  filtres: Record<string, string>,
  baseUrl: string,
) {
  const indList: string[] = filtres.indicateurs
    ? filtres.indicateurs.split(',').map(s => s.trim()).filter(Boolean)
    : ['kpis', 'par_dt', 'par_bimestre', 'impayes', 'aging']

  const has = (id: string) => indList.includes(id)
  const qs  = buildQs(filtres, ['indicateurs'])
  const dateLabel = `Année : ${filtres.annee ?? 'Toutes années'} · Généré le ${new Date().toLocaleDateString('fr-FR')}`
  const pct = (enc: number, ca: number) => ca > 0 ? `${(Math.round(enc / ca * 1000) / 10).toLocaleString('fr-FR')}%` : '—'

  const needsRapports = has('kpis') || has('par_dt') || has('par_bimestre')
  const needsImpayes  = has('impayes')
  const needsAging    = has('aging')

  const [rapportRes, impayes, aging] = await Promise.all([
    needsRapports ? fetch(`${baseUrl}/api/rapports?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
    needsImpayes  ? fetch(`${baseUrl}/api/rapports/impayes?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
    needsAging    ? fetch(`${baseUrl}/api/rapports/reglements?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
  ])

  /* ── KPIs synthèse ── */
  if (has('kpis')) {
    const k = rapportRes.kpis ?? {}
    const p = rapportRes.kpis_prev ?? null
    const ws = wb.addWorksheet('KPIs Recouvrement')
    ws.columns = [{ width: 36 }, { width: 24 }, { width: 24 }]
    addTitle(ws, "Recouvrement & Facturation SEN'EAU", dateLabel, 3)
    addTableRows(ws, wb, [
      ['Indicateur', 'Valeur', p ? `Période préc. (${rapportRes.prev_label ?? 'N-1'})` : ''],
      ['CA Facturé (FCFA)',        fmt(k.ca_total),          p ? fmt(p.ca_total)          : '—'],
      ['Encaissement (FCFA)',      fmt(k.encaissement),      p ? fmt(p.encaissement)      : '—'],
      ['Impayés (FCFA)',           fmt(k.impaye),            p ? fmt(p.impaye)            : '—'],
      ['Taux de recouvrement',     `${k.taux_recouvrement ?? 0}%`, p ? `${p.taux_recouvrement ?? 0}%` : '—'],
      ['Nombre de factures',       k.nb_factures ?? 0,       p ? p.nb_factures ?? 0 : '—'],
      ['Objectif taux recouvrement', '98.5%',                ''],
    ], PRIMARY)
  }

  /* ── Par DT ── */
  if (has('par_dt') && Array.isArray(rapportRes.par_dr) && rapportRes.par_dr.length > 0) {
    const ws = wb.addWorksheet('Par Direction Territoriale')
    ws.columns = [{ width: 22 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 16 }]
    addTitle(ws, 'Recouvrement par Direction Territoriale', dateLabel, 6)
    addTableRows(ws, wb, [
      ['Direction', 'CA (FCFA)', 'Encaissé (FCFA)', 'Impayés (FCFA)', 'Taux recouvrement', 'Nb factures'],
      ...rapportRes.par_dr.map((r: Record<string, unknown>) => [
        r.dr as string,
        fmt(r.ca_total),
        fmt(r.encaissement),
        fmt(r.impaye),
        pct(Number(r.encaissement), Number(r.ca_total)),
        r.nb_factures as number,
      ]),
    ], PRIMARY)
  }

  /* ── Par bimestre ── */
  if (has('par_bimestre') && Array.isArray(rapportRes.par_bimestre) && rapportRes.par_bimestre.length > 0) {
    const ws = wb.addWorksheet('Par Bimestre')
    ws.columns = [{ width: 14 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 20 }]
    addTitle(ws, 'Évolution par Bimestre', dateLabel, 5)
    addTableRows(ws, wb, [
      ['Bimestre', 'Année', 'CA (FCFA)', 'Encaissé (FCFA)', 'Taux recouvrement'],
      ...rapportRes.par_bimestre.map((r: Record<string, unknown>) => [
        `B${r.bimestre}`, r.annee as number,
        fmt(r.ca_total),
        fmt(r.encaissement),
        pct(Number(r.encaissement), Number(r.ca_total)),
      ]),
    ], SECONDARY)
  }

  /* ── Impayés ── */
  if (has('impayes')) {
    const ws = wb.addWorksheet('Impayés')
    ws.columns = [{ width: 26 }, { width: 20 }, { width: 20 }, { width: 16 }]
    addTitle(ws, 'Analyse des Impayés', dateLabel, 4)
    const byDr = Array.isArray(impayes.par_dr) ? impayes.par_dr : []
    if (byDr.length > 0) {
      addTableRows(ws, wb, [
        ['Direction', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb factures'],
        ...byDr.map((r: Record<string, unknown>) => [r.dr as string, fmt(r.ca), fmt(r.imp), r.nb as number]),
      ], PRIMARY)
    }
    const byStatut = Array.isArray(impayes.par_statut) ? impayes.par_statut : []
    if (byStatut.length > 0) {
      addSectionHeader(ws, 'Par statut facture', 4)
      addTableRows(ws, wb, [
        ['Statut', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb'],
        ...byStatut.map((r: Record<string, unknown>) => [r.statut as string, fmt(r.ca), fmt(r.imp), r.nb as number]),
      ], SECONDARY)
    }
  }

  /* ── Aging ── */
  if (has('aging')) {
    const global = Array.isArray(aging.global) ? aging.global[0] ?? {} : aging.global ?? {}
    const byDr   = Array.isArray(aging.par_dr) ? aging.par_dr : []
    const ws = wb.addWorksheet('Aging Créances')
    ws.columns = [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
    addTitle(ws, 'Aging des Créances (FCFA)', dateLabel, 9)
    const agingHeader = ['DT / Global', 'J', 'J+15', 'J+30', 'J+45', 'J+60', 'J+75', 'J+90', '>90j']
    const agingRow = (label: string, r: Record<string, unknown>) => [
      label, fmt(r.aj), fmt(r.aj15), fmt(r.aj30), fmt(r.aj45),
      fmt(r.aj60), fmt(r.aj75), fmt(r.aj90), fmt(r.ajs90),
    ]
    addTableRows(ws, wb, [
      agingHeader,
      agingRow('TOTAL', global),
      ...byDr.map((r: Record<string, unknown>) => agingRow(r.lbl as string ?? r.dr as string ?? '—', r)),
    ], PRIMARY)
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RAPPORT RH — modulaire par indicateur
════════════════════════════════════════════════════════════════════════════ */

/* ── helpers internes ── */
function addSectionHeader(ws: ExcelJS.Worksheet, label: string, nbCols: number) {
  ws.addRow([])
  const r = ws.addRow([label, ...Array(nbCols - 1).fill('')])
  r.height = 22
  r.getCell(1).font      = { bold: true, size: 11, color: { argb: 'FF' + PRIMARY } }
  r.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + LIGHT_BG } }
  r.getCell(1).alignment = { vertical: 'middle', indent: 1 }
}

function addTableRows(
  ws: ExcelJS.Worksheet,
  wb: ExcelJS.Workbook,
  rows: (string | number)[][],
  headerColor: string,
) {
  rows.forEach((row, i) => {
    const r = ws.addRow(row)
    r.height = i === 0 ? 24 : 20
    if (i === 0) r.eachCell(c => Object.assign(c, headerStyle(wb, headerColor)))
    else if (i % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GRAY } } })
  })
}

function fmt(v: unknown): string {
  return Number(v ?? 0).toLocaleString('fr-FR')
}

async function buildRH(
  wb: ExcelJS.Workbook,
  filtres: Record<string, string>,
  baseUrl: string,
) {
  const indList: string[] = filtres.indicateurs
    ? filtres.indicateurs.split(',').map(s => s.trim()).filter(Boolean)
    : ['kpis', 'masse', 'effectif', 'hs', 'formation', 'anciennete']

  const has = (id: string) => indList.includes(id)
  const qs  = buildQs(filtres, ['indicateurs'])

  const dateLabel = `Année : ${filtres.annee ?? 'Toutes années'} · Généré le ${new Date().toLocaleDateString('fr-FR')}`

  /* Fetch uniquement les endpoints nécessaires */
  const [kpis, evol, details] = await Promise.all([
    (has('kpis'))
      ? fetch(`${baseUrl}/api/rh/kpis?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    (has('masse'))
      ? fetch(`${baseUrl}/api/rh/evolution?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
    (has('effectif') || has('hs') || has('formation') || has('anciennete'))
      ? fetch(`${baseUrl}/api/rh/details?${qs}`).then(r => r.json()).catch(() => ({}))
      : Promise.resolve({}),
  ])

  /* ── Feuille KPIs synthèse ── */
  if (has('kpis')) {
    const ws = wb.addWorksheet('KPIs RH')
    ws.columns = [{ width: 38 }, { width: 22 }, { width: 18 }]
    addTitle(ws, "Indicateurs Ressources Humaines SEN'EAU", dateLabel, 3)
    addTableRows(ws, wb, [
      ['Indicateur', 'Valeur', 'Variation N-1'],
      ['Effectif total',             kpis.nb_salaries ?? 0,                      kpis.variation?.nb_salaries != null ? `${kpis.variation.nb_salaries > 0 ? '+' : ''}${kpis.variation.nb_salaries}%` : '—'],
      ['dont Femmes',                kpis.nb_femmes ?? 0,                        ''],
      ['Taux de féminisation',       `${kpis.taux_feminisation ?? 0}%`,           ''],
      ['CDI',                        kpis.nb_cdi ?? 0,                           ''],
      ['CDD',                        kpis.nb_cdd ?? 0,                           ''],
      ['Taux CDI',                   `${kpis.taux_cdi ?? 0}%`,                   ''],
      ['Ancienneté moyenne (ans)',    kpis.anciennete_moy ?? 0,                   ''],
      ['Masse salariale (FCFA)',      fmt(kpis.masse_salariale),                  kpis.variation?.masse_salariale != null ? `${kpis.variation.masse_salariale > 0 ? '+' : ''}${kpis.variation.masse_salariale}%` : '—'],
      ['Salaire moyen (FCFA)',        fmt(kpis.salaire_moyen),                    ''],
      ['Taux HS / Masse',            `${kpis.taux_hs ?? 0}%`,                    ''],
      ['Heures supplémentaires',     kpis.nb_heures_sup ?? 0,                    ''],
      ['Montant HS (FCFA)',           fmt(kpis.montant_hs),                       ''],
      ['Heures de formation',        kpis.nb_heures_formation ?? 0,              ''],
      ['Collaborateurs formés',      kpis.nb_collaborateurs_formes ?? 0,         ''],
      ['% formés',                   `${kpis.pct_formes ?? 0}%`,                 ''],
    ], PRIMARY)
  }

  /* ── Feuille Masse mensuelle ── */
  if (has('masse') && Array.isArray(evol.mensuel) && evol.mensuel.length > 0) {
    const ws = wb.addWorksheet('Masse Mensuelle')
    ws.columns = [{ width: 12 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 20 }]
    addTitle(ws, 'Masse Salariale Mensuelle', dateLabel, 5)
    addTableRows(ws, wb, [
      ['Mois', 'Masse N (FCFA)', 'Masse N-1 (FCFA)', 'Cumul N (FCFA)', 'Montant HS (FCFA)'],
      ...evol.mensuel.map((r: Record<string, unknown>) => [
        r.label as string,
        fmt(r.masse),
        fmt(r.masse_n1),
        fmt(r.masse_cumul),
        fmt(r.montant_hs),
      ]),
    ], SECONDARY)
  }

  /* ── Feuille Effectif & Structure ── */
  if (has('effectif')) {
    const ws = wb.addWorksheet('Effectif')
    ws.columns = [{ width: 32 }, { width: 18 }, { width: 18 }]
    addTitle(ws, 'Effectif par Établissement', dateLabel, 2)
    if (Array.isArray(details.effectif_par_eta) && details.effectif_par_eta.length > 0) {
      addTableRows(ws, wb, [
        ['Établissement', 'Effectif'],
        ...details.effectif_par_eta.map((r: Record<string, unknown>) => [r.etablissement as string, r.effectif as number]),
      ], PRIMARY)
    }
    addSectionHeader(ws, 'Effectif par Qualification', 2)
    if (Array.isArray(details.effectif_par_qualification) && details.effectif_par_qualification.length > 0) {
      addTableRows(ws, wb, [
        ['Qualification', 'Effectif'],
        ...details.effectif_par_qualification.map((r: Record<string, unknown>) => [r.qualification as string, r.effectif as number]),
      ], SECONDARY)
    }
  }

  /* ── Feuille Heures Supplémentaires ── */
  if (has('hs')) {
    const ws = wb.addWorksheet('Heures Supp.')
    ws.columns = [{ width: 30 }, { width: 20 }, { width: 16 }, { width: 16 }]
    addTitle(ws, 'Heures Supplémentaires par Établissement', dateLabel, 4)
    if (Array.isArray(details.hs_par_eta) && details.hs_par_eta.length > 0) {
      addTableRows(ws, wb, [
        ['Établissement', 'Montant HS (FCFA)', 'Nb heures', 'Nb collabs'],
        ...details.hs_par_eta.map((r: Record<string, unknown>) => [
          r.etablissement as string, fmt(r.montant), r.nb_heures as number, r.nb_collab as number,
        ]),
      ], PRIMARY)
    }
    addSectionHeader(ws, 'HS par Rubrique', 3)
    if (Array.isArray(details.hs_par_rubrique) && details.hs_par_rubrique.length > 0) {
      addTableRows(ws, wb, [
        ['Rubrique', 'Montant (FCFA)', 'Nb collabs'],
        ...details.hs_par_rubrique.map((r: Record<string, unknown>) => [
          r.rubrique as string, fmt(r.montant), r.nb_collab as number,
        ]),
      ], SECONDARY)
    }
  }

  /* ── Feuille Formation ── */
  if (has('formation')) {
    const ws = wb.addWorksheet('Formation')
    ws.columns = [{ width: 30 }, { width: 18 }, { width: 18 }]
    addTitle(ws, 'Formation par Thème', dateLabel, 3)
    if (Array.isArray(details.formation_par_theme) && details.formation_par_theme.length > 0) {
      addTableRows(ws, wb, [
        ['Thème', 'Heures', 'Nb collabs'],
        ...details.formation_par_theme.map((r: Record<string, unknown>) => [
          r.theme as string, r.heures as number, r.nb_collab as number,
        ]),
      ], PRIMARY)
    }
    addSectionHeader(ws, 'Formation par Établissement', 3)
    if (Array.isArray(details.formation_par_eta) && details.formation_par_eta.length > 0) {
      addTableRows(ws, wb, [
        ['Établissement', 'Heures', 'Nb collabs'],
        ...details.formation_par_eta.map((r: Record<string, unknown>) => [
          r.etablissement as string, r.heures as number, r.nb_collab as number,
        ]),
      ], SECONDARY)
    }
  }

  /* ── Feuille Ancienneté ── */
  if (has('anciennete')) {
    const ws = wb.addWorksheet('Ancienneté')
    ws.columns = [{ width: 18 }, { width: 14 }, { width: 14 }, { width: 20 }]
    addTitle(ws, 'Ancienneté & Féminisation', dateLabel, 4)
    if (Array.isArray(details.anciennete_feminisation) && details.anciennete_feminisation.length > 0) {
      addTableRows(ws, wb, [
        ['Tranche', 'Effectif total', 'dont Femmes', 'Taux féminisation'],
        ...details.anciennete_feminisation.map((r: Record<string, unknown>) => [
          r.tranche as string,
          r.nb_total as number,
          r.nb_femmes as number,
          `${r.taux_feminisation ?? 0}%`,
        ]),
      ], PRIMARY)
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RAPPORT FACTURATION — modulaire par indicateur
════════════════════════════════════════════════════════════════════════════ */
async function buildFacturation(
  wb: ExcelJS.Workbook,
  filtres: Record<string, string>,
  baseUrl: string,
) {
  const indList: string[] = filtres.indicateurs
    ? filtres.indicateurs.split(',').map(s => s.trim()).filter(Boolean)
    : ['kpis', 'par_dt', 'par_bimestre', 'impayes', 'aging', 'ca_detail', 'matrice']

  const has = (id: string) => indList.includes(id)
  const qs  = buildQs(filtres, ['indicateurs'])
  const dateLabel = `Année : ${filtres.annee ?? 'Toutes années'} · Généré le ${new Date().toLocaleDateString('fr-FR')}`
  const pct = (enc: number, ca: number) => ca > 0 ? `${(Math.round(enc / ca * 1000) / 10).toLocaleString('fr-FR')}%` : '—'

  /* Fetch sélectif */
  const needsRapports  = has('kpis') || has('par_dt') || has('par_bimestre')
  const needsImpayes   = has('impayes')
  const needsAging     = has('aging')
  const needsCaDetail  = has('ca_detail')
  const needsMatrice   = has('matrice')

  const [rapports, impayes, aging, caDetail, matrice] = await Promise.all([
    needsRapports ? fetch(`${baseUrl}/api/rapports?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
    needsImpayes  ? fetch(`${baseUrl}/api/rapports/impayes?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
    needsAging    ? fetch(`${baseUrl}/api/rapports/reglements?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
    needsCaDetail ? fetch(`${baseUrl}/api/rapports/ca?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
    needsMatrice  ? fetch(`${baseUrl}/api/rapports/matrice?${qs}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({}),
  ])

  /* ── KPIs Synthèse ── */
  if (has('kpis')) {
    const k = rapports.kpis ?? {}
    const p = rapports.kpis_prev ?? null
    const ws = wb.addWorksheet('KPIs Synthèse')
    ws.columns = [{ width: 36 }, { width: 24 }, { width: 24 }]
    addTitle(ws, "Recouvrement & Facturation SEN'EAU", dateLabel, 3)
    addTableRows(ws, wb, [
      ['Indicateur', 'Valeur', p ? `Période préc. (${rapports.prev_label ?? 'N-1'})` : ''],
      ['CA Facturé (FCFA)',        fmt(k.ca_total),          p ? fmt(p.ca_total)          : '—'],
      ['Encaissement (FCFA)',      fmt(k.encaissement),      p ? fmt(p.encaissement)      : '—'],
      ['Impayés (FCFA)',           fmt(k.impaye),            p ? fmt(p.impaye)            : '—'],
      ['Taux de recouvrement',     `${k.taux_recouvrement ?? 0}%`, p ? `${p.taux_recouvrement ?? 0}%` : '—'],
      ['Nombre de factures',       k.nb_factures ?? 0,       p ? p.nb_factures ?? 0 : '—'],
      ['Nombre de DT',             k.nb_dr ?? 0,             ''],
      ['Objectif taux recouvrement', '98.5%',                ''],
    ], PRIMARY)
  }

  /* ── Recouvrement par DT ── */
  if (has('par_dt') && Array.isArray(rapports.par_dr) && rapports.par_dr.length > 0) {
    const ws = wb.addWorksheet('Par DT')
    ws.columns = [{ width: 22 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 16 }]
    addTitle(ws, 'Recouvrement par Direction Territoriale', dateLabel, 6)
    addTableRows(ws, wb, [
      ['Direction', 'CA (FCFA)', 'Encaissé (FCFA)', 'Impayés (FCFA)', 'Taux recouvrement', 'Nb factures'],
      ...rapports.par_dr.map((r: Record<string, unknown>) => [
        r.dr as string,
        fmt(r.ca_total),
        fmt(r.encaissement),
        fmt(r.impaye),
        pct(Number(r.encaissement), Number(r.ca_total)),
        r.nb_factures as number,
      ]),
    ], PRIMARY)
  }

  /* ── Évolution par bimestre ── */
  if (has('par_bimestre') && Array.isArray(rapports.par_bimestre) && rapports.par_bimestre.length > 0) {
    const ws = wb.addWorksheet('Par Bimestre')
    ws.columns = [{ width: 14 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 20 }]
    addTitle(ws, 'Évolution par Bimestre', dateLabel, 5)
    addTableRows(ws, wb, [
      ['Bimestre', 'Année', 'CA (FCFA)', 'Encaissé (FCFA)', 'Taux recouvrement'],
      ...rapports.par_bimestre.map((r: Record<string, unknown>) => [
        `B${r.bimestre}`, r.annee as number,
        fmt(r.ca_total),
        fmt(r.encaissement),
        pct(Number(r.encaissement), Number(r.ca_total)),
      ]),
    ], SECONDARY)
  }

  /* ── Analyse impayés ── */
  if (has('impayes')) {
    const ws = wb.addWorksheet('Impayés')
    ws.columns = [{ width: 26 }, { width: 20 }, { width: 20 }, { width: 16 }]
    addTitle(ws, 'Analyse des Impayés', dateLabel, 4)

    const byDr = Array.isArray(impayes.par_dr) ? impayes.par_dr : []
    if (byDr.length > 0) {
      addTableRows(ws, wb, [
        ['Direction', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb factures'],
        ...byDr.map((r: Record<string, unknown>) => [r.dr as string, fmt(r.ca), fmt(r.imp), r.nb as number]),
      ], PRIMARY)
    }

    const byStatut = Array.isArray(impayes.par_statut) ? impayes.par_statut : []
    if (byStatut.length > 0) {
      addSectionHeader(ws, 'Par statut facture', 4)
      addTableRows(ws, wb, [
        ['Statut', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb'],
        ...byStatut.map((r: Record<string, unknown>) => [r.statut as string, fmt(r.ca), fmt(r.imp), r.nb as number]),
      ], SECONDARY)
    }

    const byGroupe = Array.isArray(impayes.par_groupe) ? impayes.par_groupe : []
    if (byGroupe.length > 0) {
      addSectionHeader(ws, 'Par groupe facturation', 4)
      addTableRows(ws, wb, [
        ['Groupe', 'CA (FCFA)', 'Impayés (FCFA)', 'Nb'],
        ...byGroupe.map((r: Record<string, unknown>) => [r.groupe as string, fmt(r.ca), fmt(r.imp), r.nb as number]),
      ], PRIMARY)
    }
  }

  /* ── Aging des créances ── */
  if (has('aging')) {
    const global = Array.isArray(aging.global) ? aging.global[0] ?? {} : aging.global ?? {}
    const byDr   = Array.isArray(aging.par_dr) ? aging.par_dr : []
    const ws = wb.addWorksheet('Aging Créances')
    ws.columns = [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
    addTitle(ws, 'Aging des Créances (FCFA)', dateLabel, 9)

    const agingHeader = ['DT / Global', 'J', 'J+15', 'J+30', 'J+45', 'J+60', 'J+75', 'J+90', '>90j']
    const agingRow = (label: string, r: Record<string, unknown>) => [
      label, fmt(r.aj), fmt(r.aj15), fmt(r.aj30), fmt(r.aj45),
      fmt(r.aj60), fmt(r.aj75), fmt(r.aj90), fmt(r.ajs90),
    ]
    addTableRows(ws, wb, [
      agingHeader,
      agingRow('TOTAL', global),
      ...byDr.map((r: Record<string, unknown>) => agingRow(r.lbl as string ?? r.dr as string ?? '—', r)),
    ], PRIMARY)
  }

  /* ── Détail CA ── */
  if (has('ca_detail')) {
    const ws = wb.addWorksheet('Détail CA')
    ws.columns = [{ width: 28 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 16 }]
    addTitle(ws, 'Détail du Chiffre d\'Affaires', dateLabel, 5)

    const dims: Record<string, string> = {
      groupe: 'Par groupe facturation', type: 'Par type facture',
      branchement: 'Par catégorie branchement', dr: 'Par Direction Territoriale',
    }
    let first = true
    for (const [dim, label] of Object.entries(dims)) {
      const rows = Array.isArray(caDetail[dim]) ? caDetail[dim]
        : Array.isArray(caDetail) ? (caDetail as Record<string, unknown>[]).filter(r => r.dim === dim) : []
      if (rows.length === 0) continue
      if (!first) addSectionHeader(ws, label, 5)
      else { first = false }
      addTableRows(ws, wb, [
        [label, 'CA (FCFA)', 'Encaissé (FCFA)', 'Impayés (FCFA)', 'Nb'],
        ...rows.map((r: Record<string, unknown>) => [
          r.lbl as string ?? '—', fmt(r.ca), fmt(r.enc), fmt(r.imp), r.nb as number,
        ]),
      ], first ? PRIMARY : SECONDARY)
    }
  }

  /* ── Matrice DR × UO ── */
  if (has('matrice') && Array.isArray(matrice.lignes) && matrice.lignes.length > 0) {
    const ws = wb.addWorksheet('Matrice DR×UO')
    const cols: string[] = Array.isArray(matrice.colonnes) ? matrice.colonnes : []
    ws.columns = [{ width: 26 }, { width: 22 }, ...cols.map(() => ({ width: 16 }))]
    addTitle(ws, 'Matrice DR × UO × Bimestres — Taux recouvrement', dateLabel, 2 + cols.length)
    addTableRows(ws, wb, [
      ['Direction', 'UO', ...cols],
      ...matrice.lignes.map((r: Record<string, unknown>) => [
        r.dr as string ?? '', r.uo as string ?? 'TOTAL DR',
        ...cols.map(c => r[c] != null ? `${r[c]}%` : '—'),
      ]),
    ], PRIMARY)
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   POINT D'ENTRÉE
════════════════════════════════════════════════════════════════════════════ */
export async function generateExcel(
  rapportId: ReportId,
  filtres: Record<string, string>,
  baseUrl: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator  = "SEN'EAU BI Portal"
  wb.created  = new Date()
  wb.modified = new Date()

  switch (rapportId) {
    case 'recouvrement': await buildRecouvrement(wb, filtres, baseUrl); break
    case 'rh':           await buildRH(wb, filtres, baseUrl);           break
    case 'facturation':  await buildFacturation(wb, filtres, baseUrl);  break
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

/* ─── Template HTML email ────────────────────────────────────────────────── */
export function emailHtml(
  name: string,
  rapportId: ReportId,
  filtres: Record<string, string>,
  format: string,
): string {
  const labels: Record<ReportId, string> = {
    recouvrement: 'Recouvrement & Facturation',
    rh:           'Ressources Humaines',
    facturation:  'Facturation',
  }
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#1F3B72;padding:24px 28px;border-radius:10px 10px 0 0">
      <img src="cid:logo" alt="SEN'EAU" style="height:32px" />
      <h2 style="color:#fff;margin:12px 0 4px;font-size:18px">${name}</h2>
      <p style="color:rgba(255,255,255,.6);margin:0;font-size:12px">
        Rapport ${labels[rapportId]} · Envoi automatique planifié
      </p>
    </div>
    <div style="background:#fff;padding:24px 28px;border:1px solid #e8edf8;border-top:none">
      <p style="color:#1F3B72;font-size:14px">Bonjour,</p>
      <p style="color:#374151;font-size:13px;line-height:1.6">
        Veuillez trouver ci-joint le rapport <strong>${labels[rapportId]}</strong>
        au format <strong>${format.toUpperCase()}</strong>,
        généré automatiquement le <strong>${new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</strong>.
      </p>
      ${Object.keys(filtres).length > 0 ? `
      <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">Filtres appliqués</p>
        ${Object.entries(filtres).map(([k,v]) =>
          `<span style="display:inline-block;background:#eef2ff;border-radius:5px;padding:2px 8px;font-size:11px;color:#1F3B72;font-weight:600;margin:2px">${k} : ${v}</span>`
        ).join('')}
      </div>` : ''}
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        Ce message est envoyé automatiquement par la plateforme BI SEN'EAU.<br/>
        Pour modifier cette planification, rendez-vous dans
        <a href="#" style="color:#1F3B72">Administration → Rapports planifiés</a>.
      </p>
    </div>
    <div style="background:#f8fafc;padding:14px 28px;border:1px solid #e8edf8;border-top:none;border-radius:0 0 10px 10px">
      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">
        SEN'EAU — Plateforme d'Intelligence Artificielle & Gouvernance des Données
      </p>
    </div>
  </div>`
}
