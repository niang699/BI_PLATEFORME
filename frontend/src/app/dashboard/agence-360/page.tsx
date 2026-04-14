'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getCurrentUser } from '@/lib/auth'
import TopBar from '@/components/TopBar'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — alignés sur les rapports (RapportRH / RapportFacturation)
═══════════════════════════════════════════════════════════════════════════ */
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_GREEN = '#96C11E'
const C_RED   = '#E84040'
const C_PAGE  = '#f8fafc'

// ─── rien ici : l'année est calculée dans le composant via lazy useState ──

const SEUIL = {
  TAUX_OBJECTIF: 98.5,
  TAUX_WARNING:  95,
  IMPAYE_RATIO:  10,
  HS_RATIO:      2.5,
  FORMATION_MIN: 50,
  TAUX_FEM_MIN:  20,
}

type Statut = 'ok' | 'warning' | 'critical' | 'neutral'

const STATUS_CFG: Record<Statut, { bg: string; text: string; dot: string; label: string }> = {
  ok:       { bg: 'rgba(5,150,105,.08)',  text: '#065f46', dot: '#059669', label: 'Objectif atteint' },
  warning:  { bg: 'rgba(217,119,6,.08)', text: '#92400e', dot: '#D97706', label: 'À surveiller'     },
  critical: { bg: 'rgba(220,38,38,.08)', text: '#991b1b', dot: '#dc2626', label: 'Critique'         },
  neutral:  { bg: 'rgba(31,59,114,.05)', text: 'rgba(31,59,114,.45)', dot: '#94a3b8', label: '—'   },
}

/* ─── Types API ──────────────────────────────────────────────────────────── */
interface BimRow {
  bimestre: number; annee: number
  nb_factures: number; ca_total: number; encaissement: number; taux_recouvrement: number
}
interface GrpRow {
  groupe: string; nb_factures: number
  ca_total: number; encaissement: number; impaye: number
  taux_recouvrement: number; taux_impaye: number
}
interface UoRow {
  uo: string; nb_factures: number
  ca_total: number; encaissement: number; impaye: number
  taux_recouvrement: number; taux_impaye: number
  a_risque: boolean; ecart_objectif: number
}
interface FactKpiRaw {
  ca_total: number; encaissement: number; impaye: number
  taux_recouvrement: number; taux_impaye: number; nb_factures: number; nb_dr: number
  par_dr:                  { dr: string; taux_recouvrement: number; ca_total: number; a_risque: boolean }[]
  par_uo:                  UoRow[]
  par_bimestre:            BimRow[]
  par_groupe_facturation:  GrpRow[]
  dts_a_risque:            { dr: string; taux_recouvrement: number }[]
  filters:                 { annee: number | null }
}
interface RhKpiRaw {
  nb_salaries: number; taux_feminisation: number; masse_salariale: number
  salaire_moyen: number; anciennete_moy: number; taux_hs: number
  nb_heures_formation: number; nb_collaborateurs_formes: number; pct_formes: number
  variation: Record<string, number | null>
  annee_precedente: string | null
  annee_reference:  number | null   // année auto-détectée (dernière complète)
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmt(n: number, dec = 0) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtM(n: number) {
  if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000, 1)} Md`
  if (n >= 1_000_000)     return `${fmt(n / 1_000_000, 1)} M`
  if (n >= 1_000)         return `${fmt(n / 1_000, 0)} K`
  return fmt(n)
}
function pctVar(a: number, b: number): number | null {
  if (!b) return null
  return Math.round((a - b) / b * 1000) / 10
}
function varColor(v: number | null | undefined, inverse = false): string {
  if (v == null) return 'rgba(31,59,114,.35)'
  return (inverse ? v <= 0 : v >= 0) ? C_GREEN : C_RED
}
function varLabel(v: number | null | undefined): string {
  if (v == null) return ''
  return (v >= 0 ? '▲ +' : '▼ ') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %'
}
function shortDr(label: string) {
  return label
    .replace(/Direction R[eé]gionale\s*/i, 'DR ')
    .replace(/Direction Territoriale\s*/i, 'DT ')
}
function statutTaux(v: number): Statut {
  if (v >= SEUIL.TAUX_OBJECTIF) return 'ok'
  if (v >= SEUIL.TAUX_WARNING)  return 'warning'
  return 'critical'
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANTS — identiques aux rapports
═══════════════════════════════════════════════════════════════════════════ */

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
function Sk({ w = '100%', h = 18, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: 'linear-gradient(90deg,#e8edf5 25%,#f1f5f9 50%,#e8edf5 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

/* ─── Pastille statut ────────────────────────────────────────────────────── */
function Pill({ statut }: { statut: Statut }) {
  const c = STATUS_CFG[statut]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
      background: c.bg, color: c.text,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}

/* ─── KPI Card — exactement comme dans les rapports ─────────────────────── */
interface KpiCardProps {
  label:      string
  value:      string
  sub?:       string
  accent?:    string
  variation?: number | null
  varInverse?: boolean
  statut?:    Statut
  pct?:       number
  pctMax?:    number
  objectif?:  string
  loading?:   boolean
}
function KpiCard({
  label, value, sub, accent = C_NAVY,
  variation, varInverse = false,
  statut, pct, pctMax = 100, objectif,
  loading,
}: KpiCardProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '16px 20px',
      boxShadow: '0 2px 10px rgba(31,59,114,.10)',
      flex: '1 1 160px',
      minWidth: 150,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* Label */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)',
        textTransform: 'uppercase', letterSpacing: '.05em',
        fontFamily: F_BODY, marginBottom: 6,
      }}>
        {label}
      </div>

      {/* Valeur principale */}
      {loading ? <Sk h={28} r={5} /> : (
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: F_TITLE, color: accent, lineHeight: 1.1 }}>
          {value}
        </div>
      )}

      {/* Sous-texte */}
      {sub && !loading && (
        <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 4, fontFamily: F_BODY }}>
          {sub}
        </div>
      )}

      {/* Variation N-1 */}
      {variation != null && !loading && (
        <div style={{
          fontSize: 10, fontWeight: 700, marginTop: 5,
          fontFamily: F_BODY, color: varColor(variation, varInverse),
        }}>
          {varLabel(variation)}&ensp;
          <span style={{ fontWeight: 500, color: 'rgba(31,59,114,.35)', fontSize: 9.5 }}>
            vs N-1
          </span>
        </div>
      )}

      {/* Barre de progression */}
      {pct !== undefined && !loading && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (pct / pctMax) * 100)}%`,
              background: statut ? STATUS_CFG[statut].dot : accent,
              borderRadius: 99, transition: 'width .5s ease',
            }} />
          </div>
          {objectif && (
            <div style={{ fontSize: 8.5, color: 'rgba(31,59,114,.3)', marginTop: 3, fontFamily: F_BODY, fontWeight: 600 }}>
              Objectif : {objectif}
            </div>
          )}
        </div>
      )}

      {/* Pastille statut */}
      {statut && statut !== 'neutral' && !loading && (
        <div style={{ marginTop: 8 }}>
          <Pill statut={statut} />
        </div>
      )}
    </div>
  )
}

