'use client'
import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Users, Banknote, Clock, GraduationCap, BarChart2, Info } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

/* ═══════════════════════════════ CONSTANTES ════════════════════════════════ */
const F_TITLE  = "'Barlow Semi Condensed', sans-serif"
const F_BODY   = "'Nunito', sans-serif"
/* ── Palette ultra-pro · Power BI style ─────────────────────────────────────
 *  3 couleurs signature  +  nuances sémantiques
 *  Référence : #118DFF (Power Blue) · #96C11E (Seneau Vert) · #7B72D4 (Indigo)
 * ────────────────────────────────────────────────────────────────────────── */
const C_NAVY   = '#118DFF'   // Power Blue   — indicateurs principaux & masse
const C_GREEN  = '#96C11E'   // Vert Seneau  — effectif, formation, positif
const C_PURPLE = '#7B72D4'   // Indigo       — répartitions, accent
/* Nuances secondaires */
const C_BLUE   = '#56AEFF'   // Bleu ciel    — lignes N-1, compléments
const C_ORANGE = '#F28050'   // Orange sunset — HS, alertes modérées
const C_RED    = '#D85C5C'   // Rouge doux   — alertes critiques uniquement
const C_GRAY   = '#C4845A'   // Orange terre — neutres, lignes secondaires

const SEUIL_FEMINISATION = 20
const SEUIL_TAUX_HS      = 2.5
const OBJECTIF_FORMATION = 25_000

/* Palettes dégradées — chaque hue en 6 tons du plus sombre au plus clair */
const PALETTE_NAVY   = ['#118DFF','#3EA5FF','#66BAFF','#90CCFF','#BADFFF','#DCEEFF']
const PALETTE_GREEN  = ['#96C11E','#A8D130','#BCE048','#CDE872','#DEF0A0','#EEF6CC']
const PALETTE_PURPLE = ['#7B72D4','#9288E0','#AAAAEA','#C2C0F2','#D8D8F8','#ECEEF8']
/* Palette mixte 9 tons — alterne les 3 hues pour graphiques multi-segments */
const PALETTE_MIX    = [
  '#118DFF','#96C11E','#7B72D4',
  '#3EA5FF','#A8D130','#9288E0',
  '#66BAFF','#BCE048','#AAAAEA',
]

/* ═══════════════════════════════ TYPES ═════════════════════════════════════ */
interface RhKpis {
  nb_salaries: number; nb_femmes: number; taux_feminisation: number
  nb_cdi: number; nb_cdd: number; taux_cdi: number; anciennete_moy: number
  masse_salariale: number; salaire_moyen: number
  montant_hs: number; nb_heures_sup: number; taux_hs: number
  nb_heures_formation: number; nb_collaborateurs_formes: number; pct_formes: number
  variation: Record<string, number | null>
  concentration: { pct_top20: number; nb_top20: number; masse_top20: number; masse_totale: number }
  annee_precedente: string | null
}
interface MoisRow {
  mois: number; label: string; masse: number; masse_n1: number; masse_cumul: number
  nb_hs: number; montant_hs: number
}
interface EtaEffRow   { etablissement: string; effectif: number }
interface EtaMasseRow { etablissement: string; masse: number }
interface QualiRow    { qualification: string; effectif: number }
interface StatutRow   { statut: string; masse: number }
interface ThemeRow    { theme: string; heures: number; nb_collab: number }
interface FormEtaRow  { etablissement: string; heures: number; nb_collab: number }
interface AnneeEffRow { annee: number; nb_total: number; nb_femmes: number; nb_hommes: number; taux_feminisation: number }
interface AnneeMasseRow { annee: number; masse: number; is_last: boolean }
interface AncTrancheRow { tranche: string; sort_key: number; effectif: number }
interface ContratRow    { type_contrat: string; libelle: string; effectif: number }
interface HsRubriqueRow { rubrique: string; montant: number; nb_collab: number }
interface HsEtaRow      { etablissement: string; montant: number; nb_heures: number; nb_collab: number }
interface HsCatRow      { categorie: string; montant: number }
interface AnneeHsRow    { annee: number; montant_hs: number; nb_heures: number; is_last: boolean }

interface Details {
  effectif_par_eta: EtaEffRow[]
  effectif_par_qualification: QualiRow[]
  masse_par_eta: EtaMasseRow[]
  masse_par_statut: StatutRow[]
  formation_par_theme: ThemeRow[]
  formation_par_eta: FormEtaRow[]
  anciennete_tranches: AncTrancheRow[]
  repartition_contrat: ContratRow[]
  hs_par_rubrique: HsRubriqueRow[]
  hs_par_eta: HsEtaRow[]
  hs_par_categorie: HsCatRow[]
}
interface Evolution {
  mensuel: MoisRow[]
  annuelle_effectif: AnneeEffRow[]
  annuelle_masse: AnneeMasseRow[]
  annuelle_hs: AnneeHsRow[]
  annee_n1: string | null
}

/* ═══════════════════════════════ HELPERS ═══════════════════════════════════ */
const fmtN   = (v: number) => Math.round(v).toLocaleString('fr-FR')
const fmtPct = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %'
function fmtFcfa(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Mds'
  if (v >= 1_000_000)     return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M'
  return v.toLocaleString('fr-FR') + ' F'
}
function varColor(v: number | null | undefined, inverse = false): string {
  if (v == null) return 'rgba(31,59,114,.35)'
  const positive = inverse ? v <= 0 : v >= 0
  return positive ? C_GREEN : C_RED
}
function varLabel(v: number | null | undefined): string {
  if (v == null) return ''
  return (v >= 0 ? '▲ +' : '▼ ') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + '%'
}

/* ═══════════════════════════════ UI ATOMS ══════════════════════════════════ */
function KpiCard({ label, value, sub, accent, icon, variation, varInverse, info }: {
  label: string; value: string; sub?: string; accent?: string
  icon?: React.ReactNode; variation?: number | null; varInverse?: boolean; info?: string
}) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 20px',
      boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5',
      flex: '1 1 160px', minWidth: 150, position: 'relative',
    }}>
      {icon && <div style={{ marginBottom: 8, color: accent ?? C_NAVY, opacity: .65 }}>{icon}</div>}
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)',
        textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY, marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        {info && (
          <span
            style={{ cursor: 'pointer', color: C_BLUE }}
            onClick={() => setShowInfo(s => !s)}
          >
            <Info size={10} />
          </span>
        )}
      </div>
      {showInfo && info && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 10, background: '#fff',
          border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 12px',
          fontSize: 10, fontFamily: F_BODY, color: C_NAVY, boxShadow: '0 4px 16px rgba(31,59,114,.12)',
          maxWidth: 260, lineHeight: 1.5,
        }}>{info}</div>
      )}
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: F_TITLE, color: accent ?? C_NAVY, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 4, fontFamily: F_BODY }}>
          {sub}
        </div>
      )}
      {variation != null && (
        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, fontFamily: F_BODY, color: varColor(variation, varInverse) }}>
          {varLabel(variation)}
        </div>
      )}
    </div>
  )
}

