'use client'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AlertTriangle, X as XIcon, TrendingDown, Download, Clock, ShieldAlert, ChevronLeft, ChevronRight, Search, List, BarChart2, MapPin, TrendingUp, CalendarX, type LucideIcon } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis, Legend, Cell,
} from 'recharts'

/* ═══════════════════════════════ STYLES ════════════════════════════════════ */
const F_TITLE  = "'Barlow Semi Condensed', sans-serif"
const F_BODY   = "'Nunito', sans-serif"
const C_NAVY   = '#1F3B72'
const C_GREEN  = '#96C11E'
const C_RED    = '#E84040'
const C_ORANGE = '#d97706'

/* ═══════════════════════════════ ONGLETS ═══════════════════════════════════ */
type TabId = 'global' | 'anciennete' | 'terrain' | 'suivi'

const TABS: { id: TabId; label: string; sub: string; Icon: LucideIcon }[] = [
  { id: 'global',     label: 'Vue globale',    sub: 'KPIs · Tendance · Top UO',         Icon: BarChart2  },
  { id: 'anciennete', label: 'Ancienneté',     sub: 'Durée d\'absence · Détail PDI',    Icon: CalendarX  },
  { id: 'terrain',    label: 'Terrain',        sub: 'Tournées · Diamètres',             Icon: MapPin     },
  { id: 'suivi',      label: 'Suivi & Retour', sub: 'Actions correctives · Évolution',  Icon: TrendingUp },
]

/* ═══════════════════════════════ TYPES ═════════════════════════════════════ */
interface CaRow {
  uo:                  string
  nb_prises_non_fact:  number
  ca_manquant_estime:  number
  ca_median_par_prise: number
  nb_obs_stratum:      number
  fiabilite:           'haute' | 'acceptable' | 'indicatif'
}

interface AncDist {
  categorie: string
  label:     string
  nb_prises: number
  ca:        number
  pct:       number
}

interface AncUo {
  uo:      string
  jamais:  number
  bim3plus: number
  bim2:    number
  bim1:    number
  ca:      number
}

interface JamaisRow {
  uo:                  string
  nb_prises:           number
  ca_manquant_annuel:  number
  nb_obs_stratum:      number
  fiabilite:           'haute' | 'acceptable' | 'indicatif'
}

interface TendancePoint {
  bimestre:           number
  label:              string
  nb_prises_non_fact: number
  ca_manquant_total:  number
  ca_moy_global:      number
}

interface TourneeRow {
  tournee:            string
  uo:                 string
  nb_non_fact:        number
  nb_total:           number
  taux_non_fact:      number
  ca_manquant_estime: number
}

interface DiametreRow {
  categorie:          string
  nb_non_fact:        number
  nb_parc:            number
  taux_non_fact:      number
  ca_manquant_estime: number
}

interface RetourPoint {
  bim_prev:        number
  bim_curr:        number
  label:           string
  label_prev:      string
  label_curr:      string
  nb_absents_prev: number
  nb_retour:       number
  nb_fact_prev:    number
  taux_retour:     number
}

interface FiltresDispo {
  annees:  number[]
  drs:     string[]
}

const FIABILITE_CFG = {
  haute:      { color: '#16a34a', label: 'Haute',      bg: 'rgba(22,163,74,.10)'   },
  acceptable: { color: C_ORANGE,  label: 'Acceptable', bg: 'rgba(217,119,6,.10)'   },
  indicatif:  { color: '#94a3b8', label: 'Indicatif',  bg: 'rgba(148,163,184,.10)' },
}

const BIMESTRE_LABELS: Record<string, string> = {
  '1': 'B1 Jan–Fév', '2': 'B2 Mar–Avr', '3': 'B3 Mai–Jun',
  '4': 'B4 Jul–Aoû', '5': 'B5 Sep–Oct', '6': 'B6 Nov–Déc',
}

/* ═══════════════════════════════ HELPERS ═══════════════════════════════════ */
function fmtFcfa(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Mds F'
  if (Math.abs(v) >= 1_000_000)     return (v / 1_000_000).toLocaleString('fr-FR',     { maximumFractionDigits: 1 }) + ' MF'
  if (Math.abs(v) >= 1_000)         return (v / 1_000).toLocaleString('fr-FR',         { maximumFractionDigits: 0 }) + ' kF'
  return v.toLocaleString('fr-FR') + ' F'
}
const fmtN = (v: number | null | undefined) => (v ?? 0).toLocaleString('fr-FR')

function exportCsv(rows: CaRow[], filename: string) {
  const headers = ['UO', 'Prises non facturées', 'CA moyen/prise (F)', 'CA manquant estimé (F)', 'Observations', 'Fiabilité']
  const lines = rows.map(r => [
    `"${r.uo}"`,
    r.nb_prises_non_fact,
    r.ca_median_par_prise.toFixed(0),
    r.ca_manquant_estime.toFixed(0),
    r.nb_obs_stratum,
    r.fiabilite,
  ].join(';'))
  const content = '\uFEFF' + [headers.join(';'), ...lines].join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ═══════════════════════════════ UI ATOMS ══════════════════════════════════ */
function KpiCard({ label, value, sub, accent, delta }: {
  label: string; value: string; sub?: string; accent?: string
  /** variation vs période précédente — positif = augmentation */
  delta?: { val: number; label: string; positifBon?: boolean }
}) {
  const dcolor = delta
    ? delta.val === 0 ? '#94a3b8'
      : (delta.val > 0) === (delta.positifBon ?? true) ? '#16a34a' : C_RED
    : ''
  const arrow = delta ? (delta.val > 0 ? '▲' : delta.val < 0 ? '▼' : '—') : ''
  const sign  = delta && delta.val > 0 ? '+' : ''

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', flex: '1 1 150px', minWidth: 130 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, fontFamily: F_TITLE, color: accent ?? C_NAVY, lineHeight: 1.1 }}>{value}</div>
      {delta && delta.val !== 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: dcolor, fontFamily: F_BODY }}>
            {arrow} {sign}{fmtN(Math.abs(delta.val))}
          </span>
          <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>{delta.label}</span>
        </div>
      ) : (
        sub && <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 4, fontFamily: F_BODY }}>{sub}</div>
      )}
    </div>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', ...style }}>
      {children}
    </div>
  )
}

function PanelHeader({ title, extra }: { title: string; extra?: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 4, height: 18, borderRadius: 99, background: C_NAVY, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontFamily: F_BODY, fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
      {extra && <div style={{ marginLeft: 'auto' }}>{extra}</div>}
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', color: 'rgba(31,59,114,.45)', fontSize: 13, fontFamily: F_BODY }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-rp 0.8s linear infinite', flexShrink: 0 }} />
      Chargement…
    </div>
  )
}

function ErrMsg({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(232,64,64,.07)', borderRadius: 10, border: '1px solid rgba(232,64,64,.15)', color: C_RED, fontSize: 13, fontWeight: 600, fontFamily: F_BODY }}>
      <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />{msg}
    </div>
  )
}

function Sel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e8edf5', fontSize: 12, fontWeight: 600, fontFamily: F_BODY, color: C_NAVY, background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 130 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

