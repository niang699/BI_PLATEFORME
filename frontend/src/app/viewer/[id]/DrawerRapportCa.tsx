'use client'
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis, Legend, ReferenceLine,
} from 'recharts'
import { X as XIcon, TrendingDown, AlertTriangle, Users, DollarSign, BarChart2 } from 'lucide-react'

/* ── Constantes ── */
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_RED   = '#dc2626'
const C_GREEN = '#16a34a'
const C_AMB   = '#d97706'

/* ── Types ── */
interface CaRow {
  uo:                  string
  nb_prises_non_fact:  number
  ca_manquant_estime:  number
  ca_median_par_prise: number
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

const FIABILITE_CFG = {
  haute:      { color: C_GREEN, label: 'Haute',      bg: 'rgba(22,163,74,.1)'  },
  acceptable: { color: C_AMB,   label: 'Acceptable', bg: 'rgba(217,119,6,.1)'  },
  indicatif:  { color: '#94a3b8', label: 'Indicatif', bg: 'rgba(148,163,184,.1)' },
}

/* ── Formatage ── */
function fmtCfa(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Mds F'
  if (v >= 1_000_000)     return (v / 1_000_000).toLocaleString('fr-FR',     { maximumFractionDigits: 1 }) + ' MF'
  if (v >= 1_000)         return (v / 1_000).toLocaleString('fr-FR',         { maximumFractionDigits: 0 }) + ' kF'
  return v.toLocaleString('fr-FR') + ' F'
}
function fmtN(v: number) { return v.toLocaleString('fr-FR') }
function pct(v: number, t: number) { return t > 0 ? Math.round(v / t * 10) / 10 : 0 }

/* ── Tooltip recharts personnalisé ── */
function TooltipCfa({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(0,0,0,.10)' }}>
      <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#334155', marginBottom: 2 }}>
          <span style={{ fontWeight: 700 }}>{p.name} : </span>{fmtCfa(p.value)}
        </div>
      ))}
    </div>
  )
}

