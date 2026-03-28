'use client'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AlertTriangle, Users, Banknote, Clock, GraduationCap } from 'lucide-react'

/* ═══════════════════════════════ STYLES ════════════════════════════════════ */
const F_TITLE  = "'Barlow Semi Condensed', sans-serif"
const F_BODY   = "'Nunito', sans-serif"
const C_NAVY   = '#1F3B72'
const C_GREEN  = '#96C11E'
const C_RED    = '#E84040'
const C_ORANGE = '#d97706'
const C_PURPLE = '#7C3AED'
const C_BLUE   = '#0891B2'

/* ═══════════════════════════════ TYPES ═════════════════════════════════════ */
interface RhKpis {
  nb_salaries:              number
  nb_femmes:                number
  taux_feminisation:        number
  masse_salariale:          number
  salaire_moyen:            number
  montant_hs:               number
  taux_hs:                  number
  nb_heures_formation:      number
  nb_collaborateurs_formes: number
  pct_formes:               number
}

/* ═══════════════════════════════ HELPERS ═══════════════════════════════════ */
const fmtN   = (v: number) => v.toLocaleString('fr-FR')
const fmtPct = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %'
function fmtFcfa(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' Mds'
  if (v >= 1_000_000)     return (v / 1_000_000).toLocaleString('fr-FR',     { maximumFractionDigits: 1 }) + ' M'
  return v.toLocaleString('fr-FR') + ' F'
}

/* ═══════════════════════════════ UI ATOMS ══════════════════════════════════ */
function KpiCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 20px',
      boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5',
      flex: '1 1 160px', minWidth: 140,
    }}>
      {icon && (
        <div style={{ marginBottom: 8, color: accent ?? C_NAVY, opacity: .65 }}>{icon}</div>
      )}
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.45)',
        textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY, marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, fontFamily: F_TITLE,
        color: accent ?? C_NAVY, lineHeight: 1.1,
      }}>{value}</div>
      {sub && (
        <div style={{
          fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500,
          marginTop: 4, fontFamily: F_BODY,
        }}>{sub}</div>
      )}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(31,59,114,.07)', border: '1px solid #e8edf5',
    }}>
      {children}
    </div>
  )
}

function PanelHeader({ icon, title, color }: {
  icon: React.ReactNode; title: string; color: string
}) {
  return (
    <div style={{
      padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        width: 4, height: 18, borderRadius: 99, background: color,
        display: 'inline-block', flexShrink: 0,
      }} />
      <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{
        fontFamily: F_BODY, fontSize: 11, fontWeight: 800,
        color: 'rgba(31,59,114,.5)', textTransform: 'uppercase', letterSpacing: '.06em',
      }}>{title}</span>
    </div>
  )
}

function ProgressBar({ value, color, label, objective }: {
  value: number; color: string; label?: string; objective?: number
}) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div style={{ marginTop: 4 }}>
      {label && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, fontWeight: 600, color: 'rgba(31,59,114,.4)', fontFamily: F_BODY, marginBottom: 6,
        }}>
          <span>{label}</span>
          {objective !== undefined && <span>Objectif {objective} %</span>}
        </div>
      )}
      <div style={{ height: 8, borderRadius: 99, background: '#f0f3f9', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 99, transition: 'width .4s ease',
        }} />
        {objective !== undefined && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: `${objective}%`,
            width: 2, background: 'rgba(31,59,114,.25)',
          }} />
        )}
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0',
      color: 'rgba(31,59,114,.45)', fontSize: 13, fontFamily: F_BODY,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        border: '2px solid #e8edf5', borderTopColor: C_NAVY,
        animation: 'spin-rh 0.8s linear infinite', flexShrink: 0,
      }} />
      Chargement…
    </div>
  )
}

function ErrMsg({ msg }: { msg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
      background: 'rgba(232,64,64,.07)', borderRadius: 10,
      border: '1px solid rgba(232,64,64,.15)', color: C_RED,
      fontSize: 13, fontWeight: 600, fontFamily: F_BODY,
    }}>
      <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />{msg}
    </div>
  )
}