/* ── Tooltip recharts ── */
function TtCfa({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(31,59,114,.12)' }}>
      <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2, fontWeight: 600 }}>
          {p.name} : <span style={{ fontWeight: 900 }}>{p.name.includes('CA') || p.name.includes('F)') ? fmtFcfa(p.value) : fmtN(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════ GRAPHIQUES ════════════════════════════════════════ */
function ChartTopUo({ rows }: { rows: CaRow[] }) {
  const top10 = rows.slice(0, 10).map(r => ({
    uo:  r.uo.length > 22 ? r.uo.slice(0, 20) + '…' : r.uo,
    ca:  r.ca_manquant_estime,
    prs: r.nb_prises_non_fact,
  })).reverse()

  if (!top10.length) return null
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, top10.length * 34 + 40)}>
      <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tickFormatter={v => fmtFcfa(Number(v))} tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="uo" width={130} tick={{ fontSize: 10, fontFamily: F_BODY, fill: C_NAVY, fontWeight: 700 }} axisLine={false} tickLine={false} />
        <Tooltip content={<TtCfa />} cursor={{ fill: 'rgba(31,59,114,.04)' }} />
        <Bar dataKey="ca" name="CA manquant (F)" fill={C_RED} radius={[0, 4, 4, 0]} maxBarSize={18}
          label={{ position: 'right', formatter: (v: unknown) => fmtFcfa(Number(v)), fontSize: 9, fill: '#64748b', fontFamily: F_BODY }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartTendance({ points, annee }: { points: TendancePoint[]; annee: string }) {
  if (!points.some(p => p.ca_manquant_total > 0)) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(31,59,114,.35)', fontSize: 12, fontFamily: F_BODY }}>
      Aucune donnée de tendance pour {annee}
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: F_BODY, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="ca"  orientation="left"  tickFormatter={v => fmtFcfa(Number(v))}  tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="prs" orientation="right" tickFormatter={v => fmtN(Number(v))}     tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip content={<TtCfa />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontFamily: F_BODY }} />
        <Line yAxisId="ca"  type="monotone" dataKey="ca_manquant_total"  name="CA manquant (F)"  stroke={C_RED}  strokeWidth={2.5} dot={{ r: 4, fill: C_RED }}   activeDot={{ r: 6 }} />
        <Line yAxisId="prs" type="monotone" dataKey="nb_prises_non_fact" name="Prises non fact." stroke={C_NAVY} strokeWidth={2}   dot={{ r: 3, fill: C_NAVY }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
  )
}

function ChartScatter({ rows }: { rows: CaRow[] }) {
  const data = rows.map(r => ({ x: r.nb_prises_non_fact, y: r.ca_median_par_prise, z: r.ca_manquant_estime, name: r.uo }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="x" name="Prises non fact." type="number" tickFormatter={v => fmtN(Number(v))}
          tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          label={{ value: 'Prises non facturées', position: 'insideBottom', offset: -14, fontSize: 10, fill: '#94a3b8', fontFamily: F_BODY }} />
        <YAxis dataKey="y" name="CA moy/prise (F)" type="number" tickFormatter={v => fmtFcfa(Number(v))}
          tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          label={{ value: 'CA moyen / prise', angle: -90, position: 'insideLeft', offset: 12, fontSize: 10, fill: '#94a3b8', fontFamily: F_BODY }} />
        <ZAxis dataKey="z" range={[40, 500]} name="CA manquant (F)" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const d = payload[0]?.payload
          return (
            <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(31,59,114,.12)' }}>
              <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{d?.name}</div>
              <div style={{ color: 'rgba(31,59,114,.65)', marginBottom: 2 }}>Prises non fact. : <strong>{fmtN(d?.x)}</strong></div>
              <div style={{ color: 'rgba(31,59,114,.65)', marginBottom: 2 }}>CA moy/prise : <strong>{fmtFcfa(d?.y ?? 0)}</strong></div>
              <div style={{ color: C_RED, fontWeight: 800 }}>CA manquant estimé : <strong>{fmtFcfa(d?.z ?? 0)}</strong></div>
            </div>
          )
        }} />
        <Scatter data={data} fill={C_RED} fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

/* ── Bouton export réutilisable ── */
function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #e8edf5', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, transition: 'all .15s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = C_NAVY }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff';    e.currentTarget.style.borderColor = '#e8edf5' }}
    >
      <Download size={12} strokeWidth={2.5} />Exporter CSV
    </button>
  )
}

