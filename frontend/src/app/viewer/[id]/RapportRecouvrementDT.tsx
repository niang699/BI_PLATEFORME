'use client'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AlertTriangle, Check, X as XIcon, TrendingDown } from 'lucide-react'

/* ═══════════════════════════════ TYPES ════════════════════════════════════ */
interface Filtres {
  annee: string; bimestre: string; categorie_rgp: string
  dr: string; uo: string
  groupe_facturation: string[]
  cat_branchement: string[]
  type_facture: string
  statut_facture: string
}

interface FiltresOpts {
  annees: number[]
  bimestres: number[]
  categories_rgp: string[]
  directions: string[]
  unites: string[]
  groupes_facturation: string[]
  categories_branchement: string[]
  types_facture: string[]
  statuts: string[]
}

interface DtRow {
  dr: string
  nb_factures: number
  ca_total: number
  encaissement: number
  impaye: number
  taux_recouvrement: number
  taux_impaye: number
  a_risque: boolean
  ecart_objectif: number
}

interface BimRow {
  bimestre: number
  annee: number
  nb_factures: number
  ca_total: number
  encaissement: number
  taux_recouvrement: number
}

interface KpisData {
  ca_total: number
  encaissement: number
  impaye: number
  taux_recouvrement: number
  taux_impaye: number
  nb_factures: number
  nb_dr: number
  objectif_taux: number
  par_dr: DtRow[]
  par_bimestre: BimRow[]
  dts_a_risque: DtRow[]
  meilleure_dt: { direction_territoriale: string; taux_recouvrement: number } | null
  pire_dt:      { direction_territoriale: string; taux_recouvrement: number } | null
  filters: { annee: number | null; bimestre: number | null }
}

/* ═══════════════════════════════ STYLES ═══════════════════════════════════ */
const F_TITLE  = "'Barlow Semi Condensed', sans-serif"
const F_BODY   = "'Nunito', sans-serif"
const C_NAVY   = '#1F3B72'
const C_GREEN  = '#96C11E'
const C_RED    = '#E84040'
const C_ORANGE = '#d97706'
const OBJECTIF = 98.5

const INIT: Filtres = {
  annee: '2025', bimestre: 'all', categorie_rgp: 'all',
  dr: 'all', uo: 'all',
  groupe_facturation: [], cat_branchement: [],
  type_facture: 'all', statut_facture: 'all',
}

/* ═══════════════════════════════ HELPERS ══════════════════════════════════ */
const fmtM   = (v: number) => (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M'
const fmtMds = (v: number) => (v / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Mds'
function fmtFcfa(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return fmtMds(v)
  if (Math.abs(v) >= 1_000_000)     return fmtM(v)
  return v.toLocaleString('fr-FR') + ' F'
}
const fmtPct = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + '%'
const fmtN   = (v: number) => v.toLocaleString('fr-FR')

function tauxColor(t: number) {
  if (t >= OBJECTIF) return { bg: 'rgba(150,193,30,.12)', color: '#4a7c10' }
  return { bg: 'rgba(232,64,64,.10)', color: C_RED }
}

const BIMESTRE_LABELS: Record<number, string> = {
  1: 'B1 Jan-Fév', 2: 'B2 Mar-Avr', 3: 'B3 Mai-Juin',
  4: 'B4 Jul-Août', 5: 'B5 Sep-Oct', 6: 'B6 Nov-Déc',
}

function exportCsv(rows: DtRow[], filename: string) {
  const headers = [
    'Direction Régionale', 'Nb Factures', 'CA Total (FCFA)', 'Encaissement (FCFA)',
    'Impayés (FCFA)', 'Taux Impayé (%)', 'Taux Recouvrement (%)', 'Écart Objectif (pt)', 'Sous Objectif',
  ]
  const lines = rows.map(r => [
    `"${r.dr}"`,
    r.nb_factures,
    r.ca_total.toFixed(0),
    r.encaissement.toFixed(0),
    r.impaye.toFixed(0),
    r.taux_impaye.toFixed(1),
    r.taux_recouvrement.toFixed(1),
    r.ecart_objectif.toFixed(1),
    r.a_risque ? 'Oui' : 'Non',
  ].join(';'))
  const bom     = '\uFEFF'
  const content = bom + [headers.join(';'), ...lines].join('\r\n')
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url     = URL.createObjectURL(blob)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildParams(f: Filtres): string {
  const p = new URLSearchParams()
  if (f.annee         !== 'all') p.set('annee',         f.annee)
  if (f.bimestre      !== 'all') p.set('bimestre',      f.bimestre)
  if (f.categorie_rgp !== 'all') p.set('categorie_rgp', f.categorie_rgp)
  if (f.dr            !== 'all') p.set('dr',            f.dr)
  if (f.uo            !== 'all') p.set('uo',            f.uo)
  if (f.type_facture   !== 'all') p.set('type_facture',   f.type_facture)
  if (f.statut_facture !== 'all') p.set('statut_facture', f.statut_facture)
  f.groupe_facturation.forEach(v => p.append('groupe_facturation', v))
  f.cat_branchement.forEach(v   => p.append('cat_branchement', v))
  return p.toString()
}

/* ═══════════════════════════════ UI ATOMS ═════════════════════════════════ */
function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', flex: '1 1 150px', minWidth: 130 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, fontFamily: F_TITLE, color: accent ?? C_NAVY, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 4, fontFamily: F_BODY }}>{sub}</div>}
    </div>
  )
}

function TauxBadge({ v }: { v: number }) {
  const s  = tauxColor(v)
  const ok = v >= OBJECTIF
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {ok ? <Check size={10} strokeWidth={2.5} /> : <XIcon size={10} strokeWidth={2.5} />}{fmtPct(v)}
    </span>
  )
}