function KpiBadge({ label, value, unit, badge, badgeSeuil, badgeInverse, sub }: {
  label: string; value: string; unit?: string
  badge?: number; badgeSeuil?: number; badgeInverse?: boolean; sub?: string
}) {
  const ok = badge != null && badgeSeuil != null
    ? (badgeInverse ? badge <= badgeSeuil : badge >= badgeSeuil)
    : null
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 20px',
      boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5',
      flex: '1 1 160px', minWidth: 150,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: F_TITLE, color: C_NAVY }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, fontFamily: F_BODY, color: 'rgba(31,59,114,.4)', fontWeight: 600 }}>{unit}</span>}
        {ok !== null && badgeSeuil != null && (
          <span style={{ fontSize: 10, fontWeight: 700, color: ok ? C_GREEN : C_RED, marginLeft: 4 }}>
            {ok ? '▲' : '▼'} {badgeSeuil}%
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500, marginTop: 4, fontFamily: F_BODY }}>{sub}</div>}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5',
    }}>{children}</div>
  )
}

function PanelHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 4, height: 18, borderRadius: 99, background: color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ fontFamily: F_BODY, fontSize: 11, fontWeight: 800, color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {title}
      </span>
    </div>
  )
}

function ProgressBar({ value, color, label, objective, objectiveLabel }: {
  value: number; color: string; label?: string; objective?: number; objectiveLabel?: string
}) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div style={{ marginTop: 4 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, marginBottom: 6 }}>
          <span>{label}</span>
          {objectiveLabel && <span>{objectiveLabel}</span>}
        </div>
      )}
      <div style={{ height: 8, borderRadius: 99, background: '#f0f3f9', overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .4s ease' }} />
        {objective !== undefined && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${objective}%`, width: 2, background: 'rgba(31,59,114,.25)' }} />
        )}
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', color: 'rgba(31,59,114,.45)', fontSize: 13, fontFamily: F_BODY }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-rh 0.8s linear infinite', flexShrink: 0 }} />
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
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ fontSize: 11, fontWeight: 600, fontFamily: F_BODY, border: '1px solid #e8edf5', borderRadius: 8, padding: '4px 10px', background: '#f8fafc', color: 'rgba(31,59,114,.45)', cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function KpiRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>
}

/* ── Tooltip recharts ── */
function ChTip({ active, payload, label, fmtVal, fmtByName }: {
  active?: boolean; payload?: { value: number; name: string; dataKey?: string; color: string }[]
  label?: string; fmtVal?: (v: number) => string
  fmtByName?: Record<string, (v: number) => string>
}) {
  if (!active || !payload?.length) return null
  const fmt = fmtVal ?? fmtN
  return (
    <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(31,59,114,.12)', fontFamily: F_BODY }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C_NAVY, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => {
        const fn = fmtByName?.[p.dataKey ?? p.name] ?? fmt
        return <div key={i} style={{ fontSize: 11, color: p.color, fontWeight: 600 }}>{p.name} : {fn(p.value)}</div>
      })}
    </div>
  )
}

/* ══════════════════════════ SECTIONS ═══════════════════════════════════════ */

/* ── Dashboard ── */
function SectionDashboard({ d, details, evol }: { d: RhKpis; details: Details | null; evol: Evolution | null }) {
  const v = d.variation ?? {}
  const an1 = d.annee_precedente ? `vs ${d.annee_precedente}` : 'vs N-1'
  const masseStatut = details?.masse_par_statut ?? []
  const masseEta    = details?.masse_par_eta ?? []
  const effEta      = details?.effectif_par_eta ?? []
  const mensuel     = evol?.mensuel ?? []
  const total       = masseStatut.reduce((s, r) => s + r.masse, 0) || 1

  return (
    <>
      {/* Ligne 1 — KPIs masse + effectif */}
      <Panel>
        <PanelHeader icon={<BarChart2 size={13} />} title="Indicateurs Clés" color={C_NAVY} />
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <KpiRow>
            <KpiCard label="Masse Salariale" value={fmtFcfa(d.masse_salariale)} accent={C_NAVY} icon={<Banknote size={16} />} variation={v.masse_salariale} sub={an1} />
            <KpiCard label="Salariés Actifs" value={fmtN(d.nb_salaries)} accent={C_BLUE} icon={<Users size={16} />} variation={v.nb_salaries} sub={an1} />
            <KpiCard label="Salaire Moyen" value={fmtFcfa(d.salaire_moyen)} accent={C_GREEN} variation={v.salaire_moyen} sub={an1} />
            <KpiBadge label="Taux Féminisation" value={d.taux_feminisation.toFixed(1)} unit="%" badge={d.taux_feminisation} badgeSeuil={SEUIL_FEMINISATION} sub={`${fmtN(d.nb_femmes)} femmes / ${fmtN(d.nb_salaries)}`} />
          </KpiRow>
          <KpiRow>
            <KpiCard label="Montant Heures Sup" value={fmtFcfa(d.montant_hs)} accent={C_ORANGE} icon={<Clock size={16} />} variation={v.montant_hs} varInverse sub={an1} />
            <KpiBadge label="Taux Heures Sup" value={d.taux_hs.toFixed(2)} unit="%" badge={d.taux_hs} badgeSeuil={SEUIL_TAUX_HS} badgeInverse sub={`${fmtN(d.nb_heures_sup)} h effectuées`} />
            <KpiCard label="Heures Formation" value={fmtN(d.nb_heures_formation)} accent={C_PURPLE} icon={<GraduationCap size={16} />} variation={v.nb_heures_formation} sub={an1} />
            <KpiCard label="% Collaborateurs Formés" value={fmtPct(d.pct_formes)} sub={`${fmtN(d.nb_collaborateurs_formes)} / ${fmtN(d.nb_salaries)}`} />
          </KpiRow>
        </div>
      </Panel>

      {/* Évolution mensuelle masse */}
      {mensuel.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Panel>
            <PanelHeader icon={<BarChart2 size={13} />} title="Évolution Mensuelle — Masse Salariale" color={C_NAVY} />
            <div style={{ padding: '18px 20px' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mensuel} margin={{ right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                  <YAxis tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} width={65} />
                  <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                  <Bar dataKey="masse" name="Masse Salariale" fill={C_NAVY} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel>
            <PanelHeader icon={<BarChart2 size={13} />} title="Masse Salariale par Statut" color={C_GREEN} />
            <div style={{ padding: '18px 20px' }}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={masseStatut} dataKey="masse" nameKey="statut" cx="40%" cy="50%" outerRadius={80} innerRadius={48}>
                    {masseStatut.map((_, i) => <Cell key={i} fill={PALETTE_MIX[i % PALETTE_MIX.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmtFcfa(v as number)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: F_BODY }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      )}

      {/* Masse et Effectif par établissement — côte à côte */}
      {(masseEta.length > 0 || effEta.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {masseEta.length > 0 && (
            <Panel>
              <PanelHeader icon={<BarChart2 size={13} />} title="Masse Salariale par Établissement" color={C_GREEN} />
              <div style={{ padding: '14px 18px' }}>
                <ResponsiveContainer width="100%" height={Math.max(180, masseEta.length * 24)}>
                  <BarChart data={masseEta} layout="vertical" barSize={10} margin={{ left: 4, right: 55, top: 2, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 8.5, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} />
                    <YAxis type="category" dataKey="etablissement" tick={{ fontSize: 9.5, fontFamily: F_BODY }} width={110} />
                    <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                    <Bar dataKey="masse" name="Masse Salariale" radius={[0,4,4,0]}>
                      {masseEta.map((_, i) => <Cell key={i} fill={PALETTE_GREEN[i % PALETTE_GREEN.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {effEta.length > 0 && (
            <Panel>
              <PanelHeader icon={<Users size={13} />} title="Effectif par Établissement" color={C_NAVY} />
              <div style={{ padding: '14px 18px' }}>
                <ResponsiveContainer width="100%" height={Math.max(180, effEta.length * 24)}>
                  <BarChart data={effEta} layout="vertical" barSize={10} margin={{ left: 4, right: 35, top: 2, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 8.5, fontFamily: F_BODY }} />
                    <YAxis type="category" dataKey="etablissement" tick={{ fontSize: 9.5, fontFamily: F_BODY }} width={110} />
                    <Tooltip content={<ChTip fmtVal={fmtN} />} />
                    <Bar dataKey="effectif" name="Effectif" radius={[0,4,4,0]}>
                      {effEta.map((_, i) => <Cell key={i} fill={PALETTE_NAVY[i % PALETTE_NAVY.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
        </div>
      )}
    </>
  )
}

/* ── Effectif ── */
function SectionEffectif({ d, details, evol }: { d: RhKpis; details: Details | null; evol: Evolution | null }) {
  const v        = d.variation ?? {}
  const an1      = d.annee_precedente ? `vs ${d.annee_precedente}` : 'vs N-1'
  const effEta   = details?.effectif_par_eta ?? []
  const effQuali = details?.effectif_par_qualification ?? []
  const annuelle = evol?.annuelle_effectif ?? []
  const ancTranches  = details?.anciennete_tranches ?? []
  const repContrat   = details?.repartition_contrat ?? []

  return (
    <>
      <Panel>
        <PanelHeader icon={<Users size={13} />} title="Effectifs" color={C_NAVY} />
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <KpiRow>
            <KpiCard label="Effectif Total" value={`${fmtN(d.nb_salaries)} salariés`} accent={C_NAVY} icon={<Users size={16} />} variation={v.nb_salaries} sub={an1} />
            <KpiCard label="Collaboratrices" value={`${fmtN(d.nb_femmes)} salariées`} accent={C_PURPLE} sub={`${fmtPct(d.taux_feminisation)} de l'effectif`} />
            <KpiCard label="Collaborateurs"  value={`${fmtN(d.nb_salaries - d.nb_femmes)} salariés`} accent={C_BLUE} sub={`${fmtPct(100 - d.taux_feminisation)} de l'effectif`} />
            <KpiBadge label="Taux Féminisation" value={d.taux_feminisation.toFixed(1)} unit="%" badge={d.taux_feminisation} badgeSeuil={SEUIL_FEMINISATION} sub={`${fmtN(d.nb_femmes)} femmes / ${fmtN(d.nb_salaries)}`} />
          </KpiRow>
          {/* Barre H/F */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, fontFamily: F_BODY, marginBottom: 10 }}>
              <span style={{ color: C_PURPLE }}>Femmes · {fmtPct(d.taux_feminisation)}</span>
              <span style={{ color: C_NAVY }}>Hommes · {fmtPct(100 - d.taux_feminisation)}</span>
            </div>
            <div style={{ height: 14, borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${d.taux_feminisation}%`, background: 'linear-gradient(90deg,#7B72D4,#AAAAEA)' }} />
              <div style={{ flex: 1, background: 'linear-gradient(90deg,#56AEFF,#118DFF)' }} />
            </div>
          </div>
          {/* Ancienneté + CDI/CDD */}
          <KpiRow>
            <KpiCard
              label="Ancienneté Moyenne"
              value={`${d.anciennete_moy.toFixed(1)} ans`}
              accent={C_ORANGE}
              sub="calculée sur l'effectif actif"
            />
            <KpiCard label="CDI" value={fmtN(d.nb_cdi)} accent={C_GREEN} sub={`${fmtPct(d.taux_cdi)} de l'effectif`} />
            <KpiCard label="CDD" value={fmtN(d.nb_cdd)} accent={C_RED}   sub={`${fmtPct(d.nb_salaries ? Math.round(d.nb_cdd / d.nb_salaries * 1000) / 10 : 0)} de l'effectif`} />
          </KpiRow>
        </div>
      </Panel>

      {/* Évolution annuelle + CDI/CDD côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
        {annuelle.length > 0 && (
          <Panel>
            <PanelHeader icon={<BarChart2 size={13} />} title="Évolution Effectif & Taux de Féminisation par Année" color={C_NAVY} />
            <div style={{ padding: '18px 20px' }}>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={annuelle} margin={{ right: 40 }} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" />
                  <XAxis dataKey="annee" tick={{ fontSize: 10, fontFamily: F_BODY }} />
                  <YAxis yAxisId="eff" tick={{ fontSize: 10, fontFamily: F_BODY }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10, fontFamily: F_BODY }} tickFormatter={v => Number(v).toFixed(1) + '%'} domain={[0, 'auto']} />
                  <Tooltip content={<ChTip fmtVal={fmtN} fmtByName={{ taux_feminisation: v => v.toFixed(1) + '%' }} />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, fontFamily: F_BODY }} />
                  <Bar yAxisId="eff" dataKey="nb_hommes" name="Hommes" stackId="s" fill={C_NAVY} barSize={12} />
                  <Bar yAxisId="eff" dataKey="nb_femmes" name="Femmes" stackId="s" fill={C_PURPLE} barSize={12} radius={[4,4,0,0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="taux_feminisation" name="Taux fémin. (%)" stroke={C_RED} strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}
        {repContrat.length > 0 && (
          <Panel>
            <PanelHeader icon={<Users size={13} />} title="CDI / CDD" color={C_GREEN} />
            <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100% - 40px)' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={repContrat} dataKey="effectif" nameKey="libelle" cx="50%" cy="50%" outerRadius={75} innerRadius={42}
                    label={(p: { libelle?: string; percent?: number }) => `${((p.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {repContrat.map((_, i) => <Cell key={i} fill={[C_NAVY, C_GREEN, C_PURPLE][i % 3]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmtN(v as number)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: F_BODY }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}
      </div>

      {/* Ancienneté par tranche */}
      {ancTranches.length > 0 && (
        <Panel>
          <PanelHeader icon={<Clock size={13} />} title="Ancienneté par Tranche" color={C_ORANGE} />
          <div style={{ padding: '18px 20px' }}>
            <ResponsiveContainer width="100%" height={Math.max(180, ancTranches.length * 36)}>
              <BarChart data={ancTranches} layout="vertical" barSize={10} margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                <YAxis type="category" dataKey="tranche" tick={{ fontSize: 10, fontFamily: F_BODY }} width={75} />
                <Tooltip content={<ChTip fmtVal={fmtN} />} />
                <Bar dataKey="effectif" name="Effectif" radius={[0,4,4,0]}>
                  {ancTranches.map((_, i) => <Cell key={i} fill={PALETTE_MIX[i % PALETTE_MIX.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Effectif par établissement + Donut qualification */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {effEta.length > 0 && (
          <Panel>
            <PanelHeader icon={<BarChart2 size={13} />} title="Effectif par Établissement" color={C_NAVY} />
            <div style={{ padding: '18px 20px' }}>
              <ResponsiveContainer width="100%" height={Math.max(240, effEta.length * 36)}>
                <BarChart data={effEta} layout="vertical" margin={{ left: 10, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                  <YAxis type="category" dataKey="etablissement" tick={{ fontSize: 10, fontFamily: F_BODY }} width={120} />
                  <Tooltip content={<ChTip fmtVal={fmtN} />} />
                  <Bar dataKey="effectif" name="Effectif" radius={[0,4,4,0]}>
                    {effEta.map((_, i) => <Cell key={i} fill={PALETTE_NAVY[i % PALETTE_NAVY.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}
        {effQuali.length > 0 && (
          <Panel>
            <PanelHeader icon={<BarChart2 size={13} />} title="Répartition par Qualification" color={C_BLUE} />
            <div style={{ padding: '18px 20px' }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={effQuali} dataKey="effectif" nameKey="qualification" cx="50%" cy="50%" outerRadius={85} innerRadius={50} label={(p: { qualification?: string; percent?: number }) => `${p.qualification ?? ''} ${((p.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {effQuali.map((_, i) => <Cell key={i} fill={PALETTE_PURPLE[i % PALETTE_PURPLE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmtN(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}
      </div>
    </>
  )
}

/* ── Salaire ── */
function SectionSalaire({ d, details, evol }: { d: RhKpis; details: Details | null; evol: Evolution | null }) {
  const v      = d.variation ?? {}
  const an1    = d.annee_precedente ? `vs ${d.annee_precedente}` : 'vs N-1'
  const drift  = typeof v.drift === 'number' ? v.drift : null
  const conc   = d.concentration
  const mensuel = evol?.mensuel ?? []
  const annMasse = evol?.annuelle_masse ?? []
  const masseEta = details?.masse_par_eta ?? []
  const masseStatut = details?.masse_par_statut ?? []

  return (
    <>
      <Panel>
        <PanelHeader icon={<Banknote size={13} />} title="Masse Salariale" color={C_GREEN} />
        <div style={{ padding: '18px 20px' }}>
          <KpiRow>
            <KpiCard label="Masse Salariale" value={fmtFcfa(d.masse_salariale)} accent={C_NAVY} icon={<Banknote size={16} />} variation={v.masse_salariale} sub={an1} />
            <KpiCard label="Salaire Moyen" value={fmtFcfa(d.salaire_moyen)} accent={C_GREEN} variation={v.salaire_moyen} sub={an1} />
            <KpiCard
              label="Drift Salarial"
              value={drift != null ? `${drift >= 0 ? '+' : ''}${drift.toFixed(1)} %` : '—'}
              accent={drift != null ? (drift > 3 ? C_RED : drift > 0 ? C_ORANGE : C_GREEN) : C_GRAY}
              info="Différence entre la croissance de la masse et la croissance de l'effectif. >3% → dérive du coût par tête. <0% → gel salarial."
            />
            <KpiCard
              label="Concentration Top 20%"
              value={`${conc?.pct_top20?.toFixed(1) ?? '—'} %`}
              sub={conc ? `${fmtN(conc.nb_top20)} salariés portent ${conc.pct_top20?.toFixed(0)}% de la masse` : ''}
              accent={conc?.pct_top20 > 55 ? C_RED : conc?.pct_top20 > 40 ? C_ORANGE : C_GREEN}
              info="Règle de Pareto : 20% des mieux rémunérés. <40% → bien réparti · 40-55% → normal · >55% → concentration élevée"
            />
          </KpiRow>
        </div>
      </Panel>

      {/* N vs N-1 + Cumul */}
      {mensuel.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Panel>
            <PanelHeader icon={<BarChart2 size={13} />} title={`Évolution Mensuelle — ${evol?.annee_n1 ? `N vs ${evol.annee_n1}` : 'Masse Salariale'}`} color={C_NAVY} />
            <div style={{ padding: '18px 20px' }}>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={mensuel} margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                  <YAxis tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} width={65} />
                  <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: F_BODY }} />
                  {evol?.annee_n1 && <Line type="monotone" dataKey="masse_n1" name={evol.annee_n1} stroke={C_GRAY} strokeWidth={1.8} strokeDasharray="5 3" dot={{ r: 3 }} />}
                  <Line type="monotone" dataKey="masse" name="Masse N" stroke={C_NAVY} strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel>
            <PanelHeader icon={<BarChart2 size={13} />} title="Progression Cumulative dans l'Année" color={C_GREEN} />
            <div style={{ padding: '18px 20px' }}>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={mensuel} margin={{ right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                  <YAxis tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} width={65} />
                  <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                  <Area type="monotone" dataKey="masse_cumul" name="Cumul Masse" stroke={C_GREEN} fill="rgba(150,193,30,.12)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      )}

      {/* Évolution annuelle */}
      {annMasse.length > 0 && (
        <Panel>
          <PanelHeader icon={<BarChart2 size={13} />} title="Évolution de la Masse Salariale par Exercice" color={C_NAVY} />
          <div style={{ padding: '18px 20px' }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={annMasse} margin={{ right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" />
                <XAxis dataKey="annee" tick={{ fontSize: 10, fontFamily: F_BODY }} />
                <YAxis tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} width={65} />
                <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                <Bar dataKey="masse" name="Masse Salariale" radius={[4,4,0,0]}>
                  {annMasse.map((r, i) => <Cell key={i} fill={r.is_last ? C_GREEN : PALETTE_NAVY[2]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Masse par établissement + Masse par statut */}
      {(masseEta.length > 0 || masseStatut.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {masseEta.length > 0 && (
            <Panel>
              <PanelHeader icon={<BarChart2 size={13} />} title="Masse par Établissement" color={C_GREEN} />
              <div style={{ padding: '18px 20px' }}>
                <ResponsiveContainer width="100%" height={Math.max(220, masseEta.length * 36)}>
                  <BarChart data={masseEta} layout="vertical" margin={{ left: 10, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} />
                    <YAxis type="category" dataKey="etablissement" tick={{ fontSize: 9, fontFamily: F_BODY }} width={110} />
                    <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                    <Bar dataKey="masse" name="Masse" radius={[0,4,4,0]}>
                      {masseEta.map((_, i) => <Cell key={i} fill={PALETTE_GREEN[i % PALETTE_GREEN.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {masseStatut.length > 0 && (
            <Panel>
              <PanelHeader icon={<BarChart2 size={13} />} title="Masse par Statut" color={C_NAVY} />
              <div style={{ padding: '18px 20px' }}>
                <ResponsiveContainer width="100%" height={Math.max(220, masseStatut.length * 38)}>
                  <BarChart data={masseStatut} layout="vertical" margin={{ left: 10, right: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} />
                    <YAxis type="category" dataKey="statut" tick={{ fontSize: 9, fontFamily: F_BODY }} width={120} />
                    <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                    <Bar dataKey="masse" name="Masse" radius={[0,4,4,0]}>
                      {masseStatut.map((_, i) => <Cell key={i} fill={PALETTE_MIX[i % PALETTE_MIX.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
        </div>
      )}
    </>
  )
}

interface TopNRow { matricule: string; nom_prenom: string; direction: string; fonction: string; categorie: string; montant_hs: number; nb_heures: number }

/* ── Heures Supplémentaires ── */
function SectionHS({ d, details, evol, filters }: {
  d: RhKpis; details: Details | null; evol: Evolution | null
  filters: Record<string, string>
}) {
  const v          = d.variation ?? {}
  const an1        = d.annee_precedente ? `vs ${d.annee_precedente}` : 'vs N-1'
  const seuilOk    = d.taux_hs <= SEUIL_TAUX_HS
  const mensuel    = evol?.mensuel ?? []
  const annuelleHs = evol?.annuelle_hs ?? []
  const hsRubrique = details?.hs_par_rubrique ?? []
  const hsEta      = details?.hs_par_eta ?? []
  const hsCat      = details?.hs_par_categorie ?? []

  /* ── Top N state ── */
  const [showTopN,     setShowTopN]     = useState(false)
  const [nValue,       setNValue]       = useState(10)
  const [topNData,     setTopNData]     = useState<TopNRow[]>([])
  const [loadingTopN,  setLoadingTopN]  = useState(false)
  const [errTopN,      setErrTopN]      = useState('')

  const loadTopN = useCallback((n: number) => {
    setLoadingTopN(true); setErrTopN('')
    const q = new URLSearchParams({ n: String(n), ...filters })
    fetch(`/api/rh/hs-topn?${q.toString()}`)
      .then(r => r.ok ? r.json() : Promise.reject('Erreur chargement'))
      .then((rows: TopNRow[]) => { setTopNData(rows); setLoadingTopN(false) })
      .catch(e => { setErrTopN(String(e)); setLoadingTopN(false) })
  }, [filters])

  const handleOpen = () => {
    setShowTopN(s => {
      if (!s) loadTopN(nValue)
      return !s
    })
  }

  return (
    <>
      {/* KPIs */}
      <Panel>
        <PanelHeader icon={<Clock size={13} />} title="Heures Supplémentaires" color={C_ORANGE} />
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <KpiRow>
            <KpiCard label="Montant Heures Sup" value={fmtFcfa(d.montant_hs)} accent={C_ORANGE} icon={<Clock size={16} />} variation={v.montant_hs} varInverse sub={an1} />
            <KpiBadge label="Taux Heures Sup" value={d.taux_hs.toFixed(2)} unit="%" badge={d.taux_hs} badgeSeuil={SEUIL_TAUX_HS} badgeInverse sub={`Objectif ≤ ${SEUIL_TAUX_HS}%`} />
            <KpiCard label="Volume Heures Sup" value={`${fmtN(d.nb_heures_sup)} h`} accent="rgba(31,59,114,.6)" />
          </KpiRow>
          <ProgressBar value={d.taux_hs} color={seuilOk ? C_GREEN : C_RED} label="Taux HS" objective={SEUIL_TAUX_HS} objectiveLabel={`Seuil ${SEUIL_TAUX_HS}%`} />
          {/* Bouton Top N */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={handleOpen} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, fontFamily: F_BODY,
              background: showTopN ? C_NAVY : '#f0f6ff',
              color: showTopN ? '#fff' : C_NAVY,
              border: `1px solid ${C_NAVY}`, borderRadius: 8,
              padding: '6px 14px', cursor: 'pointer', transition: 'all .2s',
            }}>
              <Users size={12} />
              {showTopN ? 'Masquer le classement' : 'Top N collaborateurs HS'}
            </button>
          </div>
        </div>
      </Panel>

      {/* ── Panneau Top N ── */}
      {showTopN && (
        <Panel>
          <PanelHeader icon={<Users size={13} />} title="Classement Collaborateurs — Montant Heures Supplémentaires" color={C_NAVY} />
          <div style={{ padding: '16px 20px' }}>
            {/* Contrôle N */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(31,59,114,.5)', fontFamily: F_BODY }}>
                Afficher le Top
              </span>
              <input
                type="number" min={1} max={50} value={nValue}
                onChange={e => setNValue(Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
                style={{
                  width: 64, fontSize: 13, fontWeight: 700, fontFamily: F_BODY,
                  border: `1px solid ${C_NAVY}`, borderRadius: 8, padding: '4px 10px',
                  color: C_NAVY, background: '#f0f6ff', textAlign: 'center',
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(31,59,114,.5)', fontFamily: F_BODY }}>
                collaborateurs
              </span>
              <button onClick={() => loadTopN(nValue)} style={{
                fontSize: 11, fontWeight: 700, fontFamily: F_BODY,
                background: C_NAVY, color: '#fff', border: 'none',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              }}>
                Actualiser
              </button>
              {loadingTopN && <span style={{ fontSize: 11, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY }}>Chargement…</span>}
              {errTopN && <span style={{ fontSize: 11, color: C_RED, fontFamily: F_BODY }}>{errTopN}</span>}
            </div>

            {/* Histogramme horizontal */}
            {topNData.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(260, topNData.length * 38)}>
                <BarChart
                  data={topNData}
                  layout="vertical"
                  margin={{ left: 10, right: 90 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} />
                  <YAxis
                    type="category" dataKey="nom_prenom"
                    tick={{ fontSize: 10, fontFamily: F_BODY }} width={160}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const row = topNData.find(r => r.nom_prenom === label)
                      if (!row) return null
                      return (
                        <div style={{
                          background: '#fff', border: '1px solid #e8edf5', borderRadius: 12,
                          padding: '12px 16px', boxShadow: '0 6px 24px rgba(31,59,114,.14)',
                          fontFamily: F_BODY, minWidth: 220,
                        }}>
                          {/* En-tête */}
                          <div style={{ fontSize: 12, fontWeight: 800, color: C_NAVY, marginBottom: 8, borderBottom: '1px solid #f0f3f9', paddingBottom: 6 }}>
                            {row.nom_prenom}
                          </div>
                          {/* Infos identité */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                            {[
                              { label: 'Matricule',  value: row.matricule },
                              { label: 'Direction',  value: row.direction },
                              { label: 'Fonction',   value: row.fonction },
                              { label: 'Catégorie',  value: row.categorie },
                            ].map(({ label: lbl, value }) => (
                              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10 }}>
                                <span style={{ color: 'rgba(31,59,114,.45)', fontWeight: 600 }}>{lbl}</span>
                                <span style={{ color: C_NAVY, fontWeight: 700 }}>{value}</span>
                              </div>
                            ))}
                          </div>
                          {/* Métriques HS */}
                          <div style={{ borderTop: '1px solid #f0f3f9', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
                              <span style={{ color: 'rgba(31,59,114,.45)', fontWeight: 600 }}>Montant HS</span>
                              <span style={{ color: C_ORANGE, fontWeight: 800 }}>{fmtFcfa(row.montant_hs)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
                              <span style={{ color: 'rgba(31,59,114,.45)', fontWeight: 600 }}>Volume</span>
                              <span style={{ color: C_NAVY, fontWeight: 700 }}>{fmtN(row.nb_heures)} h</span>
                            </div>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="montant_hs" name="Montant HS" radius={[0, 4, 4, 0]}>
                    {topNData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? C_ORANGE : i < 3 ? PALETTE_NAVY[1] : PALETTE_NAVY[3]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      )}

      {/* Évolution mensuelle */}
      {mensuel.length > 0 && (
        <Panel>
          <PanelHeader icon={<BarChart2 size={13} />} title="Évolution Mensuelle — Heures Supplémentaires" color={C_ORANGE} />
          <div style={{ padding: '18px 20px' }}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={mensuel} margin={{ right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                <YAxis yAxisId="h" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtN(v) + 'h'} width={55} />
                <YAxis yAxisId="m" orientation="right" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} width={70} />
                <Tooltip content={<ChTip fmtVal={fmtN} />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: F_BODY }} />
                <Bar yAxisId="h" dataKey="nb_hs" name="Nb Heures" fill={C_NAVY} radius={[4,4,0,0]} />
                <Line yAxisId="m" type="monotone" dataKey="montant_hs" name="Montant (FCFA)" stroke={C_ORANGE} strokeWidth={2.5} dot={{ r: 3, fill: C_ORANGE }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Courbe de variation annuelle */}
      {annuelleHs.length > 0 && (
        <Panel>
          <PanelHeader icon={<BarChart2 size={13} />} title="Variation Annuelle — Montant Heures Supplémentaires" color={C_ORANGE} />
          <div style={{ padding: '18px 20px' }}>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={annuelleHs} margin={{ right: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" />
                <XAxis dataKey="annee" tick={{ fontSize: 10, fontFamily: F_BODY }} />
                <YAxis yAxisId="m" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} width={70} />
                <YAxis yAxisId="h" orientation="right" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtN(v) + 'h'} width={60} />
                <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: F_BODY }} />
                <Bar yAxisId="m" dataKey="montant_hs" name="Montant HS" radius={[4,4,0,0]}>
                  {annuelleHs.map((r, i) => <Cell key={i} fill={r.is_last ? C_ORANGE : PALETTE_NAVY[3]} />)}
                </Bar>
                <Line yAxisId="h" type="monotone" dataKey="nb_heures" name="Volume (h)" stroke={C_NAVY} strokeWidth={2.5} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Rubrique + Catégorie côte à côte */}
      {(hsRubrique.length > 0 || hsCat.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {hsRubrique.length > 0 && (
            <Panel>
              <PanelHeader icon={<BarChart2 size={13} />} title="Montant HS par Rubrique" color={C_ORANGE} />
              <div style={{ padding: '18px 20px' }}>
                <ResponsiveContainer width="100%" height={Math.max(200, hsRubrique.length * 46)}>
                  <BarChart data={hsRubrique} layout="vertical" margin={{ left: 10, right: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} />
                    <YAxis type="category" dataKey="rubrique" tick={{ fontSize: 11, fontFamily: F_BODY, fontWeight: 700 }} width={50} />
                    <Tooltip content={<ChTip fmtVal={fmtFcfa} />} />
                    <Bar dataKey="montant" name="Montant" radius={[0,4,4,0]}>
                      {hsRubrique.map((_, i) => <Cell key={i} fill={['#F28050','#E89A6A','#DDB48A','#D2CEAA'][i % 4]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {hsCat.length > 0 && (
            <Panel>
              <PanelHeader icon={<BarChart2 size={13} />} title="Répartition Montant HS par Catégorie" color={C_PURPLE} />
              <div style={{ padding: '18px 20px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={hsCat} dataKey="montant" nameKey="categorie"
                      cx="50%" cy="50%" outerRadius={80} innerRadius={44}
                      label={(p: { categorie?: string; percent?: number }) => `${p.categorie ?? ''} ${((p.percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {hsCat.map((_, i) => <Cell key={i} fill={PALETTE_MIX[i % PALETTE_MIX.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => fmtFcfa(v as number)} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: F_BODY }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Table synthèse */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {hsCat.map((r, i) => {
                    const total = hsCat.reduce((s, x) => s + x.montant, 0) || 1
                    const pct   = Math.round(r.montant / total * 1000) / 10
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: PALETTE_MIX[i % PALETTE_MIX.length] }} />
                        <div style={{ flex: 1, fontSize: 10, fontFamily: F_BODY, fontWeight: 600, color: C_NAVY }}>{r.categorie}</div>
                        <div style={{ fontSize: 10, fontFamily: F_BODY, color: 'rgba(31,59,114,.6)', fontWeight: 600 }}>{fmtFcfa(r.montant)}</div>
                        <div style={{ fontSize: 10, fontFamily: F_BODY, color: C_ORANGE, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* HS par établissement — pleine largeur */}
      {hsEta.length > 0 && (
        <Panel>
          <PanelHeader icon={<BarChart2 size={13} />} title="HS par Établissement — Montant & Taux h/Collab" color={C_NAVY} />
          <div style={{ padding: '18px 20px' }}>
            <ResponsiveContainer width="100%" height={Math.max(240, hsEta.length * 44)}>
              <ComposedChart
                data={hsEta.map(r => ({ ...r, hParCollab: r.nb_collab > 0 ? Math.round(r.nb_heures / r.nb_collab * 10) / 10 : 0 }))}
                layout="vertical" margin={{ left: 10, right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                <XAxis xAxisId="m" type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => fmtFcfa(v)} />
                <XAxis xAxisId="h" type="number" orientation="top" tick={{ fontSize: 9, fontFamily: F_BODY }} tickFormatter={v => v + 'h'} />
                <YAxis type="category" dataKey="etablissement" tick={{ fontSize: 9, fontFamily: F_BODY }} width={120} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e8edf5', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(31,59,114,.12)', fontFamily: F_BODY }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C_NAVY, marginBottom: 6 }}>{label}</div>
                        {payload.map((p, i) => (
                          <div key={i} style={{ fontSize: 11, color: p.color, fontWeight: 600 }}>
                            {p.name} : {p.name === 'Montant HS' ? fmtFcfa(p.value as number) : (p.value as number).toLocaleString('fr-FR') + (p.name === 'h / collab' ? ' h' : '')}
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: F_BODY }} />
                <Bar xAxisId="m" dataKey="montant" name="Montant HS" radius={[0,4,4,0]}>
                  {hsEta.map((_, i) => <Cell key={i} fill={PALETTE_NAVY[i % PALETTE_NAVY.length]} />)}
                </Bar>
                <Line xAxisId="h" type="monotone" dataKey="hParCollab" name="h / collab" stroke={C_ORANGE} strokeWidth={2.5} dot={{ r: 4, fill: C_ORANGE }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}
    </>
  )
}

/* ── Formation ── */
function SectionFormation({ d, details }: { d: RhKpis; details: Details | null }) {
  const v        = d.variation ?? {}
  const an1      = d.annee_precedente ? `vs ${d.annee_precedente}` : 'vs N-1'
  const ok       = d.pct_formes >= 80
  const color    = ok ? C_GREEN : d.pct_formes >= 50 ? C_BLUE : C_ORANGE
  const themeData = details?.formation_par_theme ?? []
  const etaData   = details?.formation_par_eta ?? []
  const pctObj    = Math.min(100, d.nb_heures_formation / OBJECTIF_FORMATION * 100)

  return (
    <>
      <Panel>
        <PanelHeader icon={<GraduationCap size={13} />} title="Formation" color={C_BLUE} />
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <KpiRow>
            <KpiCard label="Heures Dispensées" value={fmtN(d.nb_heures_formation)} icon={<GraduationCap size={16} />} accent={C_BLUE} variation={v.nb_heures_formation} sub={an1} />
            <KpiCard label="Collaborateurs Formés" value={fmtN(d.nb_collaborateurs_formes)} sub={`sur ${fmtN(d.nb_salaries)} salariés`} />
            <KpiCard label="Taux de Formation" value={fmtPct(d.pct_formes)} accent={color} />
            {/* Objectif annuel */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5', flex: '1 1 160px', minWidth: 150 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY, marginBottom: 8 }}>
                Objectif Annuel
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, fontFamily: F_TITLE, color: C_NAVY }}>{fmtN(d.nb_heures_formation)}</span>
                <span style={{ fontSize: 10, fontFamily: F_BODY, color: 'rgba(31,59,114,.4)' }}>/ {fmtN(OBJECTIF_FORMATION)} h</span>
              </div>
              <ProgressBar value={pctObj} color={pctObj >= 100 ? C_GREEN : C_ORANGE} objectiveLabel={`${pctObj.toFixed(0)}%`} />
            </div>
          </KpiRow>
          <ProgressBar value={d.pct_formes} color={color} label="Couverture formation" objective={80} objectiveLabel="Objectif 80%" />
        </div>
      </Panel>

      {(themeData.length > 0 || etaData.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {themeData.length > 0 && (
            <Panel>
              <PanelHeader icon={<BarChart2 size={13} />} title="Heures Formation par Thème" color={C_PURPLE} />
              <div style={{ padding: '18px 20px' }}>
                <ResponsiveContainer width="100%" height={Math.max(240, themeData.length * 38)}>
                  <BarChart data={themeData} layout="vertical" margin={{ left: 10, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                    <YAxis type="category" dataKey="theme" tick={{ fontSize: 9, fontFamily: F_BODY }} width={130} />
                    <Tooltip content={<ChTip fmtVal={v => fmtN(v) + ' h'} />} />
                    <Bar dataKey="heures" name="Heures" radius={[0,4,4,0]}>
                      {themeData.map((_, i) => <Cell key={i} fill={PALETTE_PURPLE[i % PALETTE_PURPLE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {etaData.length > 0 && (
            <Panel>
              <PanelHeader icon={<BarChart2 size={13} />} title="Formation par Établissement" color={C_BLUE} />
              <div style={{ padding: '18px 20px' }}>
                <ResponsiveContainer width="100%" height={Math.max(240, etaData.length * 38)}>
                  <BarChart data={etaData} layout="vertical" margin={{ left: 10, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fontFamily: F_BODY }} />
                    <YAxis type="category" dataKey="etablissement" tick={{ fontSize: 9, fontFamily: F_BODY }} width={120} />
                    <Tooltip content={<ChTip fmtVal={v => fmtN(v) + ' h'} />} />
                    <Bar dataKey="heures" name="Heures" fill={C_BLUE} radius={[0,4,4,0]}>
                      {etaData.map((_, i) => <Cell key={i} fill={i === 0 ? C_BLUE : `rgba(8,145,178,${0.85 - i * 0.09})`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
        </div>
      )}
    </>
  )
}

/* ══════════════════════════ FILTRES ════════════════════════════════════════ */
const MOIS_LABELS: Record<number, string> = {
  1:'Janv', 2:'Févr', 3:'Mars', 4:'Avr', 5:'Mai', 6:'Juin',
  7:'Juil', 8:'Août', 9:'Sept', 10:'Oct', 11:'Nov', 12:'Déc',
}

interface Filtres {
  annees:         number[]
  mois:           number[]
  etablissements: { code_eta: string; etablissement: string }[]
  qualifications: { code_quali: string; qualification: string }[]
  categories:     string[]
}

const FILTRES_VIDES: Filtres = { annees: [], mois: [], etablissements: [], qualifications: [], categories: [] }

/* ══════════════════════════ COMPOSANT PRINCIPAL ════════════════════════════ */
export default function RapportRH() {
  const { id } = useParams<{ id: string }>()

  const [annee,     setAnnee]     = useState('2025')
  const [mois,      setMois]      = useState('all')
  const [eta,       setEta]       = useState('all')
  const [quali,     setQuali]     = useState('all')
  const [categorie, setCategorie]    = useState('all')
  const [filtres,   setFiltres]      = useState<Filtres>(FILTRES_VIDES)
  const [kpis,         setKpis]        = useState<RhKpis | null>(null)
  const [details,      setDetails]     = useState<Details | null>(null)
  const [evol,         setEvol]        = useState<Evolution | null>(null)
  const [loading,      setLoading]     = useState(true)   // KPIs en cours
  const [loadingBg,    setLoadingBg]   = useState(false)  // details+evol en cours
  const [err,          setErr]         = useState('')

  /* ── Handlers avec cascade reset ── */
  const handleAnnee = useCallback((v: string) => {
    setAnnee(v); setMois('all'); setEta('all'); setQuali('all'); setCategorie('all')
  }, [])
  const handleMois = useCallback((v: string) => {
    setMois(v); setEta('all'); setQuali('all'); setCategorie('all')
  }, [])
  const handleEta = useCallback((v: string) => {
    setEta(v); setQuali('all'); setCategorie('all')
  }, [])
  const handleQuali = useCallback((v: string) => {
    setQuali(v); setCategorie('all')
  }, [])

  /* ── Rechargement dynamique des options de filtres ── */
  useEffect(() => {
    const q = new URLSearchParams()
    if (annee !== 'all') q.set('annee', annee)
    if (mois  !== 'all') q.set('mois',  mois)
    if (eta   !== 'all') q.set('eta',   eta)
    if (quali !== 'all') q.set('quali', quali)
    const qs = q.toString() ? '?' + q.toString() : ''
    fetch(`/api/rh/filtres${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFiltres(d) })
      .catch(() => {})
  }, [annee, mois, eta, quali])

  /* ── Chargement différé : KPIs en priorité, détails en arrière-plan ── */
  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (annee     !== 'all') q.set('annee',     annee)
    if (mois      !== 'all') q.set('mois',      mois)
    if (eta       !== 'all') q.set('eta',       eta)
    if (quali     !== 'all') q.set('quali',     quali)
    if (categorie !== 'all') q.set('categorie', categorie)
    const qs = q.toString() ? '?' + q.toString() : ''

    /* Réinitialiser */
    setLoading(true); setLoadingBg(false); setErr('')
    setDetails(null); setEvol(null)

    /* Étape 1 — KPIs (affichage immédiat) */
    fetch(`/api/rh/kpis${qs}`)
      .then(r => r.json())
      .then(k => {
        if (k?._error) setErr(`Base de données inaccessible — ${k._error}`)
        setKpis(k)
        setLoading(false)

        /* Étape 2 — Détails + Évolution en arrière-plan */
        setLoadingBg(true)
        Promise.all([
          fetch(`/api/rh/details${qs}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/rh/evolution${qs}`).then(r => r.ok ? r.json() : null),
        ])
          .then(([d, e]) => { setDetails(d); setEvol(e) })
          .catch(() => {})
          .finally(() => setLoadingBg(false))
      })
      .catch(e => { setErr(String(e)); setLoading(false) })
  }, [annee, mois, eta, quali, categorie])

  useEffect(() => { load() }, [load])

  /* Nombre de filtres actifs (hors année) */
  const nbFiltresActifs = [mois, eta, quali, categorie].filter(v => v !== 'all').length

  /* Objet filtres courants pour les sous-composants */
  const activeFilters: Record<string, string> = {}
  if (annee     !== 'all') activeFilters.annee     = annee
  if (mois      !== 'all') activeFilters.mois      = mois
  if (eta       !== 'all') activeFilters.eta       = eta
  if (quali     !== 'all') activeFilters.quali     = quali
  if (categorie !== 'all') activeFilters.categorie = categorie

  const showDashboard = id === 'rh-dashboard'
  const showEffectif  = showDashboard || id === 'rh-effectif'
  const showSalaire   = showDashboard || id === 'rh-salaire'
  const showHS        = showDashboard || id === 'rh-hs'
  const showFormation = showDashboard || id === 'rh-formation'

  /* Options mois dynamiques */
  const moisOptions = [
    { value: 'all', label: 'Tous les mois' },
    ...filtres.mois.map(m => ({ value: String(m), label: MOIS_LABELS[m] ?? String(m) })),
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f4f6fb', fontFamily: F_BODY, overflowY: 'auto' }}>
      <style>{`@keyframes spin-rh { to { transform: rotate(360deg); } }`}</style>

      {/* ── En-tête + filtres ─────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e8edf5', padding: '10px 24px',
        flexShrink: 0, boxShadow: '0 1px 4px rgba(31,59,114,.04)',
      }}>
        {/* Ligne titre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ color: C_PURPLE, display: 'flex', alignItems: 'center' }}>
            <Users size={14} strokeWidth={2} />
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Direction des Ressources Humaines
          </span>
          {kpis && !loading && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.35)' }}>
              {fmtN(kpis.nb_salaries)} collaborateurs
              {nbFiltresActifs > 0 && (
                <span style={{ marginLeft: 8, color: C_BLUE, fontWeight: 700 }}>
                  · {nbFiltresActifs} filtre{nbFiltresActifs > 1 ? 's' : ''} actif{nbFiltresActifs > 1 ? 's' : ''}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Ligne filtres */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Année */}
          {filtres.annees.length > 0 && (
            <Sel label="Année" value={annee} onChange={handleAnnee}
              options={[{ value: 'all', label: 'Toutes' }, ...filtres.annees.map(a => ({ value: String(a), label: String(a) }))]} />
          )}

          {/* Mois — options dynamiques selon l'année */}
          {moisOptions.length > 1 && (
            <Sel label="Mois" value={mois} onChange={handleMois} options={moisOptions} />
          )}

          {/* Établissement — filtré par annee + mois */}
          {filtres.etablissements.length > 0 && (
            <Sel label="Établissement" value={eta} onChange={handleEta}
              options={[
                { value: 'all', label: 'Tous' },
                ...filtres.etablissements.map(e => ({ value: e.code_eta, label: e.etablissement })),
              ]} />
          )}

          {/* Statut / Qualification — filtré par annee + mois + eta */}
          {filtres.qualifications.length > 0 && (
            <Sel label="Statut" value={quali} onChange={handleQuali}
              options={[
                { value: 'all', label: 'Tous' },
                ...filtres.qualifications.map(q => ({ value: q.code_quali, label: q.qualification })),
              ]} />
          )}

          {/* Catégorie — filtrée par annee + mois + eta + quali */}
          {filtres.categories.length > 0 && (
            <Sel label="Catégorie" value={categorie} onChange={setCategorie}
              options={[
                { value: 'all', label: 'Toutes' },
                ...filtres.categories.map(c => ({ value: c, label: c })),
              ]} />
          )}

          {/* Réinitialiser */}
          {nbFiltresActifs > 0 && (
            <button
              onClick={() => { setMois('all'); setEta('all'); setQuali('all'); setCategorie('all') }}
              style={{
                fontSize: 10, fontWeight: 700, fontFamily: F_BODY,
                border: '1px solid #e8edf5', borderRadius: 8, padding: '4px 10px',
                background: '#f8fafc', color: C_RED, cursor: 'pointer',
              }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading && <Loader />}
        {!loading && err   && <ErrMsg msg={err} />}
        {/* Indicateur arrière-plan discret */}
        {!loading && loadingBg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontFamily: F_BODY, color: 'rgba(31,59,114,.35)', alignSelf: 'flex-end' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-rh 0.8s linear infinite' }} />
            Chargement des graphiques…
          </div>
        )}
        {!loading && !err && kpis && (
          <>
            {showDashboard  && <SectionDashboard  d={kpis} details={details} evol={evol} />}
            {!showDashboard && showEffectif  && <SectionEffectif  d={kpis} details={details} evol={evol} />}
            {!showDashboard && showSalaire   && <SectionSalaire   d={kpis} details={details} evol={evol} />}
            {!showDashboard && showHS        && <SectionHS        d={kpis} details={details} evol={evol} filters={activeFilters} />}
            {!showDashboard && showFormation && <SectionFormation d={kpis} details={details} />}
          </>
        )}
      </div>
    </div>
  )
}