function exportJamaisCsv(rows: JamaisRow[], filename: string) {
  const headers = ['UO', 'Prises jamais facturées', 'CA manquant annuel estimé (F)', 'Observations', 'Fiabilité']
  const lines = rows.map(r => [`"${r.uo}"`, r.nb_prises, r.ca_manquant_annuel.toFixed(0), r.nb_obs_stratum, r.fiabilite].join(';'))
  const content = '\uFEFF' + [headers.join(';'), ...lines].join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/* ── Couleurs par catégorie d'ancienneté ── */
const ANC_CFG: Record<string, { color: string; bg: string; label: string; severity: string }> = {
  jamais: { color: '#991b1b', bg: 'rgba(153,27,27,.12)',  label: 'Jamais facturé cette année', severity: 'Critique'  },
  '3plus':{ color: C_RED,    bg: 'rgba(232,64,64,.10)',   label: '3+ bimestres absents',        severity: 'Très élevé' },
  '2bim': { color: C_ORANGE, bg: 'rgba(217,119,6,.10)',   label: '2 bimestres absents',         severity: 'Élevé'    },
  '1bim': { color: '#ca8a04',bg: 'rgba(202,138,4,.08)',   label: '1 bimestre absent',           severity: 'Modéré'   },
}

/* ══════════════════ DETAIL ANCIENNETÉ (paginé) ══════════════════════════════ */
interface DetailRow {
  pdi_reference:   string
  uo:              string
  code_tournee:    string
  nb_bim_factures: number
  nb_bim_total:    number
  nb_bim_absents:  number
  categorie:       string
}

const CAT_OPTIONS = [
  { value: 'jamais', label: 'Jamais facturé' },
  { value: '3plus',  label: '3+ bim. absents' },
  { value: '2bim',   label: '2 bim. absents' },
  { value: '1bim',   label: '1 bim. absent' },
  { value: 'all',    label: 'Toutes catégories' },
]

function exportDetailCsv(rows: DetailRow[], annee: string) {
  const headers = ['PDI_REFERENCE', 'UO', 'CODE_TOURNEE', 'Bim. facturés', 'Bim. total', 'Bim. absents', 'Catégorie']
  const lines   = rows.map(r => [
    `"${r.pdi_reference}"`, `"${r.uo}"`, `"${r.code_tournee}"`,
    r.nb_bim_factures, r.nb_bim_total, r.nb_bim_absents, r.categorie,
  ].join(';'))
  const content = '\uFEFF' + [headers.join(';'), ...lines].join('\r\n')
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href = url; a.download = `detail-anciennete_${annee}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function DetailAnciennete({ annee, dr, uoList }: { annee: string; dr: string; uoList: string[] }) {
  const [categorie, setCategorie] = useState('jamais')
  const [uo,        setUo]        = useState('')
  const [search,    setSearch]    = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page,      setPage]      = useState(1)

  const [rows,     setRows]     = useState<DetailRow[]>([])
  const [total,    setTotal]    = useState(0)
  const [pages,    setPages]    = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  const [exporting, setExporting] = useState(false)

  /* Debounce search */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = (v: string) => {
    setSearchInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setSearch(v); setPage(1) }, 350)
  }

  /* Reset page when filters change */
  useEffect(() => { setPage(1) }, [categorie, uo])

  /* Fetch data */
  useEffect(() => {
    setLoading(true); setErr('')
    const p = new URLSearchParams({ annee, page: String(page), limit: '50' })
    if (dr !== 'all')    p.set('dr', dr)
    if (categorie)       p.set('categorie', categorie)
    if (uo)              p.set('uo', uo)
    if (search.trim())   p.set('search', search.trim())

    fetch(`/api/carte/ca-manquant/anciennete/details?${p}`)
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(d => {
        setRows(d.rows ?? [])
        setTotal(d.total ?? 0)
        setPages(d.pages ?? 1)
        setLoading(false)
      })
      .catch(e => { setErr(String(e)); setLoading(false) })
  }, [annee, dr, categorie, uo, search, page])

  /* Export CSV (fetch sans pagination) */
  const handleExport = async () => {
    setExporting(true)
    try {
      const p = new URLSearchParams({ annee, page: '1', limit: '5000' })
      if (dr !== 'all')  p.set('dr', dr)
      if (categorie)     p.set('categorie', categorie)
      if (uo)            p.set('uo', uo)
      if (search.trim()) p.set('search', search.trim())
      const d = await fetch(`/api/carte/ca-manquant/anciennete/details?${p}`).then(r => r.json())
      exportDetailCsv(d.rows ?? [], annee)
    } catch { /* silent */ }
    setExporting(false)
  }

  const from = (page - 1) * 50 + 1
  const to   = Math.min(page * 50, total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Barre de filtres ── */}
      <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>

        {/* Catégorie */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }}>Catégorie</span>
          <select value={categorie} onChange={e => setCategorie(e.target.value)}
            style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e8edf5', fontSize: 12, fontWeight: 600, fontFamily: F_BODY, color: C_NAVY, background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 155 }}>
            {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        {/* UO */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }}>Unité Opérationnelle</span>
          <select value={uo} onChange={e => setUo(e.target.value)}
            style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e8edf5', fontSize: 12, fontWeight: 600, fontFamily: F_BODY, color: C_NAVY, background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 150 }}>
            <option value="">Toutes les UO</option>
            {uoList.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>

        {/* Recherche PDI */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 180px' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }}>Recherche PDI</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={12} color="#94a3b8" style={{ position: 'absolute', left: 9, pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Ref. client…"
              style={{ paddingLeft: 28, padding: '6px 9px 6px 28px', borderRadius: 8, border: '1px solid #e8edf5', fontSize: 12, fontFamily: F_BODY, color: C_NAVY, background: '#fff', outline: 'none', width: '100%', minWidth: 160 }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 0 }}>
                <XIcon size={12} />
              </button>
            )}
          </div>
        </label>

        {/* Compteur + Export */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {!loading && total > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(31,59,114,.45)', fontFamily: F_BODY, fontWeight: 600, alignSelf: 'center' }}>
              {from}–{to} sur {total.toLocaleString('fr-FR')} prises
            </span>
          )}
          <button onClick={handleExport} disabled={exporting || loading || total === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 8, border: '1px solid #e8edf5', background: '#fff', cursor: exporting || total === 0 ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, color: exporting || total === 0 ? '#cbd5e1' : C_NAVY, fontFamily: F_BODY, transition: 'all .15s', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { if (!exporting && total > 0) { e.currentTarget.style.background='#eef2ff'; e.currentTarget.style.borderColor=C_NAVY } }}
            onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#e8edf5' }}>
            <Download size={12} strokeWidth={2.5} />{exporting ? 'Export…' : 'Exporter CSV'}
          </button>
        </div>
      </div>

      {/* ── Corps : table ou état ── */}
      <div style={{ minHeight: 160 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '28px 20px', color: 'rgba(31,59,114,.45)', fontSize: 13, fontFamily: F_BODY }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-rp 0.8s linear infinite', flexShrink: 0 }} />
            Chargement des prises…
          </div>
        ) : err ? (
          <div style={{ padding: '14px 20px' }}><ErrMsg msg={err} /></div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'rgba(31,59,114,.35)', fontSize: 13, fontFamily: F_BODY }}>
            Aucune prise ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F_BODY }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                  {['#', 'PDI_REFERENCE', 'Unité Opérationnelle', 'CODE_TOURNEE', 'Bim. facturés', 'Bim. absents', 'Catégorie'].map((h, i) => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: i <= 1 ? 'center' : i === 2 || i === 3 ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid #e8edf5', whiteSpace: 'nowrap', fontFamily: F_BODY }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const cfg     = ANC_CFG[r.categorie] ?? ANC_CFG['1bim']
                  const rowNum  = from + i
                  return (
                    <tr key={r.pdi_reference}
                      style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbff')}>

                      {/* # */}
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#cbd5e1', fontSize: 10, fontWeight: 700, width: 40 }}>
                        {rowNum}
                      </td>

                      {/* PDI_REFERENCE */}
                      <td style={{ padding: '8px 14px', fontWeight: 800, color: C_NAVY, fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
                        {r.pdi_reference}
                      </td>

                      {/* UO */}
                      <td style={{ padding: '8px 14px', color: 'rgba(31,59,114,.75)', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.uo}
                      </td>

                      {/* CODE_TOURNEE */}
                      <td style={{ padding: '8px 14px', color: 'rgba(31,59,114,.55)', fontSize: 11 }}>
                        {r.code_tournee}
                      </td>

                      {/* Bim. facturés / total */}
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: r.nb_bim_factures === 0 ? '#991b1b' : '#16a34a', fontFamily: F_TITLE }}>
                          {r.nb_bim_factures}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 10 }}>/{r.nb_bim_total}</span>
                      </td>

                      {/* Bim. absents */}
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 900, color: cfg.color, fontFamily: F_TITLE, fontSize: 13 }}>
                          {r.nb_bim_absents}
                        </span>
                      </td>

                      {/* Catégorie */}
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                        <span style={{ background: cfg.bg, color: cfg.color, fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 99, border: `1px solid ${cfg.color}40`, whiteSpace: 'nowrap' }}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && pages > 1 && (
        <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>

          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #e8edf5', background: page === 1 ? '#f8fafc' : '#fff', cursor: page === 1 ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, color: page === 1 ? '#cbd5e1' : C_NAVY, fontFamily: F_BODY }}>
            <ChevronLeft size={13} />Précédent
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Pages proches */}
            {Array.from({ length: Math.min(7, pages) }, (_, i) => {
              let p: number
              if (pages <= 7) {
                p = i + 1
              } else if (page <= 4) {
                p = i + 1
              } else if (page >= pages - 3) {
                p = pages - 6 + i
              } else {
                p = page - 3 + i
              }
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: p === page ? `2px solid ${C_NAVY}` : '1px solid #e8edf5', background: p === page ? C_NAVY : '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: p === page ? '#fff' : 'rgba(31,59,114,.5)', fontFamily: F_BODY, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}>
                  {p}
                </button>
              )
            })}
            {pages > 7 && (
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: F_BODY }}>… {pages} pages</span>
            )}
          </div>

          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #e8edf5', background: page === pages ? '#f8fafc' : '#fff', cursor: page === pages ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, color: page === pages ? '#cbd5e1' : C_NAVY, fontFamily: F_BODY }}>
            Suivant<ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════ SECTION ANCIENNETÉ ══════════════════════════════════ */
function SectionAnciennete({ dist, par_uo, annee }: { dist: AncDist[]; par_uo: AncUo[]; annee: string }) {
  if (!dist.length || dist.every(d => d.nb_prises === 0)) return (
    <div style={{ color: 'rgba(31,59,114,.35)', fontSize: 12, padding: '16px 0' }}>Aucune donnée d&apos;ancienneté disponible.</div>
  )

  const critiques = (dist.find(d => d.categorie === 'jamais')?.nb_prises ?? 0)
    + (dist.find(d => d.categorie === '3plus')?.nb_prises ?? 0)
  const total = dist.reduce((s, d) => s + d.nb_prises, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Alerte critique si jamais facturés */}
      {critiques > 0 && (
        <div style={{ background: 'rgba(153,27,27,.06)', border: '1px solid rgba(153,27,27,.18)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={14} color="#991b1b" strokeWidth={2} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', fontFamily: F_BODY }}>
            {fmtN(critiques)} prises en situation critique
            <span style={{ fontWeight: 500, marginLeft: 6 }}>({Math.round(critiques / total * 100)}% des non-facturées)</span>
            — absentes depuis 3 bimestres ou plus
          </div>
        </div>
      )}

      {/* Distribution — barres horizontales colorées */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12, fontFamily: F_BODY }}>
            Répartition par durée d&apos;absence
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dist.filter(d => d.nb_prises > 0).map(d => {
              const cfg = ANC_CFG[d.categorie] ?? ANC_CFG['1bim']
              const pctBar = total > 0 ? (d.nb_prises / total) * 100 : 0
              return (
                <div key={d.categorie}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY }}>{d.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: cfg.bg, color: cfg.color }}>{cfg.severity}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: cfg.color, fontFamily: F_TITLE }}>{fmtN(d.nb_prises)}</span>
                      <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{d.pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctBar}%`, background: cfg.color, borderRadius: 4, transition: 'width .5s ease' }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3, textAlign: 'right' }}>
                    CA estimé : {fmtFcfa(d.ca)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top UO par criticité */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12, fontFamily: F_BODY }}>
            Top UO — Prises critiques (jamais + 3+ bim)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {par_uo.slice(0, 8).map((u, i) => {
              const critique = u.jamais + u.bim3plus
              const total_uo = u.jamais + u.bim3plus + u.bim2 + u.bim1
              if (total_uo === 0) return null
              const pctCrit = total_uo > 0 ? Math.round(critique / total_uo * 100) : 0
              return (
                <div key={u.uo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ width: 20, textAlign: 'center', fontSize: 10, fontWeight: 800, color: i < 3 ? C_RED : '#cbd5e1', fontFamily: F_BODY, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C_NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.uo}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      {u.jamais  > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: ANC_CFG.jamais.bg,  color: ANC_CFG.jamais.color  }}>{fmtN(u.jamais)} jamais</span>}
                      {u.bim3plus > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: ANC_CFG['3plus'].bg, color: ANC_CFG['3plus'].color }}>{fmtN(u.bim3plus)} 3+bim</span>}
                      {u.bim2    > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: ANC_CFG['2bim'].bg,  color: ANC_CFG['2bim'].color  }}>{fmtN(u.bim2)} 2bim</span>}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: pctCrit > 50 ? C_RED : C_ORANGE, fontFamily: F_TITLE }}>{pctCrit}%</div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>critiques</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        * <strong>Jamais facturé</strong> : aucune facture sur toute l&apos;année {annee} — suspect (compteur défaillant, accès impossible, fraude).
        · <strong>3+ bim absents</strong> : facturé dans moins de la moitié des bimestres de l&apos;année.
      </div>
    </div>
  )
}