/* ─── En-tête de segment ─────────────────────────────────────────────────── */
function SegHead({
  color, title, meta, statut, href, loading,
}: {
  color: string; title: string; meta: string
  statut: Statut; href?: string; loading?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 22px', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div>
          <div style={{
            fontFamily: F_TITLE, fontSize: 13, fontWeight: 800,
            color: C_NAVY, letterSpacing: '.04em', textTransform: 'uppercase',
          }}>{title}</div>
          <div style={{ fontSize: 10, color: 'rgba(31,59,114,.38)', fontFamily: F_BODY, marginTop: 1 }}>
            {meta}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {loading ? <Sk w={90} h={20} r={99} /> : <Pill statut={statut} />}
        {href && (
          <Link href={href} style={{
            fontSize: 10.5, fontWeight: 700, color: 'rgba(31,59,114,.4)',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            Détail →
          </Link>
        )}
      </div>
    </div>
  )
}

/* ─── Classement DRs ─────────────────────────────────────────────────────── */
function DrTable({ rows, loading }: { rows: FactKpiRaw['par_dr']; loading: boolean }) {
  if (loading) return (
    <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3].map(i => <Sk key={i} h={26} r={5} />)}
    </div>
  )
  if (!rows.length) return null
  return (
    <div style={{ padding: '0 22px 18px' }}>
      <div style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '.09em', color: 'rgba(31,59,114,.3)',
        fontFamily: F_BODY, marginBottom: 8,
      }}>
        Classement directions régionales
      </div>
      {rows.slice(0, 6).map((d, i) => {
        const st  = statutTaux(d.taux_recouvrement)
        const cfg = STATUS_CFG[st]
        return (
          <div key={d.dr} style={{
            display: 'grid',
            gridTemplateColumns: '20px 1fr 100px 60px',
            alignItems: 'center', gap: 10,
            padding: '5px 0',
            borderBottom: i < Math.min(rows.length, 6) - 1 ? '1px solid #f8fafc' : 'none',
          }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(31,59,114,.25)', fontFamily: F_BODY, textAlign: 'right' }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C_NAVY, fontFamily: F_BODY }}>
              {shortDr(d.dr)}
            </span>
            <div style={{ height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, d.taux_recouvrement)}%`, background: cfg.dot, borderRadius: 99 }} />
            </div>
            <span style={{ fontFamily: F_TITLE, fontSize: 12, fontWeight: 800, color: cfg.text, textAlign: 'right' }}>
              {fmt(d.taux_recouvrement, 1)} %
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Classement UOs (secteurs) — vue DT ────────────────────────────────── */
function UoTable({ rows, loading }: { rows: UoRow[]; loading: boolean }) {
  if (loading) return (
    <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3,4,5].map(i => <Sk key={i} h={36} r={6} />)}
    </div>
  )
  if (!rows.length) return null

  const total_ca = rows.reduce((s, r) => s + r.ca_total, 0)

  return (
    <div style={{ padding: '0 22px 20px' }}>
      <div style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '.09em', color: 'rgba(31,59,114,.3)',
        fontFamily: F_BODY, marginBottom: 10,
      }}>
        Performance par secteur (UO)
      </div>

      {/* En-têtes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr 90px 120px 72px',
        gap: 10, padding: '0 4px 6px',
        borderBottom: '1px solid #f1f5f9',
      }}>
        {['#', 'Secteur', 'CA', 'Taux recouv.', 'Écart obj.'].map(h => (
          <span key={h} style={{
            fontSize: 8.5, fontWeight: 800, color: 'rgba(31,59,114,.3)',
            textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: F_BODY,
            textAlign: h === '#' ? 'right' : h === 'Écart obj.' || h === 'Taux recouv.' ? 'right' : 'left',
          }}>{h}</span>
        ))}
      </div>

      {rows.map((r, i) => {
        const st  = statutTaux(r.taux_recouvrement)
        const cfg = STATUS_CFG[st]
        const pctCa = total_ca > 0 ? Math.round(r.ca_total / total_ca * 1000) / 10 : 0
        const ecartSign = r.ecart_objectif >= 0 ? '+' : ''

        return (
          <div key={r.uo} style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 90px 120px 72px',
            alignItems: 'center', gap: 10,
            padding: '7px 4px',
            borderBottom: i < rows.length - 1 ? '1px solid #f8fafc' : 'none',
            borderRadius: 6,
          }}>
            {/* Rang */}
            <span style={{
              fontSize: 9.5, fontWeight: 700,
              color: i < 3 ? C_NAVY : 'rgba(31,59,114,.22)',
              fontFamily: F_BODY, textAlign: 'right',
            }}>
              {i + 1}
            </span>

            {/* Nom secteur */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY, lineHeight: 1.2 }}>
                {r.uo}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 1 }}>
                {pctCa} % du CA · {fmt(r.nb_factures)} factures
              </div>
            </div>

            {/* CA */}
            <span style={{ fontFamily: F_TITLE, fontSize: 11, fontWeight: 700, color: 'rgba(31,59,114,.6)', textAlign: 'right' }}>
              {fmtM(r.ca_total)}
            </span>

            {/* Barre + taux */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, r.taux_recouvrement)}%`,
                  background: cfg.dot, borderRadius: 99,
                  transition: 'width .4s ease',
                }} />
              </div>
              <span style={{
                fontFamily: F_TITLE, fontSize: 12, fontWeight: 800,
                color: cfg.text, minWidth: 42, textAlign: 'right',
              }}>
                {fmt(r.taux_recouvrement, 1)} %
              </span>
            </div>

            {/* Écart objectif */}
            <span style={{
              fontFamily: F_BODY, fontSize: 11, fontWeight: 700,
              color: r.ecart_objectif >= 0 ? '#059669' : C_RED,
              textAlign: 'right',
            }}>
              {ecartSign}{fmt(r.ecart_objectif, 1)} pt
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Évolution bimestrielle ─────────────────────────────────────────────── */
const BIMESTRE_LABELS: Record<number, string> = {
  1: 'B1 Jan–Fév', 2: 'B2 Mar–Avr', 3: 'B3 Mai–Jun',
  4: 'B4 Jul–Aoû', 5: 'B5 Sep–Oct', 6: 'B6 Nov–Déc',
}

function ChartBimestre({ rows, loading }: { rows: BimRow[]; loading: boolean }) {
  if (loading) return (
    <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Sk h={12} w={220} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, marginTop: 12 }}>
        {[1,2,3,4,5,6].map(i => <Sk key={i} h={Math.random() * 60 + 30} w="100%" r={5} />)}
      </div>
    </div>
  )

  const data = [...rows]
    .sort((a, b) => a.bimestre - b.bimestre)
    .map(r => ({
      label: BIMESTRE_LABELS[r.bimestre] ?? `B${r.bimestre}`,
      ca:    r.ca_total,
      enc:   r.encaissement,
      taux:  r.taux_recouvrement,
      ok:    r.taux_recouvrement >= SEUIL.TAUX_OBJECTIF,
    }))

  if (!data.length) return null

  const tauxVals = data.map(d => d.taux)
  const minTaux  = Math.max(0, Math.min(...tauxVals) - 5)
  const maxTaux  = Math.min(102, Math.max(...tauxVals) + 3)

  return (
    <div style={{ padding: '0 22px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', color: 'rgba(31,59,114,.3)', fontFamily: F_BODY }}>
          Taux de recouvrement par bimestre
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>
            <span style={{ width: 10, height: 3, borderRadius: 99, background: C_NAVY, display: 'inline-block' }} />CA
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>
            <span style={{ width: 10, height: 3, borderRadius: 99, background: C_GREEN, display: 'inline-block' }} />Encaissé
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, fontWeight: 600 }}>
            <span style={{ width: 10, height: 0, borderTop: '2px dashed rgba(232,64,64,.5)', display: 'inline-block' }} />Objectif
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: F_BODY, fill: 'rgba(31,59,114,.5)' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="ca" orientation="left" tick={{ fontSize: 8, fontFamily: F_BODY, fill: 'rgba(31,59,114,.35)' }}
            tickFormatter={v => fmtM(v)} width={54} axisLine={false} tickLine={false} />
          <YAxis yAxisId="taux" orientation="right" domain={[minTaux, maxTaux]}
            tick={{ fontSize: 8, fontFamily: F_BODY, fill: 'rgba(31,59,114,.35)' }}
            tickFormatter={v => `${v}%`} width={34} axisLine={false} tickLine={false} />
          <RechartTooltip content={({ active, payload, label: lbl }) => {
            if (!active || !payload?.length) return null
            const taux = (payload.find(p => p.name === 'taux')?.value as number) ?? 0
            const ca   = (payload.find(p => p.name === 'ca')?.value   as number) ?? 0
            const enc  = (payload.find(p => p.name === 'enc')?.value  as number) ?? 0
            const ok   = taux >= SEUIL.TAUX_OBJECTIF
            return (
              <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 12, padding: '10px 14px', boxShadow: '0 6px 24px rgba(31,59,114,.12)', fontFamily: F_BODY, minWidth: 175 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C_NAVY, marginBottom: 7, fontFamily: F_TITLE }}>{lbl}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                    <span style={{ fontSize: 9, color: 'rgba(31,59,114,.5)', fontWeight: 600 }}>CA facturé</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C_NAVY }}>{fmtM(ca)} F</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                    <span style={{ fontSize: 9, color: 'rgba(31,59,114,.5)', fontWeight: 600 }}>Encaissé</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C_GREEN }}>{fmtM(enc)} F</span>
                  </div>
                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 3, paddingTop: 5, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                    <span style={{ fontSize: 9, color: 'rgba(31,59,114,.5)', fontWeight: 600 }}>Taux recvt</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ok ? '#4a7c10' : C_RED }}>
                      {fmt(taux, 1)}% {ok ? '✓' : '↓'}
                    </span>
                  </div>
                  {!ok && (
                    <div style={{ fontSize: 9, color: C_RED, fontWeight: 600, textAlign: 'right' }}>
                      Δ objectif : {fmt(taux - SEUIL.TAUX_OBJECTIF, 1)}%
                    </div>
                  )}
                </div>
              </div>
            )
          }} />
          <ReferenceLine yAxisId="taux" y={SEUIL.TAUX_OBJECTIF} stroke={C_RED} strokeDasharray="5 3" strokeWidth={1.5} strokeOpacity={.55} />
          <Bar yAxisId="ca" dataKey="ca" name="ca" radius={[4,4,0,0]} maxBarSize={40} opacity={.18}>
            {data.map((_, i) => <Cell key={i} fill={C_NAVY} />)}
          </Bar>
          <Bar yAxisId="ca" dataKey="enc" name="enc" radius={[4,4,0,0]} maxBarSize={40} opacity={.55}>
            {data.map((_, i) => <Cell key={i} fill={C_GREEN} />)}
          </Bar>
          <Line yAxisId="taux" dataKey="taux" name="taux" type="monotone"
            stroke={C_NAVY} strokeWidth={2.5} dot={(props) => {
              const { cx, cy, payload } = props
              const color = payload.ok ? '#4a7c10' : C_RED
              return <circle key={cx} cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />
            }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Répartition par groupe de facturation ──────────────────────────────── */
function ChartGroupes({ rows, loading }: { rows: GrpRow[]; loading: boolean }) {
  const [hov, setHov] = useState<number | null>(null)

  if (loading) return (
    <div style={{ padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Sk h={12} w={200} />
      {[1,2,3].map(i => <Sk key={i} h={28} r={5} />)}
    </div>
  )
  if (!rows.length) return null

  const total_ca = rows.reduce((s, r) => s + r.ca_total, 0)

  return (
    <div style={{ padding: '0 22px 20px' }}>
      <div style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '.09em', color: 'rgba(31,59,114,.3)',
        fontFamily: F_BODY, marginBottom: 12,
      }}>
        Taux de recouvrement par groupe de facturation
      </div>
      {rows.map((r, i) => {
        const ok    = r.taux_recouvrement >= SEUIL.TAUX_OBJECTIF
        const warn  = r.taux_recouvrement >= SEUIL.TAUX_WARNING
        const cfg   = ok ? STATUS_CFG.ok : warn ? STATUS_CFG.warning : STATUS_CFG.critical
        const isHov = hov === i
        const pctCa = total_ca > 0 ? Math.round(r.ca_total / total_ca * 1000) / 10 : 0

        return (
          <div key={r.groupe}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px 64px',
              alignItems: 'center', gap: 12,
              padding: '7px 10px', borderRadius: 8, marginBottom: 3,
              background: isHov ? '#f8fafc' : 'transparent',
              transition: 'background .12s', cursor: 'default',
            }}>
            {/* Nom + share CA */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C_NAVY, fontFamily: F_BODY }}>{r.groupe}</div>
              <div style={{ fontSize: 9, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 1 }}>
                {fmtM(r.ca_total)} · {pctCa} % du CA
              </div>
            </div>

            {/* Barre taux */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, r.taux_recouvrement)}%`,
                  background: cfg.dot,
                  borderRadius: 99, transition: 'width .4s ease',
                }} />
              </div>
              {isHov && (
                <div style={{ fontSize: 8.5, color: 'rgba(31,59,114,.35)', fontFamily: F_BODY, fontWeight: 600 }}>
                  Impayés : {fmtM(r.impaye)} ({fmt(r.taux_impaye, 1)} %)
                </div>
              )}
            </div>

            {/* Taux */}
            <span style={{
              fontFamily: F_TITLE, fontSize: 13, fontWeight: 800,
              color: cfg.text, textAlign: 'right',
            }}>
              {fmt(r.taux_recouvrement, 1)} %
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */
type LoadState = 'loading' | 'ok' | 'error'

export default function AgencePage() {
  // ── Année calculée une fois à l'hydratation du composant (pas au load module)
  const [annee] = useState<number>(() => new Date().getFullYear())

  const [user,      setUser]      = useState<ReturnType<typeof getCurrentUser>>(null)
  const [fact,      setFact]      = useState<FactKpiRaw | null>(null)
  const [factN1,    setFactN1]    = useState<FactKpiRaw | null>(null)
  const [rh,        setRh]        = useState<RhKpiRaw   | null>(null)
  const [factState, setFactState] = useState<LoadState>('loading')
  const [rhState,   setRhState]   = useState<LoadState>('loading')
  const [lastAt,    setLastAt]    = useState('')
  const [greeting,  setGreeting]  = useState('')

  // AbortController — annule les requêtes précédentes si refresh rapide
  const abortRef = useRef<AbortController | null>(null)

  const isGlobal = !user?.dt

  const fetchAll = useCallback(async (u: ReturnType<typeof getCurrentUser>, year: number) => {
    // Annule toute requête en cours
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const sig = ctrl.signal

    setFactState('loading')
    setRhState('loading')
    // Stale-while-revalidate : skeletons uniquement au premier chargement

    const dr = u?.dt ? `&dr=${encodeURIComponent(u.dt)}` : ''

    try {
      /* ── Phase 1 : données N (affichage immédiat) ─────────────────────
         Même pattern que RapportRH : on affiche les KPIs dès qu'ils arrivent,
         sans attendre N-1. Les deux appels sont en parallèle entre eux.      */
      const [factCurR, rhKpiR] = await Promise.allSettled([
        fetch(`/api/facturation/kpis?annee=${year}${dr}`, { signal: sig }).then(r => r.json()),
        fetch(`/api/rh/kpis?annee=${year}`,               { signal: sig }).then(r => r.json()),
      ])

      if (sig.aborted) return

      if (factCurR.status === 'fulfilled' && !factCurR.value?.error) {
        setFact(factCurR.value as FactKpiRaw)
        setFactState('ok')
      } else {
        setFactState('error')
      }

      if (rhKpiR.status === 'fulfilled' && !rhKpiR.value?._error) {
        setRh(rhKpiR.value as RhKpiRaw)
        setRhState('ok')
      } else {
        setRhState('error')
      }

      // Timestamp affiché dès que les données principales sont là
      setLastAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))

      /* ── Phase 2 : données N-1 en arrière-plan (variations) ───────────
         Lance la requête sans bloquer — les flèches ▲/▼ apparaissent
         quelques instants après l'affichage des KPIs.                        */
      if (sig.aborted) return
      fetch(`/api/facturation/kpis?annee=${year - 1}${dr}`, { signal: sig })
        .then(r => r.json())
        .then(data => {
          if (sig.aborted) return
          if (!data?.error) setFactN1(data as FactKpiRaw)
        })
        .catch(() => {/* silencieux — variations indisponibles */})

    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setFactState('error')
      setRhState('error')
    }
  }, [])

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir')
    fetchAll(u, annee)
    return () => abortRef.current?.abort()   // cleanup au démontage
  }, [fetchAll, annee])

  /* ─── Variations facturation — mémorisées, recalculées seulement si les data changent */
  const { varCa, varEnc, varImp, varTaux, varFact } = useMemo(() => ({
    varCa:   fact && factN1 ? pctVar(fact.ca_total,     factN1.ca_total)     : null,
    varEnc:  fact && factN1 ? pctVar(fact.encaissement, factN1.encaissement) : null,
    varImp:  fact && factN1 ? pctVar(fact.impaye,       factN1.impaye)       : null,
    varTaux: fact && factN1
      ? Math.round((fact.taux_recouvrement - factN1.taux_recouvrement) * 10) / 10
      : null,
    varFact: fact && factN1 ? pctVar(fact.nb_factures,  factN1.nb_factures)  : null,
  }), [fact, factN1])

  /* ─── Statuts ───────────────────────────────────────────────────────── */
  const factSt: Statut = fact ? statutTaux(fact.taux_recouvrement) : 'neutral'
  const rhSt:   Statut = rh
    ? (rh.taux_hs >= SEUIL.HS_RATIO || rh.pct_formes < SEUIL.FORMATION_MIN ? 'warning' : 'ok')
    : 'neutral'
  const globalSt: Statut = factSt === 'critical' ? 'critical'
    : (factSt === 'ok' && rhSt === 'ok') ? 'ok' : 'warning'

  // Skeletons uniquement au premier chargement (pas sur refresh)
  const fLoad = factState === 'loading' && fact === null
  const rLoad = rhState   === 'loading' && rh   === null

  const perimetre = user?.dt
    ? user.dt.replace(/Direction R[eé]gionale\s*/i, '').replace(/Direction Territoriale\s*/i, '')
    : "SEN'EAU — Vue globale"

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 14,
    boxShadow: '0 2px 10px rgba(31,59,114,.10)', overflow: 'hidden',
  }

  return (
    <>
      <TopBar />
      <div style={{
        flex: 1, overflowY: 'auto', background: C_PAGE,
        padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18,
        fontFamily: F_BODY,
      }}>

        {/* ══ EN-TÊTE ═════════════════════════════════════════════════════ */}
        <div style={{
          background: `linear-gradient(135deg, ${C_NAVY} 0%, #2350a0 70%, #1a4580 100%)`,
          borderRadius: 12, padding: '20px 26px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            borderRadius: '50%', background: 'rgba(150,193,30,.05)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: F_TITLE, fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
              {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Périmètre
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,.10)', borderRadius: 6, padding: '2px 10px' }}>
                {perimetre}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>
                Exercice {annee} / N-1 {annee - 1}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', flexWrap: 'wrap' }}>
            {/* Santé globale */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 8, padding: '8px 14px',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: globalSt === 'ok' ? '#4ade80' : globalSt === 'critical' ? '#f87171' : '#fbbf24',
                boxShadow: `0 0 6px ${globalSt === 'ok' ? '#4ade80' : globalSt === 'critical' ? '#f87171' : '#fbbf24'}`,
              }} />
              <div>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Santé globale
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>
                  {globalSt === 'ok' ? 'Tous objectifs atteints'
                    : globalSt === 'critical' ? 'Indicateurs critiques'
                    : 'Points à surveiller'}
                </div>
              </div>
            </div>

            {/* Heure + refresh */}
            {lastAt && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)',
                borderRadius: 8, padding: '8px 12px',
              }}>
                <div>
                  <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Actualisé
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>{lastAt}</div>
                </div>
                <button
                  onClick={() => fetchAll(user, annee)}
                  title="Rafraîchir"
                  style={{
                    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 6, width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'rgba(255,255,255,.5)', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.14)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = 'rgba(255,255,255,.5)' }}
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══ SEGMENT : FACTURATION & RECOUVREMENT ══════════════════════ */}
        <div style={card}>
          <SegHead
            color={C_NAVY}
            title="Facturation & Recouvrement"
            meta={`mv_recouvrement · ${annee} vs ${annee - 1}${user?.dt ? ` · ${shortDr(user.dt)}` : ' · Toutes directions'}`}
            statut={factSt}
            href="/dashboard/rapports/recouvrement"
            loading={fLoad}
          />

          {/* Grille KPI — même style flex que les rapports */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '18px 22px' }}>
            <KpiCard
              label="Chiffre d'affaires"
              value={fLoad ? '—' : fmtM(fact?.ca_total ?? 0)}
              sub="FCFA"
              accent={C_NAVY}
              variation={varCa}
              loading={fLoad}
            />
            <KpiCard
              label="Taux de recouvrement"
              value={fLoad ? '—' : fmt(fact?.taux_recouvrement ?? 0, 1) + ' %'}
              sub={varTaux != null ? `${annee - 1} : ${fmt((fact?.taux_recouvrement ?? 0) - (varTaux ?? 0), 1)} %` : undefined}
              accent={factSt !== 'neutral' ? STATUS_CFG[factSt].dot : C_NAVY}
              variation={varTaux}
              statut={factSt}
              pct={fact?.taux_recouvrement}
              pctMax={100}
              objectif={`${SEUIL.TAUX_OBJECTIF} %`}
              loading={fLoad}
            />
            <KpiCard
              label="Encaissements"
              value={fLoad ? '—' : fmtM(fact?.encaissement ?? 0)}
              sub="FCFA"
              accent={C_GREEN}
              variation={varEnc}
              loading={fLoad}
            />
            <KpiCard
              label="Impayés"
              value={fLoad ? '—' : fmtM(fact?.impaye ?? 0)}
              sub="FCFA"
              accent={fact && fact.taux_impaye >= SEUIL.IMPAYE_RATIO ? STATUS_CFG.critical.dot : C_NAVY}
              variation={varImp}
              varInverse
              statut={fact ? (fact.taux_impaye >= SEUIL.IMPAYE_RATIO ? 'critical' : 'ok') : 'neutral'}
              loading={fLoad}
            />
            <KpiCard
              label="Taux d'impayés"
              value={fLoad ? '—' : fmt(fact?.taux_impaye ?? 0, 1) + ' %'}
              accent={fact ? (fact.taux_impaye >= SEUIL.IMPAYE_RATIO ? STATUS_CFG.critical.dot : C_GREEN) : C_NAVY}
              statut={fact ? (fact.taux_impaye >= SEUIL.IMPAYE_RATIO ? 'critical' : 'ok') : 'neutral'}
              pct={fact?.taux_impaye}
              pctMax={20}
              objectif={`< ${SEUIL.IMPAYE_RATIO} %`}
              loading={fLoad}
            />
            <KpiCard
              label="Factures émises"
              value={fLoad ? '—' : fmt(fact?.nb_factures ?? 0)}
              accent={C_NAVY}
              variation={varFact}
              loading={fLoad}
            />
            {isGlobal && (
              <KpiCard
                label="Directions à risque"
                value={fLoad ? '—' : String(fact?.dts_a_risque?.length ?? 0)}
                sub={`sur ${fact?.nb_dr ?? '—'} directions régionales`}
                accent={
                  fact
                    ? fact.dts_a_risque.length === 0 ? C_GREEN
                      : fact.dts_a_risque.length <= 2 ? '#D97706' : STATUS_CFG.critical.dot
                    : C_NAVY
                }
                statut={
                  fact
                    ? fact.dts_a_risque.length === 0 ? 'ok'
                      : fact.dts_a_risque.length <= 2 ? 'warning' : 'critical'
                    : 'neutral'
                }
                loading={fLoad}
              />
            )}
          </div>

          {/* Classement DRs (vue globale) ou Classement UOs (vue DT) */}
          {isGlobal
            ? <DrTable rows={fact?.par_dr ?? []} loading={fLoad} />
            : <UoTable rows={fact?.par_uo ?? []} loading={fLoad} />
          }

          {/* Séparateur visuel */}
          {(fact?.par_bimestre?.length || fLoad) && (
            <div style={{ margin: '0 22px', borderTop: '1px solid #f1f5f9' }} />
          )}

          {/* Évolution bimestrielle + Groupes de facturation côte à côte */}
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', borderRight: '1px solid #f8fafc' }}>
              <ChartBimestre rows={fact?.par_bimestre ?? []} loading={fLoad} />
            </div>
            <div style={{ flex: '1 1 320px' }}>
              <ChartGroupes rows={fact?.par_groupe_facturation ?? []} loading={fLoad} />
            </div>
          </div>

          {factState === 'error' && (
            <div style={{ margin: '0 22px 16px' }}>
              <div style={{
                background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.12)',
                borderRadius: 7, padding: '9px 14px',
                fontSize: 11, color: '#991b1b', fontFamily: F_BODY,
              }}>
                Impossible de charger les données facturation — vérifiez la connexion base de données.
              </div>
            </div>
          )}
        </div>

        {/* ══ SEGMENT : RESSOURCES HUMAINES ═════════════════════════════ */}
        <div style={card}>
          <SegHead
            color="#7C3AED"
            title="Ressources Humaines"
            meta={`dwh_rh · ${annee} vs ${annee - 1} · Vue globale SEN'EAU`}
            statut={rhSt}
            href="/dashboard/rapports/rh"
            loading={rLoad}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '18px 22px' }}>
            <KpiCard
              label="Effectif total"
              value={rLoad ? '—' : fmt(rh?.nb_salaries ?? 0)}
              sub="collaborateurs"
              accent="#7C3AED"
              variation={rh?.variation?.nb_salaries ?? null}
              loading={rLoad}
            />
            <KpiCard
              label="Masse salariale"
              value={rLoad ? '—' : fmtM(rh?.masse_salariale ?? 0)}
              sub="FCFA"
              accent={C_NAVY}
              variation={rh?.variation?.masse_salariale ?? null}
              loading={rLoad}
            />
            <KpiCard
              label="Salaire moyen"
              value={rLoad ? '—' : fmtM(rh?.salaire_moyen ?? 0)}
              sub="FCFA"
              accent={C_NAVY}
              variation={rh?.variation?.salaire_moyen ?? null}
              loading={rLoad}
            />
            <KpiCard
              label="Ancienneté moyenne"
              value={rLoad ? '—' : fmt(rh?.anciennete_moy ?? 0, 1)}
              sub="ans"
              accent={C_NAVY}
              loading={rLoad}
            />
            <KpiCard
              label="Taux de féminisation"
              value={rLoad ? '—' : fmt(rh?.taux_feminisation ?? 0, 1) + ' %'}
              accent={rh ? (rh.taux_feminisation >= SEUIL.TAUX_FEM_MIN ? C_GREEN : '#D97706') : C_NAVY}
              statut={rh ? (rh.taux_feminisation >= SEUIL.TAUX_FEM_MIN ? 'ok' : 'warning') : 'neutral'}
              pct={rh?.taux_feminisation}
              pctMax={40}
              objectif={`≥ ${SEUIL.TAUX_FEM_MIN} %`}
              loading={rLoad}
            />
            <KpiCard
              label="Taux heures supplémentaires"
              value={rLoad ? '—' : fmt(rh?.taux_hs ?? 0, 2) + ' %'}
              accent={rh ? (rh.taux_hs < SEUIL.HS_RATIO ? C_GREEN : '#D97706') : C_NAVY}
              variation={rh?.variation?.montant_hs ?? null}
              varInverse
              statut={rh ? (rh.taux_hs < SEUIL.HS_RATIO ? 'ok' : 'warning') : 'neutral'}
              pct={rh?.taux_hs}
              pctMax={10}
              objectif={`< ${SEUIL.HS_RATIO} %`}
              loading={rLoad}
            />
            <KpiCard
              label="Collaborateurs formés"
              value={rLoad ? '—' : fmt(rh?.pct_formes ?? 0, 1) + ' %'}
              sub={rLoad ? undefined : `${fmt(rh?.nb_collaborateurs_formes ?? 0)} collaborateurs`}
              accent={rh ? (rh.pct_formes >= SEUIL.FORMATION_MIN ? C_GREEN : '#D97706') : C_NAVY}
              statut={rh ? (rh.pct_formes >= SEUIL.FORMATION_MIN ? 'ok' : 'warning') : 'neutral'}
              pct={rh?.pct_formes}
              pctMax={100}
              objectif={`≥ ${SEUIL.FORMATION_MIN} %`}
              loading={rLoad}
            />
            <KpiCard
              label="Heures de formation"
              value={rLoad ? '—' : fmt(rh?.nb_heures_formation ?? 0)}
              sub="heures"
              accent="#7C3AED"
              variation={rh?.variation?.nb_heures_formation ?? null}
              loading={rLoad}
            />
          </div>

          {rhState === 'error' && (
            <div style={{ margin: '0 22px 16px' }}>
              <div style={{
                background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.12)',
                borderRadius: 7, padding: '9px 14px',
                fontSize: 11, color: '#991b1b', fontFamily: F_BODY,
              }}>
                Impossible de charger les données RH — vérifiez la connexion base de données.
              </div>
            </div>
          )}
        </div>

        {/* ══ NAVIGATION RAPIDE ═════════════════════════════════════════ */}
        <div style={{
          background: '#fff', borderRadius: 10,
          boxShadow: '0 2px 10px rgba(31,59,114,.10)',
          padding: '11px 22px',
          display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '.09em', color: 'rgba(31,59,114,.3)',
            fontFamily: F_BODY, marginRight: 18, whiteSpace: 'nowrap',
          }}>Accès rapide</span>
          {[
            { href: '/dashboard/rapports/recouvrement', label: 'Rapport Recouvrement' },
            { href: '/dashboard/rapports/rh',           label: 'Rapport RH'           },
            { href: '/dashboard/self-service',          label: 'Self-Service BI'       },
            { href: '/dashboard/carte',                 label: 'Carte'                 },
            { href: '/dashboard/hub-ia',                label: 'Hub IA JAMBAR'         },
          ].map((item, i, arr) => (
            <span key={item.href} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Link href={item.href} style={{
                fontSize: 11.5, fontWeight: 700, color: C_NAVY, textDecoration: 'none',
                opacity: .5, transition: 'opacity .14s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '.5')}
              >
                {item.label}
              </Link>
              {i < arr.length - 1 && (
                <span style={{ color: 'rgba(31,59,114,.18)', margin: '0 12px', fontSize: 12 }}>·</span>
              )}
            </span>
          ))}
        </div>

        {/* ══ FOOTER ════════════════════════════════════════════════════ */}
        <p style={{
          textAlign: 'center', fontSize: 10.5, color: 'rgba(31,59,114,.2)',
          fontWeight: 500, margin: 0, paddingBottom: 4,
        }}>
          © 2025 SEN&#39;EAU · Conçu par{' '}
          <strong style={{ color: 'rgba(31,59,114,.32)' }}>Asta Niang</strong> — Data Engineer
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </>
  )
}
