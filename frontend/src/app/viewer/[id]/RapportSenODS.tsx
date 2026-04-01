'use client'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AlertTriangle, Check, X as XIcon } from 'lucide-react'

/* ═══════════════════════════════ TYPES ════════════════════════════════════ */
interface Filtres {
  annee: string; bimestre: string; categorie_rgp: string
  dr: string; uo: string
  groupe_facturation: string[]   // multi
  cat_branchement: string[]      // multi
  type_facture: string
  statut_facture: string
}

interface FiltresOpts {
  annees: number[]
  bimestres: number[]
  categories_rgp: string[]
  directions: string[]
  unites: string[]           // liste complète (tous DR)
  groupes_facturation: string[]
  categories_branchement: string[]
  types_facture: string[]
  statuts: string[]
}

interface AggrRow {
  dr?: string; groupe?: string; type_facture?: string; cat_branchement?: string
  bimestre?: number; annee?: number; statut_facture?: string
  nb_factures: number; ca_total: number; encaissement?: number
  impaye?: number; taux_recouvrement?: number; montant_regle?: number
}

interface KpisData { nb_factures: number; ca_total: number; encaissement: number; impaye: number; taux_recouvrement: number; nb_dr: number }
interface RecapData {
  kpis: KpisData
  kpis_prev: Omit<KpisData, 'nb_dr'> | null
  prev_label: string | null
  par_dr: AggrRow[]; par_bimestre: AggrRow[]
}

interface CaData {
  par_groupe: AggrRow[]; par_type: AggrRow[]; par_branchement: AggrRow[]; par_dr: AggrRow[]
}

interface AgingRow {
  dr?: string
  nb_factures: number; ca_total: number; total_regle: number
  a_j: number; a_jp15: number; a_jp30: number; a_jp45: number
  a_jp60: number; a_jp75: number; a_jp90: number; a_js90: number
}

interface ReglementsData {
  global: AgingRow
  par_dr: AgingRow[]
  par_statut: { statut_facture: string; nb_factures: number; ca_total: number; montant_regle: number; impaye: number }[]
}

interface ImpayeGlobal { nb_factures: number; impaye_total: number; ca_total: number; taux_impaye: number }
interface ImpayeRow { dr?: string; groupe?: string; cat_branchement?: string; statut_facture?: string; nb_factures: number; impaye_total: number; ca_total?: number; taux_impaye?: number }
interface ImpayesData {
  global: ImpayeGlobal
  par_dr: ImpayeRow[]; par_statut: ImpayeRow[]; par_groupe: ImpayeRow[]; par_branchement: ImpayeRow[]
}

/* ═══════════════════════════════ CACHE ════════════════════════════════════ */
// Cache module-level : survit aux remontages de composants (changements d'onglet).
// Clé = URL complète. Vidé uniquement au rechargement de page.
const _fetchCache = new Map<string, unknown>()

function useCachedFetch<T>(url: string): { data: T | null; loading: boolean; err: string } {
  const [data, setData]       = useState<T | null>(() => (_fetchCache.get(url) as T) ?? null)
  const [loading, setLoading] = useState(!_fetchCache.has(url))
  const [err, setErr]         = useState('')

  useEffect(() => {
    if (_fetchCache.has(url)) {
      setData(_fetchCache.get(url) as T)
      setLoading(false)
      setErr('')
      return
    }
    setLoading(true); setErr('')
    fetch(url)
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(e.error)))
      .then((d: T) => { _fetchCache.set(url, d); setData(d) })
      .catch((e: string) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [url])

  return { data, loading, err }
}

/* ═══════════════════════════════ STYLES ═══════════════════════════════════ */
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_GREEN = '#96C11E'
const C_RED   = '#E84040'
const C_ORANGE = '#d97706'

/* ═══════════════════════════════ HELPERS ══════════════════════════════════ */
const fmtM  = (v: number) => (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M'
const fmtMds = (v: number) => (v / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Mds'
function fmtFcfa(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return fmtMds(v)
  if (Math.abs(v) >= 1_000_000)     return fmtM(v)
  return v.toLocaleString('fr-FR') + ' F'
}
const fmtPct = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + '%'
const fmtN   = (v: number) => v.toLocaleString('fr-FR')

const OBJECTIF_TAUX = 98.5

function tauxColor(t: number) {
  if (t >= OBJECTIF_TAUX) return { bg: 'rgba(150,193,30,.12)', color: '#4a7c10' }
  return { bg: 'rgba(232,64,64,.10)', color: C_RED }
}

const BIMESTRE_LABELS: Record<number, string> = {
  1: 'B1 Janv-Févr', 2: 'B2 Mars-Avr', 3: 'B3 Mai-Juin',
  4: 'B4 Juil-Août', 5: 'B5 Sept-Oct', 6: 'B6 Nov-Déc',
}

function buildParams(f: Filtres) {
  const p = new URLSearchParams()
  if (f.annee         !== 'all') p.set('annee',        f.annee)
  if (f.bimestre      !== 'all') p.set('bimestre',     f.bimestre)
  if (f.categorie_rgp !== 'all') p.set('categorie_rgp', f.categorie_rgp)
  if (f.dr            !== 'all') p.set('dr',           f.dr)
  if (f.uo            !== 'all') p.set('uo',           f.uo)
  if (f.type_facture   !== 'all') p.set('type_facture',   f.type_facture)
  if (f.statut_facture !== 'all') p.set('statut_facture', f.statut_facture)
  f.groupe_facturation.forEach(v => p.append('groupe_facturation', v))
  f.cat_branchement.forEach(v   => p.append('cat_branchement', v))
  return p.toString()
}

/* ═══════════════════════════════ UI ATOMS ═════════════════════════════════ */
interface DeltaInfo { text: string; color: string; arrow: string }

function KpiCard({ label, value, sub, accent, delta }: {
  label: string; value: string; sub?: string; accent?: string; delta?: DeltaInfo
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', flex: '1 1 150px', minWidth: 130 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, fontFamily: F_TITLE, color: accent ?? C_NAVY, lineHeight: 1.1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 11, fontWeight: 700, color: delta.color, marginTop: 4, fontFamily: F_BODY, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span>{delta.arrow}</span><span>{delta.text}</span>
        </div>
      )}
      {sub && <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 2, fontFamily: F_BODY }}>{sub}</div>}
    </div>
  )
}