/* ══════════════════════ SECTION JAMAIS FACTURÉES ════════════════════════════ */
function SectionJamaisFacturees({ rows, total, annee }: { rows: JamaisRow[]; total: { prises: number; ca: number }; annee: string }) {
  const [sortCol, setSortCol] = useState<keyof JamaisRow>('nb_prises')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => {
      const av = a[sortCol] as number | string
      const bv = b[sortCol] as number | string
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  , [rows, sortCol, sortAsc])

  if (rows.length === 0) return (
    <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: 12, fontWeight: 700, fontFamily: F_BODY }}>
      ✓ Aucune prise n&apos;est restée sans facture toute l&apos;année {annee}
    </div>
  )

  function ThJ({ label, col, align = 'right' }: { label: string; col?: keyof JamaisRow; align?: 'left' | 'right' | 'center' }) {
    const active = col && sortCol === col
    return (
      <th onClick={() => col && (sortCol === col ? setSortAsc(a => !a) : (setSortCol(col), setSortAsc(false)))}
        style={{ padding: '10px 14px', textAlign: align, fontSize: 10, fontWeight: 700, color: active ? C_NAVY : 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.05em', cursor: col ? 'pointer' : 'default', borderBottom: `2px solid ${active ? C_NAVY : '#f1f5f9'}`, whiteSpace: 'nowrap', userSelect: 'none', fontFamily: F_BODY }}>
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div>
      {/* Bandeau alerte */}
      <div style={{ margin: '0', padding: '12px 20px', background: 'rgba(153,27,27,.05)', borderBottom: '1px solid rgba(153,27,27,.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldAlert size={15} color="#991b1b" strokeWidth={2} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 12, fontFamily: F_BODY }}>
          <span style={{ fontWeight: 900, color: '#991b1b' }}>{fmtN(total.prises)} prises</span>
          <span style={{ color: 'rgba(31,59,114,.6)', fontWeight: 600 }}> actives n&apos;ont reçu <strong>aucune facture</strong> en {annee} · CA annuel estimé : </span>
          <span style={{ fontWeight: 900, color: '#991b1b' }}>{fmtFcfa(total.ca)}</span>
          <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 8 }}>(CA moyen × nb bimestres disponibles)</span>
        </div>
      </div>

      {/* Tableau */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F_BODY }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <ThJ label="#"                           align="center" />
              <ThJ label="Unité Opérationnelle"        col="uo"                  align="left" />
              <ThJ label="Prises jamais facturées"     col="nb_prises" />
              <ThJ label="CA manquant annuel estimé"   col="ca_manquant_annuel" />
              <ThJ label="Obs."                        col="nb_obs_stratum" />
              <ThJ label="Fiabilité"                   col="fiabilite"           align="center" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const fib = FIABILITE_CFG[r.fiabilite] ?? FIABILITE_CFG.indicatif
              return (
                <tr key={r.uo} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fff9f9', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fff9f9')}>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: '#cbd5e1', fontSize: 10, fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '9px 14px', fontWeight: 800, color: C_NAVY }}>{r.uo}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 900, color: '#991b1b', fontSize: 13, fontFamily: F_TITLE }}>{fmtN(r.nb_prises)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 900, color: '#991b1b', fontFamily: F_TITLE, fontSize: 13 }}>{fmtFcfa(r.ca_manquant_annuel)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>{fmtN(r.nb_obs_stratum)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                    <span style={{ background: fib.bg, color: fib.color, fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 99, border: `1px solid ${fib.color}40` }}>
                      ● {fib.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(153,27,27,.05)', borderTop: '2px solid rgba(153,27,27,.15)' }}>
              <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 900, color: '#991b1b', fontSize: 12 }}>TOTAL</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#991b1b', fontSize: 13 }}>{fmtN(total.prises)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#991b1b', fontFamily: F_TITLE, fontSize: 15 }}>{fmtFcfa(total.ca)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', fontSize: 9, color: '#94a3b8', lineHeight: 1.6 }}>
        * CA manquant annuel = CA moyen / facture de l&apos;UO × nombre de bimestres disponibles dans l&apos;année.
        · Causes possibles : compteur défaillant, accès impossible, raccordement non posé, fraude.
      </div>
    </div>
  )
}