function TooltipPrises({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(0,0,0,.10)' }}>
      <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#334155', marginBottom: 2 }}>
          <span style={{ fontWeight: 700 }}>{p.name} : </span>{typeof p.value === 'number' && p.name?.includes('CA') ? fmtCfa(p.value) : fmtN(p.value)}
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════════════════ */
export default function DrawerRapportCa({
  annee, bimestre, dr, totalParcActif, onClose,
}: {
  annee:          number
  bimestre:       string
  dr:             string
  totalParcActif: number
  onClose:        () => void
}) {
  const [rows,     setRows]     = useState<CaRow[]>([])
  const [tendance, setTendance] = useState<TendancePoint[]>([])
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')
  const [sortCol,  setSortCol]  = useState<keyof CaRow>('ca_manquant_estime')
  const [sortAsc,  setSortAsc]  = useState(false)

  /* ── Fetch données ── */
  useEffect(() => {
    setLoading(true); setErr('')
    const p = new URLSearchParams({ annee: String(annee) })
    if (bimestre) p.set('bimestre', bimestre)
    if (dr)       p.set('dr', dr)

    Promise.all([
      fetch(`/api/carte/ca-manquant?${p}`).then(r => r.ok ? r.json() : Promise.reject('Erreur CA')),
      fetch(`/api/carte/ca-manquant/tendance?${new URLSearchParams({ annee: String(annee), ...(dr ? { dr } : {}) })}`).then(r => r.ok ? r.json() : Promise.reject('Erreur tendance')),
    ])
      .then(([ca, tend]) => {
        setRows(ca.rows ?? [])
        setTendance(tend.points ?? [])
        setLoading(false)
      })
      .catch(e => { setErr(String(e)); setLoading(false) })
  }, [annee, bimestre, dr])

  /* ── Totaux ── */
  const totalCa    = rows.reduce((s, r) => s + r.ca_manquant_estime,  0)
  const totalPrises = rows.reduce((s, r) => s + r.nb_prises_non_fact, 0)
  const pctNonFact  = pct(totalPrises, totalParcActif)
  const worstUo     = rows[0]?.uo ?? '—'
  const worstCa     = rows[0]?.ca_manquant_estime ?? 0

  /* ── Données graphiques ── */
  const top10 = rows.slice(0, 10).map(r => ({
    uo:  r.uo.length > 18 ? r.uo.slice(0, 16) + '…' : r.uo,
    uoFull: r.uo,
    ca:  r.ca_manquant_estime,
    prs: r.nb_prises_non_fact,
  })).reverse() // recharts BarChart horizontal : ordre inversé = ordre naturel visuel

  const scatterData = rows.map(r => ({
    x: r.nb_prises_non_fact,
    y: r.ca_median_par_prise,
    z: r.ca_manquant_estime,
    name: r.uo,
  }))

  /* ── Tri tableau ── */
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortCol] as number | string
    const bv = b[sortCol] as number | string
    return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })

  function toggleSort(col: keyof CaRow) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  const Th = ({ col, label }: { col: keyof CaRow; label: string }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{ padding: '8px 12px', textAlign: 'right', fontSize: 9, fontWeight: 700, color: sortCol === col ? C_NAVY : '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '.05em', cursor: 'pointer', whiteSpace: 'nowrap',
        borderBottom: '2px solid', borderColor: sortCol === col ? C_NAVY : '#f1f5f9', userSelect: 'none' }}
    >
      {label} {sortCol === col ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  /* ══ RENDU ══ */
  return (
    <>
      {/* Fond semi-transparent */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(2px)', animation: 'fadeIn .2s ease' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1500,
        width: 'min(820px, 95vw)', background: '#f8fafc',
        boxShadow: '-8px 0 60px rgba(0,0,0,.22)',
        display: 'flex', flexDirection: 'column',
        fontFamily: F_BODY, animation: 'slideRight .25s cubic-bezier(.22,1,.36,1)',
      }}>
        <style>{`
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
          @keyframes slideRight{from{transform:translateX(60px);opacity:0}to{transform:none;opacity:1}}
        `}</style>

        {/* ── En-tête ── */}
        <div style={{ padding: '18px 24px 16px', background: `linear-gradient(135deg, ${C_NAVY} 0%, #2d4a8a 100%)`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: F_TITLE, letterSpacing: '-.01em', lineHeight: 1.2 }}>
                Rapport — Prises non facturées
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>Année {annee}</span>
                {bimestre && <span>· Bimestre {bimestre}</span>}
                {dr        && <span>· DR {dr}</span>}
                <span suppressHydrationWarning style={{ opacity: .5 }}>· {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.12)')}
            >
              <XIcon size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── KPI cards ── */}
          {!loading && !err && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
              {[
                { icon: <DollarSign size={14} />, label: 'CA manquant estimé', value: fmtCfa(totalCa), color: '#fca5a5', sub: 'Estimation pondérée / UO' },
                { icon: <Users size={14} />,       label: 'Prises non facturées', value: fmtN(totalPrises), color: '#93c5fd', sub: `${pctNonFact}% du parc actif` },
                { icon: <TrendingDown size={14} />, label: 'Parc actif suivi',  value: fmtN(totalParcActif), color: '#86efac', sub: 'Clients actifs au total' },
                { icon: <AlertTriangle size={14} />, label: 'UO la plus exposée', value: worstUo, color: '#fcd34d', sub: fmtCfa(worstCa) + ' manquants' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,.10)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: k.color, marginBottom: 4 }}>
                    {k.icon}
                    <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'rgba(255,255,255,.5)' }}>{k.label}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: F_TITLE, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Corps (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid #e2e8f0`, borderTopColor: C_RED, animation: 'spin .8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontSize: 13, fontWeight: 700, color: C_NAVY }}>Calcul en cours…</div>
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
                Stratification par UO · mise en cache 30 min<br/>
                <span style={{ color: C_AMB }}>La 1ère requête peut prendre quelques secondes</span>
              </div>
            </div>
          )}

          {!loading && err && (
            <div style={{ background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 10, padding: '14px 16px', color: C_RED, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={15} /> {err}
            </div>
          )}

          {!loading && !err && rows.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: C_GREEN }}>
              <div style={{ fontSize: 32 }}>✓</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Toutes les prises actives sont facturées</div>
            </div>
          )}

          {!loading && !err && rows.length > 0 && (
            <>
              {/* ══ SECTION 1 : Top 10 UO ══════════════════════════════════════ */}
              <Section title="Top 10 UO — CA manquant estimé" icon={<BarChart2 size={14} />}>
                <ResponsiveContainer width="100%" height={Math.max(220, top10.length * 36 + 40)}>
                  <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => fmtCfa(v)} tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="uo" width={110} tick={{ fontSize: 10, fontFamily: F_BODY, fill: C_NAVY, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipCfa />} cursor={{ fill: 'rgba(31,59,114,.04)' }} />
                    <Bar dataKey="ca" name="CA manquant" fill={C_RED} radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: 'right', formatter: (v: unknown) => fmtCfa(Number(v)), fontSize: 9, fill: '#64748b', fontFamily: F_BODY }} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>

              {/* ══ SECTION 2 : Tendance bimestrielle ════════════════════════ */}
              {tendance.some(p => p.ca_manquant_total > 0) && (
                <Section title={`Évolution bimestrielle ${annee} — CA manquant & prises`} icon={<TrendingDown size={14} />}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={tendance} margin={{ top: 8, right: 24, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: F_BODY, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="ca"  orientation="left"  tickFormatter={v => fmtCfa(v)}  tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="prs" orientation="right" tickFormatter={v => fmtN(v)}     tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<TooltipPrises />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontFamily: F_BODY }} />
                      <Line yAxisId="ca"  type="monotone" dataKey="ca_manquant_total"  name="CA manquant (F)"     stroke={C_RED}   strokeWidth={2.5} dot={{ r: 4, fill: C_RED }}   activeDot={{ r: 6 }} />
                      <Line yAxisId="prs" type="monotone" dataKey="nb_prises_non_fact" name="Prises non fact."   stroke={C_NAVY}  strokeWidth={2}   dot={{ r: 3, fill: C_NAVY }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                    * Axe gauche = CA manquant (F CFA) · Axe droit = Nombre de prises
                  </div>
                </Section>
              )}

              {/* ══ SECTION 3 : Scatter — Prises × CA moyen/prise ════════════ */}
              <Section title="Dispersion — Prises non facturées × CA moyen/prise" icon={<Users size={14} />}>
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ top: 8, right: 24, left: 10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="x" name="Prises non fact."   type="number" tickFormatter={fmtN}    tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} label={{ value: 'Prises non facturées', position: 'insideBottom', offset: -2, fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="y" name="CA moyen/prise (F)" type="number" tickFormatter={v => fmtCfa(v)} tick={{ fontSize: 9, fontFamily: F_BODY, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <ZAxis dataKey="z" range={[40, 400]} name="CA manquant (F)" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 11, fontFamily: F_BODY, boxShadow: '0 4px 20px rgba(0,0,0,.10)' }}>
                          <div style={{ fontWeight: 800, color: C_NAVY, marginBottom: 6 }}>{d?.name}</div>
                          <div style={{ color: '#334155', marginBottom: 2 }}><span style={{ fontWeight: 700 }}>Prises : </span>{fmtN(d?.x)}</div>
                          <div style={{ color: '#334155', marginBottom: 2 }}><span style={{ fontWeight: 700 }}>CA moy/prise : </span>{fmtCfa(d?.y)}</div>
                          <div style={{ color: C_RED, fontWeight: 700 }}><span style={{ fontWeight: 700 }}>CA manquant : </span>{fmtCfa(d?.z)}</div>
                        </div>
                      )
                    }} />
                    <Scatter data={scatterData} fill={C_RED} fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4 }}>
                  * Taille du point proportionnelle au CA manquant estimé
                </div>
              </Section>

              {/* ══ SECTION 4 : Tableau complet ══════════════════════════════ */}
              <Section title="Détail par UO" icon={<BarChart2 size={14} />}>
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th onClick={() => toggleSort('uo')} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: sortCol === 'uo' ? C_NAVY : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', cursor: 'pointer', borderBottom: '2px solid', borderColor: sortCol === 'uo' ? C_NAVY : '#f1f5f9', whiteSpace: 'nowrap' }}>
                          UO {sortCol === 'uo' ? (sortAsc ? '↑' : '↓') : ''}
                        </th>
                        <Th col="nb_prises_non_fact"  label="Prises non fact." />
                        <Th col="ca_median_par_prise" label="CA moy/prise" />
                        <Th col="ca_manquant_estime"  label="CA manquant" />
                        <Th col="nb_obs_stratum"      label="Obs." />
                        <Th col="fiabilite"           label="Fiabilité" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r, i) => {
                        const fib = FIABILITE_CFG[r.fiabilite] ?? FIABILITE_CFG.indicatif
                        return (
                          <tr key={r.uo} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ padding: '7px 12px', fontWeight: 800, color: C_NAVY }}>{r.uo}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: C_RED }}>{fmtN(r.nb_prises_non_fact)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', color: '#334155' }}>{fmtCfa(r.ca_median_par_prise)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 900, color: C_RED, fontFamily: F_TITLE, fontSize: 12 }}>{fmtCfa(r.ca_manquant_estime)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8', fontSize: 10 }}>{fmtN(r.nb_obs_stratum)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                              <span style={{ background: fib.bg, color: fib.color, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, border: `1px solid ${fib.color}40` }}>
                                {fib.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'rgba(31,59,114,.04)', borderTop: '2px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 900, color: C_NAVY, fontSize: 11 }}>TOTAL</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: C_RED }}>{fmtN(totalPrises)}</td>
                        <td />
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: C_RED, fontFamily: F_TITLE, fontSize: 13 }}>{fmtCfa(totalCa)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
                  * <strong>Méthode :</strong> CA manquant = (Prises actives – Prises facturées) × CA moyen par prise dans l'UO.<br/>
                  * <strong>Fiabilité :</strong> Haute ≥ 20 observations · Acceptable ≥ 5 · Indicatif &lt; 5.
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Wrapper section ── */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 1px 6px rgba(31,59,114,.06)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: C_NAVY, opacity: .5 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: C_NAVY, fontFamily: "'Barlow Semi Condensed', sans-serif" }}>{title}</span>
      </div>
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  )
}