/* Calcule le delta entre valeur courante et précédente.
 * inverse=true → la hausse est mauvaise (ex : impayés) */
function mkDelta(cur: number, prev: number, fmt: (v: number) => string, label: string, inverse = false): DeltaInfo {
  const diff   = cur - prev
  const pct    = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0
  const up     = diff >= 0
  const good   = inverse ? !up : up
  const color  = good ? '#4a7c10' : C_RED
  const arrow  = up ? '▲' : '▼'
  const sign   = up ? '+' : ''
  const pctStr = Math.abs(pct) < 0.05 ? '0%' : `${sign}${pct.toFixed(1)}%`
  return { text: `${pctStr}  (${fmt(diff)} vs ${label})`, color, arrow }
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
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

  const displayText = values.length === 0
    ? 'Tous'
    : values.length === 1
    ? values[0]
    : `${values.length} sélectionnés`

  const hasValue = values.length > 0

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY }}>{label}</span>
      <button onClick={() => setOpen(p => !p)} style={{
        padding: '6px 9px 6px 10px', borderRadius: 8,
        border: `1px solid ${hasValue ? C_NAVY : '#e8edf5'}`,
        background: hasValue ? '#eef2ff' : '#fff',
        fontSize: 12, fontWeight: 600, fontFamily: F_BODY,
        color: hasValue ? C_NAVY : 'rgba(31,59,114,.55)',
        cursor: 'pointer', outline: 'none', minWidth: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        textAlign: 'left',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {displayText}
        </span>
        <span style={{ fontSize: 9, opacity: .6, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e8edf5', borderRadius: 10,
          boxShadow: '0 8px 28px rgba(31,59,114,.12)', minWidth: 220,
          maxHeight: 260, overflowY: 'auto', padding: '6px 0',
        }}>
          {/* Tout sélectionner / désélectionner */}
          <div style={{ padding: '6px 14px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
            <button onClick={() => onChange(options)} style={{ fontSize: 10, fontWeight: 700, color: C_NAVY, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F_BODY, padding: 0 }}>Tout</button>
            <span style={{ color: '#e8edf5' }}>|</span>
            <button onClick={() => onChange([])} style={{ fontSize: 10, fontWeight: 700, color: C_RED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F_BODY, padding: 0 }}>Aucun</button>
          </div>
          {options.map(o => (
            <label key={o} onClick={() => toggle(o)} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px',
              cursor: 'pointer', fontSize: 12, fontFamily: F_BODY,
              color: values.includes(o) ? C_NAVY : 'rgba(31,59,114,.65)',
              background: values.includes(o) ? 'rgba(31,59,114,.04)' : 'transparent',
              fontWeight: values.includes(o) ? 700 : 500,
              transition: 'background .1s',
            }}>
              <span style={{
                width: 15, height: 15, borderRadius: 4, flexShrink: 0, border: `2px solid ${values.includes(o) ? C_NAVY : '#d1d9e6'}`,
                background: values.includes(o) ? C_NAVY : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: F_BODY, marginBottom: 8, marginTop: 4 }}>{children}</div>
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5' }}>{children}</div>
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: 'rgba(31,59,114,.45)', fontSize: 13, fontFamily: F_BODY }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-r 0.8s linear infinite', flexShrink: 0 }} />
      Chargement…
    </div>
  )
}

function ErrMsg({ msg }: { msg: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(232,64,64,.07)', borderRadius: 10, border: '1px solid rgba(232,64,64,.15)', color: C_RED, fontSize: 13, fontWeight: 600, fontFamily: F_BODY }}><AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />{msg}</div>
}

/* ─── Tableau générique ────────────────────────────────────────────────── */
function Tbl({ cols, rows }: {
  cols: { key: string; label: string; fmt?: (v: unknown) => React.ReactNode; align?: 'left' | 'right' }[]
  rows: Record<string, unknown>[]
}) {
  if (!rows.length) return <div style={{ padding: '16px 20px', fontSize: 13, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }}>Aucune donnée</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F_BODY, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f4f6fb' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '9px 14px', textAlign: c.align ?? (c.key === cols[0].key ? 'left' : 'right'), fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e8edf5', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
              {cols.map((c, ci) => (
                <td key={c.key} style={{ padding: '9px 14px', textAlign: c.align ?? (ci === 0 ? 'left' : 'right'), fontWeight: ci === 0 ? 700 : 500, color: ci === 0 ? C_NAVY : 'rgba(31,59,114,.7)', whiteSpace: 'nowrap' }}>
                  {c.fmt ? c.fmt(r[c.key]) : String(r[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TauxBadge({ v }: { v: number }) {
  const s = tauxColor(v)
  const ok = v >= OBJECTIF_TAUX
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {ok ? <Check size={10} strokeWidth={2.5} /> : <XIcon size={10} strokeWidth={2.5} />}
      {fmtPct(v)}
    </span>
  )
}

/* ═══════════════════════════════ ONGLETS ══════════════════════════════════ */

/* ── Histogramme classement DR ─────────────────────────────────────────── */
function ChartClassementDR({ rows }: { rows: AggrRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const sorted = [...rows]
    .filter(r => r.taux_recouvrement != null)
    .sort((a, b) => (b.taux_recouvrement ?? 0) - (a.taux_recouvrement ?? 0))

  if (!sorted.length) return null

  const maxVal = Math.max(100, ...sorted.map(r => r.taux_recouvrement ?? 0))
  const objPct = ((OBJECTIF_TAUX / maxVal) * 100).toFixed(2)
  const rankColors = ['#F59E0B', '#94A3B8', '#CD7F32']

  const barColor = (t: number) => {
    if (t >= OBJECTIF_TAUX) return { from: '#4ade80', to: '#16a34a' }
    if (t >= 80)            return { from: '#fbbf24', to: C_ORANGE }
    return                         { from: '#f87171', to: C_RED }
  }

  return (
    <Panel>
      <style>{`
        @keyframes tipIn {
          from { opacity: 0; transform: translateY(6px) scale(.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);   }
        }
      `}</style>
      <div style={{ padding: '18px 22px' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ width: 4, height: 18, borderRadius: 99, background: C_NAVY, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontFamily: F_BODY, fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Classement Taux de Recouvrement — par DR
          </span>
        </div>

        {/* Barres */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sorted.map((r, i) => {
            const t   = r.taux_recouvrement ?? 0
            const pct = (t / maxVal) * 100
            const { from, to } = barColor(t)
            const ok  = t >= OBJECTIF_TAUX
            const isHov = hovered === i

            return (
              <div
                key={r.dr ?? i}
                style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Rang */}
                <div style={{
                  width: 28, textAlign: 'center', flexShrink: 0,
                  fontSize: 11, fontWeight: 900,
                  color: i < 3 ? rankColors[i] : 'rgba(31,59,114,.3)', fontFamily: F_BODY,
                }}>
                  {i < 3 ? `#${i + 1}` : `${i + 1}`}
                </div>

                {/* Nom DR */}
                <div style={{
                  width: 110, fontSize: 11.5, fontWeight: 700, color: C_NAVY,
                  fontFamily: F_BODY, flexShrink: 0, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.dr}
                </div>

                {/* Piste + barre */}
                <div style={{ flex: 1, position: 'relative', height: 26, cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', inset: 0, background: '#f0f3f9', borderRadius: 99 }} />
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: 2,
                    left: `calc(${objPct}% - 1px)`,
                    background: 'rgba(31,59,114,.22)', zIndex: 2,
                  }} />
                  <div style={{
                    position: 'absolute', left: 0, top: 4, bottom: 4,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${from}, ${to})`,
                    borderRadius: 99, zIndex: 1,
                    boxShadow: ok ? '0 2px 8px rgba(22,163,74,.28)' : '0 2px 8px rgba(232,64,64,.22)',
                    transition: 'filter .15s',
                    filter: isHov ? 'brightness(1.12)' : 'none',
                  }} />
                </div>

                {/* Valeur */}
                <div style={{
                  width: 54, textAlign: 'right', flexShrink: 0,
                  fontSize: 12.5, fontWeight: 800, fontFamily: F_TITLE,
                  color: ok ? '#16a34a' : C_RED,
                }}>
                  {fmtPct(t)}
                </div>

                {/* ── Infobulle ── */}
                {isHov && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 12px)',
                    left: 148,
                    zIndex: 100,
                    minWidth: 260,
                    background: 'linear-gradient(145deg, rgba(10,18,42,.97), rgba(18,30,60,.97))',
                    backdropFilter: 'blur(24px)',
                    borderRadius: 16,
                    padding: '16px 18px',
                    boxShadow: `0 24px 60px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.06)`,
                    borderTop: `3px solid ${to}`,
                    animation: 'tipIn .15s ease',
                    pointerEvents: 'none',
                  }}>
                    {/* Flèche */}
                    <div style={{
                      position: 'absolute', bottom: -7, left: 22,
                      width: 14, height: 7,
                      background: 'rgba(18,30,60,.97)',
                      clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                    }} />

                    {/* En-tête tooltip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: i < 3 ? rankColors[i] : 'rgba(255,255,255,.4)', fontFamily: F_TITLE, lineHeight: 1 }}>#{i + 1}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: F_TITLE, lineHeight: 1.1 }}>{r.dr}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>Direction Régionale</div>
                      </div>
                    </div>

                    {/* Taux */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 12, paddingBottom: 12,
                      borderBottom: '1px solid rgba(255,255,255,.07)',
                    }}>
                      <span style={{ fontSize: 28, fontWeight: 900, fontFamily: F_TITLE, color: to, lineHeight: 1 }}>
                        {fmtPct(t)}
                      </span>
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em',
                        padding: '4px 9px', borderRadius: 99,
                        background: ok ? 'rgba(74,222,128,.12)' : 'rgba(248,113,113,.12)',
                        color: ok ? '#4ade80' : '#f87171',
                        border: `1px solid ${ok ? 'rgba(74,222,128,.25)' : 'rgba(248,113,113,.25)'}`,
                      }}>
                        {ok ? 'OBJECTIF ATTEINT' : 'SOUS OBJECTIF'}
                      </span>
                    </div>

                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                      {[
                        { label: 'CA Total',   value: fmtFcfa(r.ca_total   ?? 0), color: '#94a3c8' },
                        { label: 'Encaissé',   value: fmtFcfa(r.encaissement ?? 0), color: '#4ade80' },
                        { label: 'Impayés',    value: fmtFcfa(r.impaye      ?? 0), color: '#f87171' },
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

        {/* Légende objectif */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ width: 18, height: 2, background: 'rgba(31,59,114,.22)', borderRadius: 1 }} />
          <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>
            Objectif {OBJECTIF_TAUX}%
          </span>
          <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#16a34a', display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>≥ objectif</span>
          </span>
          <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: C_RED, display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>{'< objectif'}</span>
          </span>
        </div>
      </div>
    </Panel>
  )
}

/* ── Récapitulatif ─────────────────────────────────────────────────────── */
function TabRecap({ qs }: { qs: string }) {
  const { data, loading, err } = useCachedFetch<RecapData>(`/api/rapports?${qs}`)

  if (loading) return <Loader />
  if (err) return <ErrMsg msg={err} />
  if (!data) return null

  const { kpis, kpis_prev, prev_label } = data
  const p = kpis_prev
  const lbl = prev_label ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Chiffre d'Affaires" value={fmtFcfa(kpis.ca_total)} sub="TTC"
          delta={p ? mkDelta(kpis.ca_total, p.ca_total, fmtFcfa, lbl) : undefined} />
        <KpiCard label="Encaissements" value={fmtFcfa(kpis.encaissement)} sub="réglés" accent={C_GREEN}
          delta={p ? mkDelta(kpis.encaissement, p.encaissement, fmtFcfa, lbl) : undefined} />
        <KpiCard label="Impayés" value={fmtFcfa(kpis.impaye)} sub="solde" accent={C_RED}
          delta={p ? mkDelta(kpis.impaye, p.impaye, fmtFcfa, lbl, true) : undefined} />
        <KpiCard label="Taux Recouvrement" value={fmtPct(kpis.taux_recouvrement)} sub={`Obj. ${OBJECTIF_TAUX}% — ${kpis.nb_dr} DR`} accent={tauxColor(kpis.taux_recouvrement).color}
          delta={p ? mkDelta(kpis.taux_recouvrement, p.taux_recouvrement, v => `${v > 0 ? '+' : ''}${v.toFixed(1)} pt`, lbl) : undefined} />
        <KpiCard label="Nb Factures" value={fmtN(kpis.nb_factures)}
          delta={p ? mkDelta(kpis.nb_factures, p.nb_factures, v => fmtN(Math.round(v)), lbl) : undefined} />
      </div>

      {/* Histogramme classement DR */}
      <ChartClassementDR rows={data.par_dr} />

      {/* Matrice DR × Bimestre */}
      <TabMatrice qs={qs} />
    </div>
  )
}

/* ── Chiffre d'Affaires ─────────────────────────────────────────────────── */
function TabCA({ qs }: { qs: string }) {
  const { data, loading, err } = useCachedFetch<CaData>(`/api/rapports/ca?${qs}`)
  const [view, setView] = useState<'groupe' | 'type' | 'branchement' | 'dr'>('groupe')

  if (loading) return <Loader />
  if (err) return <ErrMsg msg={err} />
  if (!data) return null

  const VIEWS = [
    { key: 'groupe',      label: 'Groupe Facturation',  rows: data.par_groupe,      dimKey: 'label', dimLabel: 'Groupe' },
    { key: 'type',        label: 'Type de Facture',     rows: data.par_type,        dimKey: 'label', dimLabel: 'Type' },
    { key: 'branchement', label: 'Cat. Branchement',    rows: data.par_branchement, dimKey: 'label', dimLabel: 'Catégorie' },
    { key: 'dr',          label: 'DR', rows: data.par_dr,          dimKey: 'label', dimLabel: 'DR' },
  ] as const

  const active = VIEWS.find(v => v.key === view)!
  const total = active.rows.reduce((s, r) => s + (r.ca_total ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel>
        <div style={{ display: 'flex', borderBottom: '1px solid #e8edf5', flexWrap: 'wrap' }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)} style={{ padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: F_BODY, fontSize: 12, fontWeight: view === v.key ? 800 : 600, color: view === v.key ? C_NAVY : 'rgba(31,59,114,.4)', background: view === v.key ? '#fff' : '#fafbfd', borderBottom: view === v.key ? `2px solid ${C_NAVY}` : '2px solid transparent', transition: 'all .15s', whiteSpace: 'nowrap' }}>
              {v.label}
            </button>
          ))}
        </div>
        <Tbl
          cols={[
            { key: active.dimKey, label: active.dimLabel },
            { key: 'nb_factures', label: 'Factures', fmt: v => fmtN(v as number) },
            { key: 'ca_total', label: 'CA Total', fmt: v => fmtFcfa(v as number) },
            { key: 'ca_total', label: '% CA', fmt: (v) => fmtPct(total > 0 ? (v as number) * 100 / total : 0) },
            { key: 'encaissement', label: 'Encaissement', fmt: v => fmtFcfa(v as number) },
            { key: 'impaye', label: 'Impayés', fmt: v => fmtFcfa(v as number) },
            { key: 'taux_recouvrement', label: 'Taux Recvt', fmt: v => <TauxBadge v={v as number} /> },
          ]}
          rows={active.rows as unknown as Record<string, unknown>[]}
        />
      </Panel>
    </div>
  )
}

/* ── Règlements ─────────────────────────────────────────────────────────── */
function TabReglements({ qs }: { qs: string }) {
  const { data, loading, err } = useCachedFetch<ReglementsData>(`/api/rapports/reglements?${qs}`)
  const [view, setView] = useState<'aging' | 'dr' | 'statut'>('aging')

  if (loading) return <Loader />
  if (err) return <ErrMsg msg={err} />
  if (!data) return null

  const g = data.global
  const base = g.ca_total || 1

  const agingBands = [
    { key: 'a_j',    label: 'À J',      val: g.a_j,              pct: g.a_j / base * 100 },
    { key: 'j-j15',  label: 'J → J+15', val: g.a_jp15 - g.a_j,  pct: (g.a_jp15 - g.a_j) / base * 100 },
    { key: 'j15-30', label: 'J+15 → J+30', val: g.a_jp30 - g.a_jp15, pct: (g.a_jp30 - g.a_jp15) / base * 100 },
    { key: 'j30-45', label: 'J+30 → J+45', val: g.a_jp45 - g.a_jp30, pct: (g.a_jp45 - g.a_jp30) / base * 100 },
    { key: 'j45-60', label: 'J+45 → J+60', val: g.a_jp60 - g.a_jp45, pct: (g.a_jp60 - g.a_jp45) / base * 100 },
    { key: 'j60-75', label: 'J+60 → J+75', val: g.a_jp75 - g.a_jp60, pct: (g.a_jp75 - g.a_jp60) / base * 100 },
    { key: 'j75-90', label: 'J+75 → J+90', val: g.a_jp90 - g.a_jp75, pct: (g.a_jp90 - g.a_jp75) / base * 100 },
    { key: 'js90',   label: '> J+90',    val: g.a_js90,           pct: g.a_js90 / base * 100 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Total réglé" value={fmtFcfa(g.total_regle)} sub="encaissements" accent={C_GREEN} />
        <KpiCard label="CA de référence" value={fmtFcfa(g.ca_total)} />
        <KpiCard label="Taux encaissement" value={fmtPct(g.ca_total > 0 ? g.total_regle / g.ca_total * 100 : 0)} accent={C_GREEN} />
        <KpiCard label="Factures" value={fmtN(g.nb_factures)} />
      </div>

      {/* Onglets */}
      <Panel>
        <div style={{ display: 'flex', borderBottom: '1px solid #e8edf5' }}>
          {([['aging', 'Délai de paiement'], ['dr', 'Par DR'], ['statut', 'Par Statut']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setView(k)} style={{ padding: '10px 18px', border: 'none', cursor: 'pointer', fontFamily: F_BODY, fontSize: 12, fontWeight: view === k ? 800 : 600, color: view === k ? C_NAVY : 'rgba(31,59,114,.4)', background: view === k ? '#fff' : '#fafbfd', borderBottom: view === k ? `2px solid ${C_NAVY}` : '2px solid transparent', transition: 'all .15s' }}>
              {lbl}
            </button>
          ))}
        </div>

        {view === 'aging' && (
          <div style={{ padding: '16px 20px' }}>
            <SectionTitle>Répartition des encaissements par délai</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agingBands.map(b => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 110, fontSize: 11, fontWeight: 700, color: 'rgba(31,59,114,.6)', fontFamily: F_BODY, flexShrink: 0 }}>{b.label}</div>
                  <div style={{ flex: 1, background: '#f4f6fb', borderRadius: 6, height: 18, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(b.pct, 100)}%`, height: '100%', background: `linear-gradient(90deg,${C_GREEN},#b5e04f)`, borderRadius: 6, transition: 'width .4s', minWidth: b.val > 0 ? 4 : 0 }} />
                  </div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 11, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY }}>{fmtFcfa(b.val)}</div>
                  <div style={{ width: 46, textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'rgba(31,59,114,.45)', fontFamily: F_BODY }}>{fmtPct(b.pct)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'dr' && (
          <Tbl
            cols={[
              { key: 'dr', label: 'DR' },
              { key: 'nb_factures', label: 'Factures', fmt: v => fmtN(v as number) },
              { key: 'ca_total', label: 'CA', fmt: v => fmtFcfa(v as number) },
              { key: 'total_regle', label: 'Réglé', fmt: v => fmtFcfa(v as number) },
              { key: 'a_j', label: 'À J', fmt: v => fmtFcfa(v as number) },
              { key: 'a_jp30', label: 'J+30', fmt: v => fmtFcfa(v as number) },
              { key: 'a_jp60', label: 'J+60', fmt: v => fmtFcfa(v as number) },
              { key: 'a_jp90', label: 'J+90', fmt: v => fmtFcfa(v as number) },
              { key: 'a_js90', label: '>J+90', fmt: v => fmtFcfa(v as number) },
            ]}
            rows={data.par_dr as unknown as Record<string, unknown>[]}
          />
        )}

        {view === 'statut' && (
          <Tbl
            cols={[
              { key: 'statut_facture', label: 'Statut' },
              { key: 'nb_factures', label: 'Factures', fmt: v => fmtN(v as number) },
              { key: 'ca_total', label: 'CA', fmt: v => fmtFcfa(v as number) },
              { key: 'montant_regle', label: 'Réglé', fmt: v => fmtFcfa(v as number) },
              { key: 'impaye', label: 'Impayé', fmt: v => fmtFcfa(v as number) },
            ]}
            rows={data.par_statut as unknown as Record<string, unknown>[]}
          />
        )}
      </Panel>
    </div>
  )
}

/* ── Impayés ────────────────────────────────────────────────────────────── */
function TabImpayes({ qs }: { qs: string }) {
  const { data, loading, err } = useCachedFetch<ImpayesData>(`/api/rapports/impayes?${qs}`)
  const [view, setView] = useState<'dr' | 'statut' | 'groupe' | 'branchement'>('dr')

  if (loading) return <Loader />
  if (err) return <ErrMsg msg={err} />
  if (!data) return null

  const g = data.global
  const VIEWS = [
    { key: 'dr',          label: 'Par DR',           rows: data.par_dr,          dimKey: 'label', dimLabel: 'Direction' },
    { key: 'statut',      label: 'Par Statut',        rows: data.par_statut,      dimKey: 'label', dimLabel: 'Statut' },
    { key: 'groupe',      label: 'Par Groupe',        rows: data.par_groupe,      dimKey: 'label', dimLabel: 'Groupe' },
    { key: 'branchement', label: 'Par Branchement',   rows: data.par_branchement, dimKey: 'label', dimLabel: 'Catégorie' },
  ] as const

  const active = VIEWS.find(v => v.key === view)!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPI */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Total impayés" value={fmtFcfa(g.impaye_total)} sub="solde dû" accent={C_RED} />
        <KpiCard label="CA de référence" value={fmtFcfa(g.ca_total)} />
        <KpiCard label="Taux d'impayé" value={fmtPct(g.taux_impaye)} accent={C_ORANGE} />
        <KpiCard label="Nb factures impayées" value={fmtN(g.nb_factures)} accent={C_RED} />
      </div>

      <Panel>
        <div style={{ display: 'flex', borderBottom: '1px solid #e8edf5', flexWrap: 'wrap' }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)} style={{ padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: F_BODY, fontSize: 12, fontWeight: view === v.key ? 800 : 600, color: view === v.key ? C_NAVY : 'rgba(31,59,114,.4)', background: view === v.key ? '#fff' : '#fafbfd', borderBottom: view === v.key ? `2px solid ${C_NAVY}` : '2px solid transparent', transition: 'all .15s', whiteSpace: 'nowrap' }}>
              {v.label}
            </button>
          ))}
        </div>
        <Tbl
          cols={[
            { key: active.dimKey, label: active.dimLabel },
            { key: 'nb_factures',  label: 'Factures', fmt: v => fmtN(v as number) },
            { key: 'ca_total',     label: 'CA',       fmt: v => v != null ? fmtFcfa(v as number) : '—' },
            { key: 'impaye_total', label: 'Impayé',   fmt: v => fmtFcfa(v as number) },
            { key: 'taux_impaye',  label: '% Impayé', fmt: v => v != null ? fmtPct(v as number) : '—' },
          ]}
          rows={active.rows as unknown as Record<string, unknown>[]}
        />
      </Panel>
    </div>
  )
}

/* ═══════════════════════════════ MATRICE ══════════════════════════════════ */
interface MatriceCell { ca: number; enc: number; imp: number; taux: number }
interface MatriceRow  { dr: string; uo: string | null; bimestre: number; ca: number; enc: number; imp: number; taux: number }
interface MatriceData { annee: number | null; bimestres: number[]; rows: MatriceRow[] }

const BIM_LABELS: Record<number, string> = {
  1: 'B1', 2: 'B2', 3: 'B3', 4: 'B4', 5: 'B5', 6: 'B6',
}

function TauxCell({ v }: { v: number }) {
  const ok = v >= OBJECTIF_TAUX
  const color = ok ? '#4a7c10' : C_RED
  const bg    = ok ? 'rgba(150,193,30,.10)' : 'rgba(232,64,64,.08)'
  return (
    <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap',
      fontWeight: 700, fontSize: 12, color, background: bg, fontFamily: F_BODY }}>
      {fmtPct(v)}
    </td>
  )
}

function TabMatrice({ qs }: { qs: string }) {
  const { data, loading, err } = useCachedFetch<MatriceData>(`/api/rapports/matrice?${qs}`)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  if (loading) return <Loader />
  if (err)     return <ErrMsg msg={err} />
  if (!data || !data.rows.length)
    return <div style={{ padding: '20px', color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }}>Aucune donnée</div>

  const { bimestres } = data

  /* ── Construire la structure DR → UOs ── */
  type DrEntry = { dr: string; drCells: Record<number, MatriceCell>; uos: { uo: string; cells: Record<number, MatriceCell> }[] }
  const drMap = new Map<string, DrEntry>()

  for (const r of data.rows) {
    if (!drMap.has(r.dr)) drMap.set(r.dr, { dr: r.dr, drCells: {}, uos: [] })
    const entry = drMap.get(r.dr)!
    if (r.uo === null) {
      entry.drCells[r.bimestre] = { ca: r.ca, enc: r.enc, imp: r.imp, taux: r.taux }
    } else {
      let uoEntry = entry.uos.find(u => u.uo === r.uo)
      if (!uoEntry) { uoEntry = { uo: r.uo, cells: {} }; entry.uos.push(uoEntry) }
      uoEntry.cells[r.bimestre] = { ca: r.ca, enc: r.enc, imp: r.imp, taux: r.taux }
    }
  }
  const drList = Array.from(drMap.values())

  const toggleDr = (dr: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(dr) ? s.delete(dr) : s.add(dr); return s })

  const thStyle = (center = false): React.CSSProperties => ({
    padding: '8px 10px', background: C_NAVY, color: '#fff',
    fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
    textAlign: center ? 'center' : 'right',
    whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,.12)',
    position: 'sticky', top: 0, zIndex: 2,
  })

  const emptyCell = (key: string) => (
    <td key={`${key}-ca`}  style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12, color: 'rgba(31,59,114,.25)', fontFamily: F_BODY }}>—</td>
  )

  return (
    <Panel>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }}>
        <table style={{ borderCollapse: 'collapse', fontFamily: F_BODY, fontSize: 12, width: '100%' }}>
          <thead>
            {/* Ligne 1 : Bimestres */}
            <tr>
              <th style={{ ...thStyle(false), textAlign: 'left', position: 'sticky', left: 0, zIndex: 3, minWidth: 240, background: C_NAVY }}>
                DR / Secteur
              </th>
              {bimestres.map(b => (
                <th key={b} colSpan={4} style={{ ...thStyle(true), borderLeft: '2px solid rgba(255,255,255,.2)' }}>
                  {BIM_LABELS[b] ?? `B${b}`}
                </th>
              ))}
            </tr>
            {/* Ligne 2 : Sous-colonnes */}
            <tr>
              <th style={{ ...thStyle(false), textAlign: 'left', position: 'sticky', left: 0, zIndex: 3, top: 33, background: '#1a3263', fontSize: 9 }}>
                &nbsp;
              </th>
              {bimestres.map(b => (
                <React.Fragment key={b}>
                  <th style={{ ...thStyle(), top: 33, background: '#1a3263', fontSize: 9, borderLeft: '2px solid rgba(255,255,255,.15)' }}>Facturé</th>
                  <th style={{ ...thStyle(), top: 33, background: '#1a3263', fontSize: 9 }}>Encaissé</th>
                  <th style={{ ...thStyle(), top: 33, background: '#1a3263', fontSize: 9, color: '#ffaaaa' }}>Impayés</th>
                  <th style={{ ...thStyle(true), top: 33, background: '#1a3263', fontSize: 9 }}>Taux</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {drList.map((entry, di) => {
              const isCollapsed = collapsed.has(entry.dr)
              return (
                <React.Fragment key={entry.dr}>
                  {/* Ligne DR */}
                  <tr style={{ background: di % 2 === 0 ? '#eef2fb' : '#e8edf8', cursor: 'pointer' }} onClick={() => toggleDr(entry.dr)}>
                    <td style={{
                      padding: '8px 12px', fontWeight: 800, fontSize: 12, color: C_NAVY,
                      position: 'sticky', left: 0, background: di % 2 === 0 ? '#eef2fb' : '#e8edf8',
                      zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                    }}>
                      <span style={{ fontSize: 11, color: C_NAVY, opacity: .6, width: 14, textAlign: 'center' }}>
                        {isCollapsed ? '▶' : '▼'}
                      </span>
                      {entry.dr}
                    </td>
                    {bimestres.map(b => {
                      const c = entry.drCells[b]
                      if (!c) return (
                        <React.Fragment key={b}>
                          {[0,1,2].map(i => <td key={i} style={{ padding: '8px 10px', textAlign: 'right', color: 'rgba(31,59,114,.25)', fontWeight: 700 }}>—</td>)}
                          <td style={{ padding: '8px 10px' }} />
                        </React.Fragment>
                      )
                      return (
                        <React.Fragment key={b}>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: C_NAVY, whiteSpace: 'nowrap', borderLeft: '2px solid rgba(31,59,114,.08)' }}>{fmtFcfa(c.ca)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: C_GREEN, whiteSpace: 'nowrap' }}>{fmtFcfa(c.enc)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: c.imp > 0 ? C_RED : 'rgba(31,59,114,.3)', whiteSpace: 'nowrap' }}>{fmtFcfa(c.imp)}</td>
                          <TauxCell v={c.taux} />
                        </React.Fragment>
                      )
                    })}
                  </tr>

                  {/* Lignes UO */}
                  {!isCollapsed && entry.uos.map((uoEntry: typeof entry.uos[0], ui: number) => (
                    <tr key={uoEntry.uo} style={{ background: ui % 2 === 0 ? '#fff' : '#fafbfd' }}>
                      <td style={{
                        padding: '7px 12px 7px 34px', fontWeight: 500, fontSize: 12,
                        color: 'rgba(31,59,114,.75)', position: 'sticky', left: 0,
                        background: ui % 2 === 0 ? '#fff' : '#fafbfd', zIndex: 1, whiteSpace: 'nowrap',
                      }}>
                        {uoEntry.uo}
                      </td>
                      {bimestres.map(b => {
                        const c = uoEntry.cells[b]
                        if (!c) return (
                          <React.Fragment key={b}>
                            {emptyCell(`${uoEntry.uo}-${b}-ca`)}
                            {emptyCell(`${uoEntry.uo}-${b}-enc`)}
                            {emptyCell(`${uoEntry.uo}-${b}-imp`)}
                            <td key={`${uoEntry.uo}-${b}-tx`} style={{ padding: '7px 10px' }} />
                          </React.Fragment>
                        )
                        return (
                          <React.Fragment key={b}>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 500, color: 'rgba(31,59,114,.8)', whiteSpace: 'nowrap', borderLeft: '2px solid rgba(31,59,114,.05)' }}>{fmtFcfa(c.ca)}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 500, color: 'rgba(31,59,114,.6)', whiteSpace: 'nowrap' }}>{fmtFcfa(c.enc)}</td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 500, color: c.imp > 0 ? C_RED : 'rgba(31,59,114,.25)', whiteSpace: 'nowrap' }}>{fmtFcfa(c.imp)}</td>
                            <TauxCell v={c.taux} />
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/* ═══════════════════════════ COMPOSANT PRINCIPAL ══════════════════════════ */
const INIT: Filtres = {
  annee: '2025', bimestre: 'all', categorie_rgp: 'all',
  dr: 'all', uo: 'all',
  groupe_facturation: [], cat_branchement: [],
  type_facture: 'all', statut_facture: 'all',
}

export default function RapportSenODS() {
  const [filtres, setFiltres]       = useState<Filtres>(INIT)
  const [opts, setOpts]             = useState<FiltresOpts | null>(null)
  const [unitesDr, setUnitesDr]     = useState<string[] | null>(null)  // UO filtrées par DR
  const [tab, setTab]               = useState<'recap' | 'ca' | 'reglements' | 'impayes'>('recap')
  const [advanced, setAdvanced]     = useState(false)

  /* Charger options filtres au montage */
  useEffect(() => {
    fetch('/api/filtres').then(r => r.ok ? r.json() : null).then(d => { if (d) setOpts(d) }).catch(() => {})
  }, [])

  /* Cascade DR → UO : recharge les secteurs quand DR change */
  useEffect(() => {
    if (filtres.dr === 'all') {
      setUnitesDr(null)                          // retour à la liste complète
      setFiltres(p => ({ ...p, uo: 'all' }))    // reset secteur
      return
    }
    fetch(`/api/filtres?dr=${encodeURIComponent(filtres.dr)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.unites) {
          setUnitesDr(d.unites)
          setFiltres(p => ({ ...p, uo: 'all' }))  // reset secteur
        }
      })
      .catch(() => {})
  }, [filtres.dr])

  /* Liste UO affichée : filtrée par DR si dispo, sinon complète */
  const unitesDisplay = unitesDr ?? opts?.unites ?? []

  const set  = useCallback((k: keyof Filtres) => (v: string)   => setFiltres(p => ({ ...p, [k]: v })), [])
  const setM = useCallback((k: keyof Filtres) => (v: string[]) => setFiltres(p => ({ ...p, [k]: v })), [])

  /* Query string partagé entre tous les onglets */
  const qs = useMemo(() => buildParams(filtres), [filtres])

  /* Compteur de filtres actifs */
  const activeCount = [
    filtres.annee !== 'all', filtres.bimestre !== 'all', filtres.categorie_rgp !== 'all',
    filtres.dr !== 'all', filtres.uo !== 'all', filtres.type_facture !== 'all',
    filtres.statut_facture !== 'all',
    filtres.groupe_facturation.length > 0, filtres.cat_branchement.length > 0,
  ].filter(Boolean).length

  const mk = (arr: string[], all: string) => [{ value: 'all', label: all }, ...arr.map(v => ({ value: v, label: v }))]
  const mkN = (arr: number[], all: string, fmt?: (n: number) => string) => [{ value: 'all', label: all }, ...arr.map(n => ({ value: String(n), label: fmt ? fmt(n) : String(n) }))]

  const TABS = [
    { key: 'recap',      label: 'Récapitulatif' },
    { key: 'ca',         label: "Chiffre d'Affaires" },
    { key: 'reglements', label: 'Règlements' },
    { key: 'impayes',    label: 'Impayés' },
  ] as const

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f4f6fb', fontFamily: F_BODY, overflowY: 'auto' }}>

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
            Filtres avancés {activeCount > 3 ? <span style={{ background: C_NAVY, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>{activeCount - 3}</span> : null}
            <span style={{ fontSize: 10 }}>{advanced ? '▲' : '▼'}</span>
          </button>

          {activeCount > 0 && (
            <button onClick={() => setFiltres(INIT)} style={{ alignSelf: 'flex-end', padding: '7px 12px', borderRadius: 8, border: '1px solid #e8edf5', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C_RED, fontFamily: F_BODY, display: 'flex', alignItems: 'center', gap: 5 }}>
              <XIcon size={11} strokeWidth={2.5} />Réinitialiser
            </button>
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

      {/* ── Navigation onglets ────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8edf5', padding: '0 24px', display: 'flex', gap: 0, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '11px 18px', border: 'none', cursor: 'pointer', fontFamily: F_BODY, fontSize: 12, fontWeight: tab === t.key ? 800 : 600, color: tab === t.key ? C_NAVY : 'rgba(31,59,114,.4)', background: 'transparent', borderBottom: tab === t.key ? `2px solid ${C_NAVY}` : '2px solid transparent', transition: 'all .15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenu ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '20px 24px' }}>
        {tab === 'recap'      && <TabRecap      qs={qs} />}
        {tab === 'ca'         && <TabCA         qs={qs} />}
        {tab === 'reglements' && <TabReglements qs={qs} />}
        {tab === 'impayes'    && <TabImpayes    qs={qs} />}
      </div>

      <style>{`@keyframes spin-r { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