/* ══════════════════════ SECTION TOURNÉES ════════════════════════════════════ */
function SectionTournees({ rows }: { rows: TourneeRow[] }) {
  const [sortCol, setSortCol] = useState<keyof TourneeRow>('nb_non_fact')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => {
      const av = a[sortCol] as number | string
      const bv = b[sortCol] as number | string
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  , [rows, sortCol, sortAsc])

  if (!rows.length) return (
    <div style={{ padding: '20px', color: 'rgba(31,59,114,.35)', fontSize: 12, fontFamily: F_BODY }}>
      Aucune donnée de tournée disponible (colonne CODE_TOURNEE vide ou absente).
    </div>
  )

  const top3 = rows.slice(0, 3)
  const chartData = rows.slice(0, 15).map(r => ({
    tournee: r.tournee.length > 18 ? r.tournee.slice(0, 16) + '…' : r.tournee,
    nb: r.nb_non_fact,
    taux: r.taux_non_fact,
    ca: r.ca_manquant_estime,
  })).reverse()

  function Th({ label, col, align = 'right' }: { label: string; col?: keyof TourneeRow; align?: 'left' | 'right' | 'center' }) {
    const active = col && sortCol === col
    return (
      <th onClick={() => col && (sortCol === col ? setSortAsc(a => !a) : (setSortCol(col), setSortAsc(false)))}
        style={{ padding: '10px 14px', textAlign: align, fontSize: 10, fontWeight: 700, color: active ? C_NAVY : 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.05em', cursor: col ? 'pointer' : 'default', borderBottom: `2px solid ${active ? C_NAVY : '#f1f5f9'}`, whiteSpace: 'nowrap', userSelect: 'none', fontFamily: F_BODY }}>
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Alerte top 3 tournées */}
      {top3.some(r => r.taux_non_fact >= 50) && (
        <div style={{ background: 'rgba(232,64,64,.05)', border: '1px solid rgba(232,64,64,.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle size={14} color={C_RED} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, fontFamily: F_BODY }}>
            <span style={{ fontWeight: 800, color: C_RED }}>Tournées critiques — </span>
            <span style={{ color: 'rgba(31,59,114,.65)' }}>
              {top3.filter(r => r.taux_non_fact >= 50).map(r =>
                <span key={r.tournee}><strong>{r.tournee}</strong> ({r.taux_non_fact}% de non-facturées){' '}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Graphique + Tableau */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Bar chart horizontal */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: F_BODY }}>
            Top 15 tournées — Prises non facturées
          </div>
          <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 28 + 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 70, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="tournee" width={110} tick={{ fontSize: 9, fontFamily: F_BODY, fill: C_NAVY, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]
                return (
                  <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(31,59,114,.12)' }}>
                    <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{label}</div>
                    <div style={{ color: C_RED, fontWeight: 700 }}>Non facturées : {fmtN(d.value as number)}</div>
                  </div>
                )
              }} cursor={{ fill: 'rgba(31,59,114,.04)' }} />
              <Bar dataKey="nb" name="Non facturées" fill={C_RED} radius={[0, 4, 4, 0]} maxBarSize={16}
                label={{ position: 'right', formatter: (v: unknown) => fmtN(Number(v)), fontSize: 9, fill: '#64748b', fontFamily: F_BODY }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tableau */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: F_BODY }}>
            Détail par tournée (top 30)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: F_BODY }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <Th label="#" align="center" />
                <Th label="Tournée" col="tournee" align="left" />
                <Th label="UO" col="uo" align="left" />
                <Th label="Non fact." col="nb_non_fact" />
                <Th label="Parc" col="nb_total" />
                <Th label="Taux" col="taux_non_fact" />
                <Th label="CA manquant" col="ca_manquant_estime" />
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 20).map((r, i) => (
                <tr key={`${r.tournee}-${r.uo}`}
                  style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f4f7ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbff')}>
                  <td style={{ padding: '7px 12px', textAlign: 'center', color: '#cbd5e1', fontSize: 10, fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '7px 12px', fontWeight: 800, color: C_NAVY, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tournee}</td>
                  <td style={{ padding: '7px 12px', color: 'rgba(31,59,114,.6)', fontSize: 10 }}>{r.uo}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 900, color: C_RED }}>{fmtN(r.nb_non_fact)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8' }}>{fmtN(r.nb_total)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: r.taux_non_fact >= 50 ? C_RED : r.taux_non_fact >= 30 ? C_ORANGE : '#16a34a' }}>
                      {r.taux_non_fact}%
                    </span>
                  </td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: C_RED, fontFamily: F_TITLE, fontSize: 11 }}>{fmtFcfa(r.ca_manquant_estime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        * <strong>Taux de non-facturation</strong> = prises non facturées / parc total de la tournée.
        · Rouge ≥ 50% · Orange ≥ 30% · Vert &lt; 30%.
      </div>
    </div>
  )
}

/* ══════════════════════ SECTION DIAMÈTRES ═══════════════════════════════════ */
const DIAM_ORDER = ['DN≤15', 'DN20', 'DN25', 'DN32', 'DN≤50', 'DN>50', 'Inconnu']
const DIAM_COLORS: Record<string, string> = {
  'DN≤15': '#3b82f6', 'DN20': '#6366f1', 'DN25': '#8b5cf6',
  'DN32': '#a855f7', 'DN≤50': '#d946ef', 'DN>50': '#f43f5e', 'Inconnu': '#94a3b8',
}

function SectionDiametres({ rows }: { rows: DiametreRow[] }) {
  if (!rows.length) return (
    <div style={{ padding: '20px', color: 'rgba(31,59,114,.35)', fontSize: 12, fontFamily: F_BODY }}>
      Aucune donnée de diamètre disponible (colonne diametre vide ou absente).
    </div>
  )

  const sorted = [...rows].sort((a, b) => {
    const ia = DIAM_ORDER.indexOf(a.categorie)
    const ib = DIAM_ORDER.indexOf(b.categorie)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const totalNonFact = rows.reduce((s, r) => s + r.nb_non_fact, 0)

  const chartData = sorted.map(r => ({
    categorie: r.categorie,
    nb:        r.nb_non_fact,
    taux:      r.taux_non_fact,
    fill:      DIAM_COLORS[r.categorie] ?? '#94a3b8',
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Bar chart vertical */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: F_BODY }}>
            Prises non facturées par diamètre
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="categorie" tick={{ fontSize: 10, fontFamily: F_BODY, fill: C_NAVY, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]
                const row = rows.find(r => r.categorie === label)
                return (
                  <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(31,59,114,.12)' }}>
                    <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{label}</div>
                    <div style={{ color: DIAM_COLORS[label ?? ''] ?? '#64748b', fontWeight: 700 }}>Non facturées : {fmtN(d.value as number)}</div>
                    {row && <div style={{ color: '#94a3b8', marginTop: 2 }}>Parc : {fmtN(row.nb_parc)} · Taux : {row.taux_non_fact}%</div>}
                    {row && <div style={{ color: C_RED, fontWeight: 700, marginTop: 2 }}>CA manquant : {fmtFcfa(row.ca_manquant_estime)}</div>}
                  </div>
                )
              }} cursor={{ fill: 'rgba(31,59,114,.04)' }} />
              <Bar dataKey="nb" name="Non facturées" radius={[4, 4, 0, 0]} maxBarSize={40}
                label={{ position: 'top', formatter: (v: unknown) => fmtN(Number(v)), fontSize: 9, fill: '#64748b', fontFamily: F_BODY }}>
                {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tableau récapitulatif */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: F_BODY }}>
            Récapitulatif par classe de diamètre
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(r => {
              const color = DIAM_COLORS[r.categorie] ?? '#94a3b8'
              const pctBar = totalNonFact > 0 ? (r.nb_non_fact / totalNonFact) * 100 : 0
              return (
                <div key={r.categorie}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY }}>{r.categorie}</span>
                      <span style={{ fontSize: 9, color: '#94a3b8' }}>{r.taux_non_fact}% du parc</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color, fontFamily: F_TITLE }}>{fmtN(r.nb_non_fact)}</span>
                      <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{Math.round(pctBar)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctBar}%`, background: color, borderRadius: 3, transition: 'width .5s ease' }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, textAlign: 'right' }}>
                    CA estimé : {fmtFcfa(r.ca_manquant_estime)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        * Diamètre extrait de la colonne <code>diametre</code> d&apos;API_CLIENT.
        · Un taux élevé sur les petits diamètres (DN≤15) peut indiquer des raccordements résidentiels mal relevés.
        · Les gros diamètres (DN&gt;50) à fort taux sont prioritaires (impact CA élevé).
      </div>
    </div>
  )
}

/* ══════════════════════ SECTION RETOUR FACTURATION ═════════════════════════ */
function SectionRetourFacturation({ points, tauxMoyen, annee }: { points: RetourPoint[]; tauxMoyen: number; annee: string }) {
  if (!points.length) return (
    <div style={{ padding: '20px', color: 'rgba(31,59,114,.35)', fontSize: 12, fontFamily: F_BODY }}>
      Données insuffisantes — au moins 2 bimestres sont nécessaires pour calculer le taux de retour.
    </div>
  )

  const alertFaible = tauxMoyen < 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Bandeau résumé */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ background: alertFaible ? 'rgba(232,64,64,.06)' : 'rgba(22,163,74,.06)', border: `1px solid ${alertFaible ? 'rgba(232,64,64,.2)' : 'rgba(22,163,74,.2)'}`, borderRadius: 12, padding: '14px 20px', flex: '1 1 200px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: F_BODY }}>Taux moyen de retour</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: F_TITLE, color: alertFaible ? C_RED : '#16a34a', lineHeight: 1 }}>{tauxMoyen}%</div>
          <div style={{ fontSize: 10, color: alertFaible ? C_RED : '#16a34a', fontWeight: 700, marginTop: 4, fontFamily: F_BODY }}>
            {alertFaible ? '⚠ Actions correctives insuffisantes' : '✓ Recouvrement actif'}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 12, padding: '14px 20px', flex: '1 1 200px', boxShadow: '0 1px 4px rgba(31,59,114,.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: F_BODY }}>Meilleure transition</div>
          {(() => {
            const best = [...points].sort((a, b) => b.taux_retour - a.taux_retour)[0]
            return best ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: F_TITLE, color: '#16a34a' }}>{best.taux_retour}%</div>
                <div style={{ fontSize: 11, color: 'rgba(31,59,114,.55)', fontWeight: 600, marginTop: 3, fontFamily: F_BODY }}>{best.label} — {fmtN(best.nb_retour)} retours</div>
              </>
            ) : null
          })()}
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 12, padding: '14px 20px', flex: '1 1 200px', boxShadow: '0 1px 4px rgba(31,59,114,.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: F_BODY }}>Pire transition</div>
          {(() => {
            const worst = [...points].sort((a, b) => a.taux_retour - b.taux_retour)[0]
            return worst ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: F_TITLE, color: C_RED }}>{worst.taux_retour}%</div>
                <div style={{ fontSize: 11, color: 'rgba(31,59,114,.55)', fontWeight: 600, marginTop: 3, fontFamily: F_BODY }}>{worst.label} — {fmtN(worst.nb_absents_prev)} absents</div>
              </>
            ) : null
          })()}
        </div>
      </div>

      {/* Graphique évolution du taux */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontFamily: F_BODY }}>
          Évolution du taux de retour par transition bimestrielle — {annee}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: F_BODY, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }}
              axisLine={false} tickLine={false}
              yAxisId="taux"
            />
            <YAxis
              orientation="right"
              tickFormatter={v => fmtN(Number(v))}
              tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }}
              axisLine={false} tickLine={false}
              yAxisId="nb"
            />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const t  = payload.find(p => p.dataKey === 'taux_retour')
              const nb = payload.find(p => p.dataKey === 'nb_retour')
              const ab = payload.find(p => p.dataKey === 'nb_absents_prev')
              return (
                <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(31,59,114,.12)' }}>
                  <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{label}</div>
                  {t  && <div style={{ color: '#16a34a', fontWeight: 800 }}>Taux de retour : {t.value}%</div>}
                  {nb && <div style={{ color: C_NAVY, marginTop: 2 }}>PDIs retournés : {fmtN(nb.value as number)}</div>}
                  {ab && <div style={{ color: '#94a3b8', marginTop: 2 }}>Absents B(N-1) : {fmtN(ab.value as number)}</div>}
                </div>
              )
            }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontFamily: F_BODY }} />
            <Line yAxisId="taux" type="monotone" dataKey="taux_retour"     name="Taux de retour (%)"  stroke="#16a34a" strokeWidth={2.5} dot={{ r: 5, fill: '#16a34a' }}   activeDot={{ r: 7 }} />
            <Line yAxisId="nb"   type="monotone" dataKey="nb_retour"       name="PDIs retournés"       stroke={C_NAVY}  strokeWidth={2}   dot={{ r: 3, fill: C_NAVY }}   activeDot={{ r: 5 }} strokeDasharray="5 3" />
            <Line yAxisId="nb"   type="monotone" dataKey="nb_absents_prev" name="Absents bim. précéd." stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 2, fill: '#94a3b8' }} activeDot={{ r: 4 }} strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau récapitulatif */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F_BODY }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Transition', 'Absents B(N-1)', 'Retours B(N)', 'Taux retour'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Transition' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '2px solid #f1f5f9', whiteSpace: 'nowrap', fontFamily: F_BODY }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.label} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff' }}>
                <td style={{ padding: '9px 14px', fontWeight: 800, color: C_NAVY }}>B{p.bim_prev}→B{p.bim_curr} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{p.label_prev} → {p.label_curr}</span></td>
                <td style={{ padding: '9px 14px', textAlign: 'right', color: C_RED, fontWeight: 700 }}>{fmtN(p.nb_absents_prev)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmtN(p.nb_retour)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                  <span style={{ fontWeight: 900, color: p.taux_retour >= 30 ? '#16a34a' : p.taux_retour >= 15 ? C_ORANGE : C_RED, fontFamily: F_TITLE, fontSize: 14 }}>{p.taux_retour}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        * <strong>Taux de retour</strong> = PDIs facturés en B(N) qui étaient absents en B(N-1) / total absents en B(N-1).
        · Un taux &lt; 20% signale que peu d&apos;actions correctives ont porté leurs fruits entre deux bimestres.
        · Un taux ≥ 30% est considéré satisfaisant.
      </div>
    </div>
  )
}

/* ═══════════════════════ TABLEAU DÉTAILLÉ ══════════════════════════════════ */
function TablePrises({ rows }: { rows: CaRow[] }) {
  const [sortCol, setSortCol] = useState<keyof CaRow>('ca_manquant_estime')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => {
      const av = a[sortCol] as number | string
      const bv = b[sortCol] as number | string
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  , [rows, sortCol, sortAsc])

  const totalPrises = rows.reduce((s, r) => s + r.nb_prises_non_fact, 0)
  const totalCa     = rows.reduce((s, r) => s + r.ca_manquant_estime, 0)

  function Th({ label, col, align = 'right' }: { label: string; col?: keyof CaRow; align?: 'left' | 'right' | 'center' }) {
    const active = col && sortCol === col
    return (
      <th onClick={() => col && (sortCol === col ? setSortAsc(a => !a) : (setSortCol(col), setSortAsc(false)))}
        style={{ padding: '10px 14px', textAlign: align, fontSize: 10, fontWeight: 700, color: active ? C_NAVY : 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.05em', cursor: col ? 'pointer' : 'default', borderBottom: `2px solid ${active ? C_NAVY : '#f1f5f9'}`, whiteSpace: 'nowrap', userSelect: 'none', fontFamily: F_BODY }}>
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F_BODY }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <Th label="#"                    align="center" />
            <Th label="UO"                   col="uo"                  align="left" />
            <Th label="Prises non fact."     col="nb_prises_non_fact" />
            <Th label="CA moyen / prise"     col="ca_median_par_prise" />
            <Th label="CA manquant estimé"   col="ca_manquant_estime" />
            <Th label="Obs."                 col="nb_obs_stratum" />
            <Th label="Fiabilité"            col="fiabilite"           align="center" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const fib = FIABILITE_CFG[r.fiabilite] ?? FIABILITE_CFG.indicatif
            return (
              <tr key={r.uo} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbff', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f4f7ff')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafbff')}>
                <td style={{ padding: '9px 14px', textAlign: 'center', color: '#cbd5e1', fontSize: 10, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: '9px 14px', fontWeight: 800, color: C_NAVY }}>{r.uo}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: C_RED }}>{fmtN(r.nb_prises_non_fact)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', color: 'rgba(31,59,114,.65)' }}>{fmtFcfa(r.ca_median_par_prise)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 900, color: C_RED, fontFamily: F_TITLE, fontSize: 13 }}>{fmtFcfa(r.ca_manquant_estime)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>{fmtN(r.nb_obs_stratum)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                  <span style={{ background: fib.bg, color: fib.color, fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 99, border: `1px solid ${fib.color}40`, whiteSpace: 'nowrap' }}>
                    ● {fib.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: 'rgba(31,59,114,.04)', borderTop: '2px solid #e2e8f0' }}>
            <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 900, color: C_NAVY, fontSize: 12, fontFamily: F_BODY }}>TOTAL</td>
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: C_RED, fontSize: 13 }}>{fmtN(totalPrises)}</td>
            <td />
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: C_RED, fontFamily: F_TITLE, fontSize: 15 }}>{fmtFcfa(totalCa)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/* ══════════════════════════════ PAGE PRINCIPALE ════════════════════════════ */
export default function RapportPrises() {
  const [annee,    setAnnee]    = useState('2025')
  const [bimestre, setBimestre] = useState('all')
  const [dr,       setDr]       = useState('all')
  const [filtresDispo, setFiltresDispo] = useState<FiltresDispo | null>(null)

  /* ── Onglets + chargement lazy ── */
  const [activeTab, setActiveTab] = useState<TabId>('global')
  const [visited,   setVisited]   = useState<Set<TabId>>(new Set<TabId>(['global']))
  const goTab = useCallback((tab: TabId) => {
    setActiveTab(tab)
    setVisited(prev => { const s = new Set(prev); s.add(tab); return s })
  }, [])

  const [rows,     setRows]     = useState<CaRow[]>([])
  const [tendance, setTendance] = useState<TendancePoint[]>([])
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  /* Ancienneté */
  const [ancDist,    setAncDist]    = useState<AncDist[]>([])
  const [ancUo,      setAncUo]      = useState<AncUo[]>([])
  const [loadingAnc, setLoadingAnc] = useState(true)

  /* Jamais facturées */
  const [jamais,      setJamais]      = useState<JamaisRow[]>([])
  const [jamaisTotal, setJamaisTotal] = useState({ prises: 0, ca: 0 })
  const [loadingJam,  setLoadingJam]  = useState(true)

  /* Variation bimestrielle — facturées / non facturées */
  const [couverture,     setCouverture]     = useState({ fact: 0, nonFact: 0, parc: 0 })
  const [couverturePrev, setCouverturePrev] = useState<{ fact: number; nonFact: number } | null>(null)

  /* Détail ancienneté */
  const [showAncDetail, setShowAncDetail] = useState(false)

  /* Tournées défaillantes */
  const [tournees,       setTournees]       = useState<TourneeRow[]>([])
  const [loadingTournees, setLoadingTournees] = useState(true)

  /* Segmentation diamètres */
  const [diametres,      setDiametres]      = useState<DiametreRow[]>([])
  const [loadingDiam,    setLoadingDiam]     = useState(true)

  /* Taux de retour en facturation */
  const [retourPoints,   setRetourPoints]   = useState<RetourPoint[]>([])
  const [retourMoyen,    setRetourMoyen]    = useState(0)
  const [loadingRetour,  setLoadingRetour]  = useState(true)

  /* ── Charger filtres ── */
  useEffect(() => {
    fetch('/api/carte/filtres')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFiltresDispo(d) })
      .catch(() => {})
  }, [])

  /* ── Fetch données principales ── */
  useEffect(() => {
    setLoading(true); setErr('')
    const p = new URLSearchParams({ annee })
    if (bimestre !== 'all') p.set('bimestre', bimestre)
    if (dr       !== 'all') p.set('dr', dr)

    const pAnnee = new URLSearchParams({ annee })
    if (dr !== 'all') pAnnee.set('dr', dr)

    Promise.all([
      fetch(`/api/carte/ca-manquant?${p}`).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t))),
      fetch(`/api/carte/ca-manquant/tendance?${pAnnee}`).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t))),
    ])
      .then(([ca, tend]) => { setRows(ca.rows ?? []); setTendance(tend.points ?? []); setLoading(false) })
      .catch(e => { setErr(String(e)); setLoading(false) })
  }, [annee, bimestre, dr])

  /* ── Fetch ancienneté — lazy (onglet "anciennete") ── */
  useEffect(() => {
    if (!visited.has('anciennete')) return
    setLoadingAnc(true)
    const p = new URLSearchParams({ annee })
    if (dr !== 'all') p.set('dr', dr)
    fetch(`/api/carte/ca-manquant/anciennete?${p}`)
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(d => { setAncDist(d.distribution ?? []); setAncUo(d.par_uo ?? []); setLoadingAnc(false) })
      .catch(() => setLoadingAnc(false))
  }, [annee, dr, visited])

  /* ── Fetch jamais facturées — lazy (onglet "anciennete") ── */
  useEffect(() => {
    if (!visited.has('anciennete')) return
    setLoadingJam(true)
    const p = new URLSearchParams({ annee })
    if (dr !== 'all') p.set('dr', dr)
    fetch(`/api/carte/ca-manquant/jamais-facturees?${p}`)
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(d => { setJamais(d.par_uo ?? []); setJamaisTotal({ prises: d.total_prises ?? 0, ca: d.total_ca ?? 0 }); setLoadingJam(false) })
      .catch(() => setLoadingJam(false))
  }, [annee, dr, visited])

  /* ── Fetch tournées — lazy (onglet "terrain") ── */
  useEffect(() => {
    if (!visited.has('terrain')) return
    setLoadingTournees(true)
    const p = new URLSearchParams({ annee })
    if (bimestre !== 'all') p.set('bimestre', bimestre)
    if (dr       !== 'all') p.set('dr', dr)
    fetch(`/api/carte/ca-manquant/tournees?${p}`)
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(d => { setTournees(d.tournees ?? []); setLoadingTournees(false) })
      .catch(() => setLoadingTournees(false))
  }, [annee, bimestre, dr, visited])

  /* ── Fetch diamètres — lazy (onglet "terrain") ── */
  useEffect(() => {
    if (!visited.has('terrain')) return
    setLoadingDiam(true)
    const p = new URLSearchParams({ annee })
    if (bimestre !== 'all') p.set('bimestre', bimestre)
    if (dr       !== 'all') p.set('dr', dr)
    fetch(`/api/carte/ca-manquant/diametres?${p}`)
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(d => { setDiametres(d.par_categorie ?? []); setLoadingDiam(false) })
      .catch(() => setLoadingDiam(false))
  }, [annee, bimestre, dr, visited])

  /* ── Fetch taux de retour — lazy (onglet "suivi") ── */
  useEffect(() => {
    if (!visited.has('suivi')) return
    setLoadingRetour(true)
    const p = new URLSearchParams({ annee })
    if (dr !== 'all') p.set('dr', dr)
    fetch(`/api/carte/ca-manquant/retour-facturation?${p}`)
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(d => { setRetourPoints(d.points ?? []); setRetourMoyen(d.taux_moyen ?? 0); setLoadingRetour(false) })
      .catch(() => setLoadingRetour(false))
  }, [annee, dr, visited])

  /* ── Fetch couverture facturation (overview) — courant + bimestre précédent ── */
  useEffect(() => {
    setCouverturePrev(null)
    const p = new URLSearchParams({ annee })
    if (bimestre !== 'all') p.set('bimestre', bimestre)
    if (dr       !== 'all') p.set('dr', dr)

    fetch(`/api/carte/overview?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.secteurs) return
        const s = d.secteurs as Array<{ nb_avec_facture?: number; nb_sans_facture_filtre?: number; nb_total_live?: number; nb_total?: number }>
        const fact    = s.reduce((acc, r) => acc + (r.nb_avec_facture      ?? 0), 0)
        const nonFact = s.reduce((acc, r) => acc + (r.nb_sans_facture_filtre ?? 0), 0)
        const parc    = s.reduce((acc, r) => acc + (r.nb_total_live ?? r.nb_total ?? 0), 0)
        setCouverture({ fact, nonFact, parc })
      })
      .catch(() => {})

    /* Bimestre précédent pour variation */
    if (bimestre !== 'all') {
      const prevBim = parseInt(bimestre) - 1
      if (prevBim >= 1) {
        const pp = new URLSearchParams({ annee, bimestre: String(prevBim) })
        if (dr !== 'all') pp.set('dr', dr)
        fetch(`/api/carte/overview?${pp}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d?.secteurs) return
            const s = d.secteurs as Array<{ nb_avec_facture?: number; nb_sans_facture_filtre?: number }>
            setCouverturePrev({
              fact:    s.reduce((acc, r) => acc + (r.nb_avec_facture      ?? 0), 0),
              nonFact: s.reduce((acc, r) => acc + (r.nb_sans_facture_filtre ?? 0), 0),
            })
          })
          .catch(() => {})
      }
    }
  }, [annee, bimestre, dr])

  /* ── Totaux ── */
  const totalCa    = rows.reduce((s, r) => s + r.ca_manquant_estime, 0)
  const totalPrises = rows.reduce((s, r) => s + r.nb_prises_non_fact, 0)
  const nbUo       = rows.length
  const pireUo     = rows[0]

  /* ── Labels période ── */
  const anneeLabel = annee
  const bimLabel   = bimestre !== 'all' ? (BIMESTRE_LABELS[bimestre] ?? `B${bimestre}`) : 'Toute l\'année'
  const periodeLabel = `${anneeLabel} · ${bimLabel}`

  /* ── Options selects ── */
  const mk  = (arr: string[], all: string) => [{ value: 'all', label: all }, ...arr.map(v => ({ value: v, label: v }))]
  const mkN = (arr: number[], all: string) => [{ value: 'all', label: all }, ...arr.map(n => ({ value: String(n), label: String(n) }))]

  const activeCount = [annee !== '2025', bimestre !== 'all', dr !== 'all'].filter(Boolean).length

  const reset = useCallback(() => { setAnnee('2025'); setBimestre('all'); setDr('all') }, [])

  /* Quand les filtres changent, réduire visited à l'onglet actif
     pour forcer le rechargement des autres onglets à leur prochaine visite */
  useEffect(() => {
    setVisited(new Set<TabId>([activeTab]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annee, bimestre, dr])

  /* ════════════════════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f4f6fb', fontFamily: F_BODY, overflowY: 'auto' }}>
      <style>{`@keyframes spin-rp { to { transform: rotate(360deg); } }`}</style>

      {/* ── Barre de filtres ──────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8edf5', padding: '12px 24px', flexShrink: 0, boxShadow: '0 1px 4px rgba(31,59,114,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>

          <Sel label="Année" value={annee} onChange={setAnnee}
            options={mkN(filtresDispo?.annees ?? [2025, 2024, 2023], 'Toutes les années')} />

          <Sel label="Bimestre" value={bimestre} onChange={setBimestre}
            options={[{ value: 'all', label: 'Tous les bimestres' }, ...Object.entries(BIMESTRE_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />

          <Sel label="Direction Régionale" value={dr} onChange={setDr}
            options={mk(filtresDispo?.drs ?? [], 'Toutes les DR')} />

          {activeCount > 0 && (
            <button onClick={reset}
              style={{ alignSelf: 'flex-end', padding: '7px 12px', borderRadius: 8, border: '1px solid #e8edf5', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C_RED, fontFamily: F_BODY, display: 'flex', alignItems: 'center', gap: 5 }}>
              <XIcon size={11} strokeWidth={2.5} />Réinitialiser
            </button>
          )}

          {!loading && !err && rows.length > 0 && (
            <div style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 10, background: '#f4f6fb', border: '1px solid #e8edf5', fontSize: 11, fontWeight: 600, color: 'rgba(31,59,114,.5)', fontFamily: F_BODY, alignSelf: 'flex-end' }}>
              {periodeLabel} · {nbUo} UO concernées
            </div>
          )}
        </div>
      </div>

      {/* ── Contenu ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {loading && <Loader />}
        {!loading && err && <ErrMsg msg={err} />}

        {!loading && !err && (
          <>
            {/* ══ KPI CARDS — toujours visibles ══ */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard
                label="Prises facturées"
                value={couverture.fact > 0 ? fmtN(couverture.fact) : '—'}
                sub={couverture.parc > 0 ? `${Math.round(couverture.fact / couverture.parc * 100)}% du parc actif` : undefined}
                accent="#16a34a"
                delta={couverturePrev ? { val: couverture.fact - couverturePrev.fact, label: `vs ${BIMESTRE_LABELS[String(parseInt(bimestre) - 1)] ?? 'bim. préc.'}`, positifBon: true } : undefined}
              />
              <KpiCard
                label="Prises non facturées"
                value={couverture.nonFact > 0 ? fmtN(couverture.nonFact) : fmtN(totalPrises)}
                sub="Prises actives sans facture"
                accent={C_NAVY}
                delta={couverturePrev ? { val: couverture.nonFact - couverturePrev.nonFact, label: `vs ${BIMESTRE_LABELS[String(parseInt(bimestre) - 1)] ?? 'bim. préc.'}`, positifBon: false } : undefined}
              />
              <KpiCard label="CA manquant estimé" value={fmtFcfa(totalCa)} sub="Toutes UO confondues" accent={C_RED} />
              <KpiCard label="UOs concernées" value={fmtN(nbUo)} sub="Secteurs avec écart" accent="#7c3aed" />
              {pireUo && <KpiCard label="UO la plus exposée" value={pireUo.uo} sub={fmtFcfa(pireUo.ca_manquant_estime) + ' manquants'} accent={C_RED} />}
              {rows.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', background: 'rgba(150,193,30,.07)', borderRadius: 10, border: '1px solid rgba(150,193,30,.2)', color: '#4a7c10', fontSize: 13, fontWeight: 700, fontFamily: F_BODY }}>
                  ✓ Toutes les prises actives sont facturées — aucun écart détecté
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <>
                {/* ══ BARRE D'ONGLETS ══ */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf5', boxShadow: '0 2px 12px rgba(31,59,114,.06)', overflow: 'hidden', position: 'sticky', top: 0, zIndex: 5 }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                    {TABS.map(tab => {
                      const active = activeTab === tab.id
                      return (
                        <button key={tab.id} onClick={() => goTab(tab.id)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 10px', background: active ? '#fafbff' : 'transparent', border: 'none', borderBottom: `3px solid ${active ? C_NAVY : 'transparent'}`, cursor: 'pointer', transition: 'all .15s', outline: 'none' }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                          <tab.Icon size={14} strokeWidth={active ? 2.5 : 2} />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? C_NAVY : 'rgba(31,59,114,.45)', fontFamily: F_BODY, lineHeight: 1.2 }}>{tab.label}</div>
                            <div style={{ fontSize: 9, color: active ? 'rgba(31,59,114,.5)' : '#cbd5e1', fontFamily: F_BODY, fontWeight: 500 }}>{tab.sub}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ══ ONGLET 1 — Vue globale ══ */}
                {activeTab === 'global' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Alerte top 3 */}
                    {rows.slice(0, 3).some(r => r.ca_manquant_estime > 0) && (
                      <div style={{ background: 'rgba(232,64,64,.05)', border: '1px solid rgba(232,64,64,.2)', borderRadius: 14, padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <TrendingDown size={15} color={C_RED} strokeWidth={2} style={{ flexShrink: 0 }} />
                          <span style={{ fontFamily: F_BODY, fontSize: 12, fontWeight: 800, color: C_RED }}>Top 3 UO les plus exposées — {periodeLabel}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {rows.slice(0, 3).map(r => (
                            <div key={r.uo} style={{ background: '#fff', borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(232,64,64,.15)', boxShadow: '0 1px 4px rgba(232,64,64,.08)' }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: C_NAVY, fontFamily: F_BODY }}>{r.uo}</div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: C_RED, fontFamily: F_TITLE, marginTop: 2 }}>{fmtFcfa(r.ca_manquant_estime)}</div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: C_ORANGE, fontFamily: F_BODY, marginTop: 1 }}>{fmtN(r.nb_prises_non_fact)} prises non facturées</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Graphiques */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <Panel>
                        <PanelHeader title="Top 10 UO — CA manquant estimé" />
                        <div style={{ padding: '16px 12px 12px' }}><ChartTopUo rows={rows} /></div>
                      </Panel>
                      <Panel>
                        <PanelHeader title={`Évolution bimestrielle ${annee}`} />
                        <div style={{ padding: '16px 12px 12px' }}>
                          <ChartTendance points={tendance} annee={annee} />
                          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 6 }}>* Axe gauche = CA manquant (F CFA) · Axe droit = Nombre de prises</div>
                        </div>
                      </Panel>
                    </div>

                    {/* Scatter */}
                    <Panel>
                      <PanelHeader title="Dispersion — Prises non facturées × CA moyen / prise par UO" />
                      <div style={{ padding: '16px 12px 12px' }}>
                        <ChartScatter rows={rows} />
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>* Taille du point proportionnelle au CA manquant estimé</div>
                      </div>
                    </Panel>

                    {/* Tableau complet */}
                    <Panel>
                      <PanelHeader
                        title={`Détail par UO — ${rows.length} secteur${rows.length > 1 ? 's' : ''}`}
                        extra={<ExportBtn onClick={() => exportCsv(rows, `prises-non-facturees_${periodeLabel.replace(/[^a-z0-9]/gi, '_')}.csv`)} />}
                      />
                      <TablePrises rows={rows} />
                      <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', fontSize: 9, color: '#94a3b8', lineHeight: 1.6 }}>
                        * <strong>Méthode :</strong> CA manquant = (Prises actives − Prises facturées) × CA moyen de l&apos;UO.
                        &nbsp;· <strong>Fiabilité :</strong> Haute ≥ 20 obs. · Acceptable ≥ 5 obs. · Indicatif &lt; 5 obs.
                      </div>
                    </Panel>
                  </div>
                )}

                {/* ══ ONGLET 2 — Ancienneté ══ */}
                {activeTab === 'anciennete' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    <Panel>
                      <PanelHeader
                        title="Ancienneté de la non-facturation — Durée d'absence par bimestre"
                        extra={
                          !loadingAnc && ancDist.some(d => d.nb_prises > 0)
                            ? (
                              <button onClick={() => setShowAncDetail(s => !s)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: `1px solid ${showAncDetail ? C_NAVY : '#e8edf5'}`, background: showAncDetail ? C_NAVY : '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: showAncDetail ? '#fff' : C_NAVY, fontFamily: F_BODY, transition: 'all .15s', whiteSpace: 'nowrap' }}>
                                <List size={12} strokeWidth={2.5} />
                                {showAncDetail ? 'Masquer le détail' : 'Détail par prise'}
                              </button>
                            ) : undefined
                        }
                      />
                      <div style={{ padding: '16px 20px' }}>
                        {loadingAnc ? <Loader /> : <SectionAnciennete dist={ancDist} par_uo={ancUo} annee={annee} />}
                      </div>
                      {showAncDetail && !loadingAnc && (
                        <DetailAnciennete key={`${annee}-${dr}`} annee={annee} dr={dr} uoList={ancUo.map(u => u.uo)} />
                      )}
                    </Panel>

                    <Panel>
                      <PanelHeader
                        title={`Prises jamais facturées en ${annee} — Signal critique`}
                        extra={jamais.length > 0
                          ? <ExportBtn onClick={() => exportJamaisCsv(jamais, `jamais-facturees_${annee}${dr !== 'all' ? '_' + dr : ''}.csv`)} />
                          : undefined}
                      />
                      <div style={{ padding: '0' }}>
                        {loadingJam
                          ? <div style={{ padding: '16px 20px' }}><Loader /></div>
                          : <SectionJamaisFacturees rows={jamais} total={jamaisTotal} annee={annee} />}
                      </div>
                    </Panel>
                  </div>
                )}

                {/* ══ ONGLET 3 — Terrain ══ */}
                {activeTab === 'terrain' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Panel>
                      <PanelHeader title="Tournées défaillantes — Prises non facturées par tournée de relevé" />
                      <div style={{ padding: '16px 20px' }}>
                        {loadingTournees ? <Loader /> : <SectionTournees rows={tournees} />}
                      </div>
                    </Panel>
                    <Panel>
                      <PanelHeader title="Segmentation par diamètre de compteur" />
                      <div style={{ padding: '16px 20px' }}>
                        {loadingDiam ? <Loader /> : <SectionDiametres rows={diametres} />}
                      </div>
                    </Panel>
                  </div>
                )}

                {/* ══ ONGLET 4 — Suivi & Retour ══ */}
                {activeTab === 'suivi' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Panel>
                      <PanelHeader title={`Taux de retour en facturation — Efficacité des actions correctives ${annee}`} />
                      <div style={{ padding: '16px 20px' }}>
                        {loadingRetour ? <Loader /> : <SectionRetourFacturation points={retourPoints} tauxMoyen={retourMoyen} annee={annee} />}
                      </div>
                    </Panel>
                  </div>
                )}

              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