function EcartBadge({ v }: { v: number }) {
  const ok    = v >= 0
  const color = ok ? '#4a7c10' : C_RED
  const sign  = ok ? '+' : ''
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: F_BODY }}>
      {sign}{v.toFixed(1)} pt
    </span>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', color: 'rgba(31,59,114,.45)', fontSize: 13, fontFamily: F_BODY }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-rdt 0.8s linear infinite', flexShrink: 0 }} />
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
      <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e8edf5', fontSize: 12, fontWeight: 600, fontFamily: F_BODY, color: C_NAVY, background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 130 }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

function MultiSel({ label, values, onChange, options }: {
  label: string; values: string[]; onChange: (v: string[]) => void; options: string[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])

  const displayText = values.length === 0 ? 'Tous'
    : values.length === 1 ? values[0]
    : `${values.length} sélectionnés`
  const hasValue = values.length > 0

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }}>{label}</span>
      <button onClick={() => setOpen(p => !p)} style={{ padding: '6px 9px 6px 10px', borderRadius: 8, border: `1px solid ${hasValue ? C_NAVY : '#e8edf5'}`, background: hasValue ? '#eef2ff' : '#fff', fontSize: 12, fontWeight: 600, fontFamily: F_BODY, color: hasValue ? C_NAVY : 'rgba(31,59,114,.55)', cursor: 'pointer', outline: 'none', minWidth: 150, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{displayText}</span>
        <span style={{ fontSize: 9, opacity: .6, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, boxShadow: '0 8px 28px rgba(31,59,114,.12)', minWidth: 220, maxHeight: 260, overflowY: 'auto', padding: '6px 0' }}>
          <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
            <button onClick={() => onChange(options)} style={{ fontSize: 10, fontWeight: 700, color: C_NAVY, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F_BODY, padding: 0 }}>Tout</button>
            <span style={{ color: '#e8edf5' }}>|</span>
            <button onClick={() => onChange([])} style={{ fontSize: 10, fontWeight: 700, color: C_RED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F_BODY, padding: 0 }}>Aucun</button>
          </div>
          {options.map(o => (
            <label key={o} onClick={() => toggle(o)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontFamily: F_BODY, color: values.includes(o) ? C_NAVY : 'rgba(31,59,114,.65)', background: values.includes(o) ? 'rgba(31,59,114,.04)' : 'transparent', fontWeight: values.includes(o) ? 700 : 500, transition: 'background .1s' }}>
              <span style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, border: `2px solid ${values.includes(o) ? C_NAVY : '#d1d9e6'}`, background: values.includes(o) ? C_NAVY : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {values.includes(o) && <Check size={9} color="#fff" strokeWidth={3} />}
              </span>
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════ CLASSEMENT DR ════════════════════════════════════ */
function ChartClassementDR({ rows }: { rows: DtRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const sorted = [...rows].sort((a, b) => b.taux_recouvrement - a.taux_recouvrement)
  if (!sorted.length) return null

  const maxVal = Math.max(100, ...sorted.map(r => r.taux_recouvrement))
  const objPct = ((OBJECTIF / maxVal) * 100).toFixed(2)
  const rankColors = ['#F59E0B', '#94A3B8', '#CD7F32']

  const barColor = (t: number, risk: boolean) => {
    if (!risk)   return { from: '#4ade80', to: '#16a34a' }
    if (t >= 80) return { from: '#fbbf24', to: C_ORANGE }
    return         { from: '#f87171', to: C_RED }
  }

  return (
    <Panel>
      <style>{`
        @keyframes tipIn { from { opacity:0;transform:translateY(6px) scale(.97); } to { opacity:1;transform:translateY(0) scale(1); } }
      `}</style>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ width: 4, height: 18, borderRadius: 99, background: C_NAVY, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontFamily: F_BODY, fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Classement Taux de Recouvrement — par DR · Objectif {OBJECTIF}%
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sorted.map((r, i) => {
            const t   = r.taux_recouvrement
            const pct = (t / maxVal) * 100
            const { from, to } = barColor(t, r.a_risque)
            const isHov = hovered === i

            return (
              <div key={r.dr} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>

                <div style={{ width: 28, textAlign: 'center', flexShrink: 0, fontSize: 11, fontWeight: 900, color: i < 3 ? rankColors[i] : 'rgba(31,59,114,.3)', fontFamily: F_BODY }}>
                  {i < 3 ? `#${i + 1}` : `${i + 1}`}
                </div>

                <div style={{ minWidth: 0, flex: '0 0 200px', maxWidth: 220, fontSize: 11.5, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.dr}
                </div>

                <div style={{ width: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.a_risque && <AlertTriangle size={12} color={C_RED} strokeWidth={2} />}
                </div>

                <div style={{ flex: 1, position: 'relative', height: 26, cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', inset: 0, background: '#f0f3f9', borderRadius: 99 }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: `calc(${objPct}% - 1px)`, background: 'rgba(31,59,114,.22)', zIndex: 2 }} />
                  <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: `${pct}%`, background: `linear-gradient(90deg,${from},${to})`, borderRadius: 99, zIndex: 1, boxShadow: r.a_risque ? '0 2px 8px rgba(232,64,64,.22)' : '0 2px 8px rgba(22,163,74,.28)', transition: 'filter .15s', filter: isHov ? 'brightness(1.12)' : 'none' }} />
                </div>

                <div style={{ width: 54, textAlign: 'right', flexShrink: 0, fontSize: 12.5, fontWeight: 800, fontFamily: F_TITLE, color: r.a_risque ? C_RED : '#16a34a' }}>
                  {fmtPct(t)}
                </div>

                {isHov && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: 250, zIndex: 100, minWidth: 270, background: 'linear-gradient(145deg,rgba(10,18,42,.97),rgba(18,30,60,.97))', backdropFilter: 'blur(24px)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 24px 60px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.07)', borderTop: `3px solid ${to}`, animation: 'tipIn .15s ease', pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', bottom: -7, left: 22, width: 14, height: 7, background: 'rgba(18,30,60,.97)', clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: i < 3 ? rankColors[i] : 'rgba(255,255,255,.4)', fontFamily: F_TITLE, lineHeight: 1 }}>#{i + 1}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: F_TITLE, lineHeight: 1.1 }}>{r.dr}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>Direction Régionale</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                      <span style={{ fontSize: 28, fontWeight: 900, fontFamily: F_TITLE, color: to, lineHeight: 1 }}>{fmtPct(t)}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', padding: '4px 9px', borderRadius: 99, background: r.a_risque ? 'rgba(248,113,113,.12)' : 'rgba(74,222,128,.12)', color: r.a_risque ? '#f87171' : '#4ade80', border: `1px solid ${r.a_risque ? 'rgba(248,113,113,.25)' : 'rgba(74,222,128,.25)'}` }}>
                        {r.a_risque ? `SOUS OBJECTIF (${r.ecart_objectif.toFixed(1)} pt)` : 'OBJECTIF ATTEINT'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                      {[
                        { label: 'CA Total', value: fmtFcfa(r.ca_total), color: '#94a3c8' },
                        { label: 'Encaissé', value: fmtFcfa(r.encaissement), color: '#4ade80' },
                        { label: 'Impayés',  value: fmtFcfa(r.impaye), color: '#f87171' },
                      ].map(k => (
                        <div key={k.label}>
                          <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,.28)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{k.label}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: k.color, fontFamily: F_TITLE }}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 18, height: 2, background: 'rgba(31,59,114,.22)', borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>Objectif {OBJECTIF}%</span>
          </div>
          {[
            { color: '#16a34a', label: `≥ ${OBJECTIF}%` },
            { color: C_ORANGE,  label: `80–${OBJECTIF}%` },
            { color: C_RED,     label: '< 80%' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={11} color="rgba(31,59,114,.4)" strokeWidth={2} />
            <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>Sous objectif</span>
          </div>
        </div>
      </div>
    </Panel>
  )
}

/* ═══════════════════════ ÉVOLUTION BIMESTRIELLE ═══════════════════════════ */
function ChartEvolution({ rows }: { rows: BimRow[] }) {
  const sorted  = [...rows].sort((a, b) => a.bimestre - b.bimestre)
  if (!sorted.length) return null
  const maxTaux = Math.max(100, ...sorted.map(r => r.taux_recouvrement))
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <Panel>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ width: 4, height: 18, borderRadius: 99, background: C_GREEN, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontFamily: F_BODY, fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Évolution du taux de recouvrement par bimestre
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160, paddingBottom: 8 }}>
          {sorted.map((r, i) => {
            const taux      = r.taux_recouvrement
            const heightPct = (taux / maxTaux) * 100
            const ok        = taux >= OBJECTIF
            const isHov     = hovered === i
            const color     = ok ? C_GREEN : taux >= 80 ? C_ORANGE : C_RED

            return (
              <div key={r.bimestre} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                {isHov && (
                  <div style={{ position: 'absolute', bottom: '100%', marginBottom: 4, background: '#fff', border: `1px solid ${color}`, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, color, fontFamily: F_TITLE, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(31,59,114,.12)', zIndex: 10 }}>
                    {fmtPct(taux)}
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(31,59,114,.45)', marginTop: 2 }}>{fmtFcfa(r.ca_total)}</div>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: `${(OBJECTIF / maxTaux) * 100}%`, left: 0, right: 0, borderTop: '1px dashed rgba(31,59,114,.15)', zIndex: 0 }} />
                <div style={{ width: '100%', height: `${heightPct}%`, background: `linear-gradient(180deg,${color},${color}88)`, borderRadius: '6px 6px 0 0', transition: 'filter .15s', filter: isHov ? 'brightness(1.1)' : 'none', minHeight: 4, cursor: 'pointer', position: 'relative', zIndex: 1 }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.5)', fontFamily: F_BODY, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {BIMESTRE_LABELS[r.bimestre] ?? `B${r.bimestre}`}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ width: 18, height: 1, borderTop: '1px dashed rgba(31,59,114,.25)' }} />
          <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>Objectif {OBJECTIF}%</span>
        </div>
      </div>
    </Panel>
  )
}

/* ═══════════════════════ TABLEAU DÉTAILLÉ PAR DR ══════════════════════════ */
function TableDR({ rows }: { rows: DtRow[] }) {
  const [sort, setSort] = useState<{ key: keyof DtRow; asc: boolean }>({ key: 'taux_recouvrement', asc: false })

  const sorted = [...rows].sort((a, b) => {
    const va = a[sort.key] as number
    const vb = b[sort.key] as number
    return sort.asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
  })

  const th = (label: string, key: keyof DtRow) => {
    const active = sort.key === key
    return (
      <th key={key} onClick={() => setSort(p => ({ key, asc: p.key === key ? !p.asc : false }))}
        style={{ padding: '9px 14px', textAlign: key === 'dr' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: active ? C_NAVY : 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e8edf5', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', background: active ? '#f0f4ff' : '#f4f6fb' }}>
        {label} {active ? (sort.asc ? '▲' : '▼') : ''}
      </th>
    )
  }

  if (!rows.length) return <div style={{ padding: '16px 20px', fontSize: 13, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }}>Aucune donnée</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F_BODY, fontSize: 12 }}>
        <thead>
          <tr>
            {th('Direction Régionale', 'dr')}
            {th('Factures', 'nb_factures')}
            {th('CA Total', 'ca_total')}
            {th('Encaissé', 'encaissement')}
            {th('Impayés', 'impaye')}
            {th('Taux Impayé', 'taux_impaye')}
            {th('Taux Recvt', 'taux_recouvrement')}
            {th('Écart Objectif', 'ecart_objectif')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.dr} style={{ background: r.a_risque ? 'rgba(232,64,64,.035)' : (i % 2 === 0 ? '#fff' : '#fafbfd') }}>
              <td style={{ padding: '9px 14px', fontWeight: 800, color: C_NAVY, whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {r.a_risque && <span title="Sous objectif" style={{ display: 'flex' }}><AlertTriangle size={12} color={C_RED} strokeWidth={2} style={{ flexShrink: 0 }} /></span>}
                  {r.dr}
                </div>
              </td>
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 500, color: 'rgba(31,59,114,.7)' }}>{fmtN(r.nb_factures)}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 500, color: 'rgba(31,59,114,.7)', whiteSpace: 'nowrap' }}>{fmtFcfa(r.ca_total)}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: '#4a7c10', whiteSpace: 'nowrap' }}>{fmtFcfa(r.encaissement)}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: r.impaye > 0 ? C_RED : 'rgba(31,59,114,.3)', whiteSpace: 'nowrap' }}>{fmtFcfa(r.impaye)}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: r.taux_impaye > 10 ? C_RED : C_ORANGE }}>{fmtPct(r.taux_impaye)}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right' }}><TauxBadge v={r.taux_recouvrement} /></td>
              <td style={{ padding: '9px 14px', textAlign: 'right' }}><EcartBadge v={r.ecart_objectif} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ══════════════════════════ COMPOSANT PRINCIPAL ═══════════════════════════ */
export default function RapportRecouvrementDT() {
  const [filtres,  setFiltres]  = useState<Filtres>(INIT)
  const [opts,     setOpts]     = useState<FiltresOpts | null>(null)
  const [unitesDr, setUnitesDr] = useState<string[] | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [data,     setData]     = useState<KpisData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')
  const abortRef = useRef<AbortController | null>(null)

  /* Charger options filtres au montage */
  useEffect(() => {
    fetch('/api/filtres').then(r => r.ok ? r.json() : null).then(d => { if (d) setOpts(d) }).catch(() => {})
  }, [])

  /* Cascade DR → UO */
  useEffect(() => {
    if (filtres.dr === 'all') {
      setUnitesDr(null)
      setFiltres(p => ({ ...p, uo: 'all' }))
      return
    }
    fetch(`/api/filtres?dr=${encodeURIComponent(filtres.dr)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.unites) { setUnitesDr(d.unites); setFiltres(p => ({ ...p, uo: 'all' })) } })
      .catch(() => {})
  }, [filtres.dr])

  const unitesDisplay = unitesDr ?? opts?.unites ?? []

  const set  = useCallback((k: keyof Filtres) => (v: string)   => setFiltres(p => ({ ...p, [k]: v })), [])
  const setM = useCallback((k: keyof Filtres) => (v: string[]) => setFiltres(p => ({ ...p, [k]: v })), [])

  const qs = useMemo(() => buildParams(filtres), [filtres])

  /* Compteur filtres actifs */
  const activeCount = [
    filtres.annee !== 'all', filtres.bimestre !== 'all', filtres.categorie_rgp !== 'all',
    filtres.dr !== 'all', filtres.uo !== 'all', filtres.type_facture !== 'all',
    filtres.statut_facture !== 'all',
    filtres.groupe_facturation.length > 0, filtres.cat_branchement.length > 0,
  ].filter(Boolean).length

  const mk  = (arr: string[], all: string) => [{ value: 'all', label: all }, ...arr.map(v => ({ value: v, label: v }))]
  const mkN = (arr: number[], all: string) => [{ value: 'all', label: all }, ...arr.map(n => ({ value: String(n), label: String(n) }))]

  /* Fetch données KPIs */
  useEffect(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true); setErr('')
    fetch(`/api/facturation/kpis?${qs}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(e.error)))
      .then((d: KpisData) => { setData(d); setLoading(false) })
      .catch(e => { if ((e as { name?: string }).name !== 'AbortError') { setErr(String(e)); setLoading(false) } })
  }, [qs])

  const d = data
  const anneeLabel = filtres.annee !== 'all' ? filtres.annee : (d?.filters?.annee ? String(d.filters.annee) : '')
  const bimLabel   = filtres.bimestre !== 'all' ? (BIMESTRE_LABELS[Number(filtres.bimestre)] ?? `B${filtres.bimestre}`) : 'Toute l\'année'
  const periodeLabel = anneeLabel ? `${anneeLabel} · ${bimLabel}` : bimLabel

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f4f6fb', fontFamily: F_BODY, overflowY: 'auto' }}>
      <style>{`@keyframes spin-rdt { to { transform:rotate(360deg); } }`}</style>

      {/* ── Barre de filtres ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8edf5', padding: '12px 24px', flexShrink: 0, boxShadow: '0 1px 4px rgba(31,59,114,.04)' }}>

        {/* Filtres principaux */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <Sel label="Année" value={filtres.annee} onChange={set('annee')}
            options={mkN(opts?.annees ?? [], 'Toutes les années')} />
          <Sel label="Bimestre" value={filtres.bimestre} onChange={set('bimestre')}
            options={[{ value: 'all', label: 'Tous les bimestres' }, ...Object.entries(BIMESTRE_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
          <Sel label="Catégorie RGP" value={filtres.categorie_rgp} onChange={set('categorie_rgp')}
            options={mk(opts?.categories_rgp ?? [], 'Toutes catégories')} />

          <button onClick={() => setAdvanced(p => !p)} style={{ alignSelf: 'flex-end', padding: '7px 12px', borderRadius: 8, border: `1px solid ${advanced ? C_NAVY : '#e8edf5'}`, background: advanced ? '#eef2ff' : '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: advanced ? C_NAVY : 'rgba(31,59,114,.45)', fontFamily: F_BODY, display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s' }}>
            Filtres avancés
            {activeCount > 3 && <span style={{ background: C_NAVY, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>{activeCount - 3}</span>}
            <span style={{ fontSize: 10 }}>{advanced ? '▲' : '▼'}</span>
          </button>

          {activeCount > 0 && (
            <button onClick={() => { setFiltres(INIT); setUnitesDr(null) }} style={{ alignSelf: 'flex-end', padding: '7px 12px', borderRadius: 8, border: '1px solid #e8edf5', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C_RED, fontFamily: F_BODY, display: 'flex', alignItems: 'center', gap: 5 }}>
              <XIcon size={11} strokeWidth={2.5} />Réinitialiser
            </button>
          )}

          {d && !loading && (
            <div style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 10, background: '#f4f6fb', border: '1px solid #e8edf5', fontSize: 11, fontWeight: 600, color: 'rgba(31,59,114,.5)', fontFamily: F_BODY, alignSelf: 'flex-end' }}>
              {periodeLabel} · {d.nb_dr} DR
            </div>
          )}
        </div>

        {/* Filtres avancés */}
        {advanced && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8edf5' }}>
            <Sel label="DR" value={filtres.dr} onChange={set('dr')}
              options={mk(opts?.directions ?? [], 'Toutes les DR')} />
            <Sel label="Secteur (UO)" value={filtres.uo} onChange={set('uo')}
              options={mk(unitesDisplay, filtres.dr !== 'all' ? `Tous les secteurs (${unitesDisplay.length})` : 'Tous les secteurs')} />
            <MultiSel label="Groupe Facturation" values={filtres.groupe_facturation}
              onChange={setM('groupe_facturation')} options={opts?.groupes_facturation ?? []} />
            <MultiSel label="Cat. Branchement" values={filtres.cat_branchement}
              onChange={setM('cat_branchement')} options={opts?.categories_branchement ?? []} />
            <Sel label="Type de Facture" value={filtres.type_facture} onChange={set('type_facture')}
              options={mk(opts?.types_facture ?? [], 'Tous les types')} />
            <Sel label="Statut Facture" value={filtres.statut_facture} onChange={set('statut_facture')}
              options={mk(opts?.statuts ?? [], 'Tous les statuts')} />
          </div>
        )}
      </div>

      {/* ── Contenu ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading && <Loader />}
        {!loading && err && <ErrMsg msg={err} />}
        {!loading && !err && d && (
          <>
            {/* KPI cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard label="Taux de Recouvrement" value={fmtPct(d.taux_recouvrement)}
                sub={`Objectif : ${OBJECTIF}%`}
                accent={tauxColor(d.taux_recouvrement).color} />
              <KpiCard label="Chiffre d'Affaires" value={fmtFcfa(d.ca_total)} sub="TTC" />
              <KpiCard label="Encaissements" value={fmtFcfa(d.encaissement)} sub="réglés" accent={C_GREEN} />
              <KpiCard label="Impayés" value={fmtFcfa(d.impaye)} sub="solde" accent={C_RED} />
              <KpiCard label="DR sous objectif" value={String(d.dts_a_risque.length)}
                sub={`sur ${d.nb_dr} DR`}
                accent={d.dts_a_risque.length > 0 ? C_RED : '#4a7c10'} />
              {d.meilleure_dt && (
                <KpiCard label="Meilleure DR" value={fmtPct(d.meilleure_dt.taux_recouvrement)}
                  sub={d.meilleure_dt.direction_territoriale} accent="#16a34a" />
              )}
              {d.pire_dt && (
                <KpiCard label="DR à améliorer" value={fmtPct(d.pire_dt.taux_recouvrement)}
                  sub={d.pire_dt.direction_territoriale} accent={C_RED} />
              )}
            </div>

            {/* Alerte DTs à risque */}
            {d.dts_a_risque.length > 0 && (
              <div style={{ background: 'rgba(232,64,64,.05)', border: '1px solid rgba(232,64,64,.2)', borderRadius: 14, padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <TrendingDown size={15} color={C_RED} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <span style={{ fontFamily: F_BODY, fontSize: 12, fontWeight: 800, color: C_RED }}>
                    {d.dts_a_risque.length} DR en dessous de l&apos;objectif {OBJECTIF}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {d.dts_a_risque.map(dt => (
                    <div key={dt.dr} style={{ background: '#fff', borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(232,64,64,.15)', boxShadow: '0 1px 4px rgba(232,64,64,.08)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C_NAVY, fontFamily: F_BODY }}>{dt.dr}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: C_RED, fontFamily: F_TITLE, marginTop: 2 }}>{fmtPct(dt.taux_recouvrement)}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C_ORANGE, fontFamily: F_BODY }}>{dt.ecart_objectif.toFixed(1)} pt sous objectif</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classement DR */}
            <ChartClassementDR rows={d.par_dr} />

            {/* Évolution bimestrielle */}
            {d.par_bimestre.length > 1 && <ChartEvolution rows={d.par_bimestre} />}

            {/* Tableau détaillé */}
            <Panel>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 4, height: 18, borderRadius: 99, background: C_NAVY, display: 'inline-block', flexShrink: 0 }} />
                <SectionTitle>Détail par Direction Régionale</SectionTitle>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => exportCsv(d.par_dr, `recouvrement-dt_${periodeLabel.replace(/[^a-z0-9]/gi, '_')}.csv`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #e8edf5', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, transition: 'all .15s', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = C_NAVY }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff';    e.currentTarget.style.borderColor = '#e8edf5' }}
                    title="Exporter en CSV (Excel)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Exporter CSV
                  </button>
                </div>
              </div>
              <TableDR rows={d.par_dr} />
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}