/* ══════════════════════════ SECTIONS ═══════════════════════════════════════ */
function SectionEffectif({ d }: { d: RhKpis }) {
  const nbHommes = d.nb_salaries - d.nb_femmes
  const pctF = d.taux_feminisation

  return (
    <Panel>
      <PanelHeader icon={<Users size={13} />} title="Effectifs" color={C_NAVY} />
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="Effectif Total" value={fmtN(d.nb_salaries)}
            sub="collaborateurs actifs" icon={<Users size={16} />} />
          <KpiCard label="Collaboratrices" value={fmtN(d.nb_femmes)}
            sub={`${fmtPct(pctF)} de l'effectif`} accent={C_PURPLE} />
          <KpiCard label="Collaborateurs" value={fmtN(nbHommes)}
            sub={`${fmtPct(100 - pctF)} de l'effectif`} accent={C_NAVY} />
        </div>

        {/* Répartition H/F */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, fontWeight: 700, fontFamily: F_BODY, marginBottom: 10,
          }}>
            <span style={{ color: C_PURPLE }}>Femmes · {fmtPct(pctF)}</span>
            <span style={{ color: C_NAVY   }}>Hommes · {fmtPct(100 - pctF)}</span>
          </div>
          <div style={{ height: 14, borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${pctF}%`,
              background: 'linear-gradient(90deg, #7C3AED, #A855F7)',
            }} />
            <div style={{ flex: 1, background: 'linear-gradient(90deg, #3B82F6, #1F3B72)' }} />
          </div>
        </div>

      </div>
    </Panel>
  )
}

function SectionSalaire({ d }: { d: RhKpis }) {
  return (
    <Panel>
      <PanelHeader icon={<Banknote size={13} />} title="Masse Salariale" color={C_GREEN} />
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="Masse Salariale" value={fmtFcfa(d.masse_salariale)}
            sub="charges incluses" accent={C_NAVY} icon={<Banknote size={16} />} />
          <KpiCard label="Salaire Moyen" value={fmtFcfa(d.salaire_moyen)}
            sub="par collaborateur / mois" accent={C_GREEN} />
          <KpiCard label="Coût par Salarié" value={fmtFcfa(d.masse_salariale / Math.max(1, d.nb_salaries))}
            sub="masse ÷ effectif" accent="rgba(31,59,114,.6)" />
        </div>
      </div>
    </Panel>
  )
}

function SectionHS({ d }: { d: RhKpis }) {
  const seuilOk = d.taux_hs <= 10
  return (
    <Panel>
      <PanelHeader icon={<Clock size={13} />} title="Heures Supplémentaires" color={C_ORANGE} />
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="Coût Heures Sup" value={fmtFcfa(d.montant_hs)}
            accent={C_ORANGE} icon={<Clock size={16} />} />
          <KpiCard label="Taux HS" value={fmtPct(d.taux_hs)}
            sub="du temps de travail total"
            accent={seuilOk ? '#4a7c10' : C_RED} />
        </div>
        <ProgressBar
          value={d.taux_hs}
          color={seuilOk ? C_GREEN : C_RED}
          label="Taux HS"
          objective={10}
        />
      </div>
    </Panel>
  )
}

function SectionFormation({ d }: { d: RhKpis }) {
  const ok = d.pct_formes >= 80
  const color = ok ? C_GREEN : d.pct_formes >= 50 ? C_BLUE : C_ORANGE
  return (
    <Panel>
      <PanelHeader icon={<GraduationCap size={13} />} title="Formation" color={C_BLUE} />
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="Heures Dispensées" value={fmtN(d.nb_heures_formation)}
            sub="heures de formation" icon={<GraduationCap size={16} />} accent={C_BLUE} />
          <KpiCard label="Collaborateurs Formés" value={fmtN(d.nb_collaborateurs_formes)}
            sub={`sur ${fmtN(d.nb_salaries)} salariés`} />
          <KpiCard label="Taux de Formation" value={fmtPct(d.pct_formes)}
            accent={color} />
        </div>
        <ProgressBar
          value={d.pct_formes}
          color={color}
          label="Couverture formation"
          objective={80}
        />
      </div>
    </Panel>
  )
}

/* ══════════════════════════ COMPOSANT PRINCIPAL ════════════════════════════ */
export default function RapportRH() {
  const { id } = useParams<{ id: string }>()
  const [data,    setData]    = useState<RhKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    setLoading(true); setErr('')
    fetch('/api/rh/kpis')
      .then(r => r.ok ? r.json() : Promise.reject('Service RH indisponible'))
      .then((d: RhKpis) => { setData(d); setLoading(false) })
      .catch(e => { setErr(String(e)); setLoading(false) })
  }, [])

  const showEffectif  = id === 'rh-effectif'
  const showSalaire   = id === 'rh-salaire'
  const showHS        = id === 'rh-hs'
  const showFormation = id === 'rh-formation'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#f4f6fb', fontFamily: F_BODY, overflowY: 'auto',
    }}>
      <style>{`@keyframes spin-rh { to { transform: rotate(360deg); } }`}</style>

      {/* ── En-tête section ───────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e8edf5',
        padding: '12px 24px', flexShrink: 0,
        boxShadow: '0 1px 4px rgba(31,59,114,.04)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ color: C_PURPLE, display: 'flex', alignItems: 'center' }}>
          {id === 'rh-effectif' ? <Users         size={14} strokeWidth={2} />
          : id === 'rh-salaire' ? <Banknote       size={14} strokeWidth={2} />
          : id === 'rh-hs'      ? <Clock          size={14} strokeWidth={2} />
          : <GraduationCap size={14} strokeWidth={2} />}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)',
          textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: F_BODY,
        }}>Direction des Ressources Humaines</span>
        {data && !loading && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600,
            color: 'rgba(31,59,114,.35)', fontFamily: F_BODY,
          }}>
            {fmtN(data.nb_salaries)} collaborateurs
          </span>
        )}
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {loading && <Loader />}
        {!loading && err  && <ErrMsg msg={err} />}
        {!loading && !err && data && (
          <>
            {showEffectif  && <SectionEffectif  d={data} />}
            {showSalaire   && <SectionSalaire   d={data} />}
            {showHS        && <SectionHS        d={data} />}
            {showFormation && <SectionFormation d={data} />}
          </>
        )}
      </div>
    </div>
  )
}
