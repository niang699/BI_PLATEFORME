'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Hash, MapPin, Home, Phone, Droplets, Route, Crosshair, X as XIcon, CheckCircle2, AlertTriangle, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { profilColor, secteurColor } from './carteUtils'
import type { SecteurPoint, ClientPoint } from './CarteMap'

/* ── Leaflet chargé uniquement côté client (pas de SSR) ── */
const CarteMap = dynamic(() => import('./CarteMap'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e8edf5', borderTopColor: '#1F3B72', animation: 'spin-crt 0.9s linear infinite' }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1F3B72', fontFamily: "'Nunito',sans-serif" }}>Initialisation de la carte…</div>
      <style>{`@keyframes spin-crt{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
})

/* ═══════════════════════════════ STYLES ═══════════════════════════════════ */
const F_TITLE = "'Barlow Semi Condensed', sans-serif"
const F_BODY  = "'Nunito', sans-serif"
const C_NAVY  = '#1F3B72'
const C_GREEN = '#96C11E'
const C_RED   = '#E84040'
const OBJECTIF = 98.5

/* ── Échelle de risque (partagée avec légende) ── */
const RISK_SCALE = [
  { label: 'Objectif atteint',  color: '#22c55e', min: OBJECTIF,  max: Infinity },
  { label: 'Sous objectif',     color: '#ca8a04', min: 95,        max: OBJECTIF },
  { label: 'À surveiller',      color: '#d97706', min: 90,        max: 95 },
  { label: 'Critique',          color: '#E84040', min: 0,         max: 90 },
  { label: 'Sans données',      color: '#1F3B72', min: -1,        max: 0 },
]

function fmtN(v: number) { return v.toLocaleString('fr-FR') }
function fmtF(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' MF'
  if (v >= 1_000)     return (v / 1_000).toLocaleString('fr-FR',     { maximumFractionDigits: 0 }) + ' kF'
  return v.toLocaleString('fr-FR') + ' F'
}

/* ═══════════════════════════ PANNEAU CLIENT ═══════════════════════════════ */
function ClientPanel({ client, onClose }: { client: ClientPoint; onClose: () => void }) {
  const color = profilColor(client.profil)
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 1200,
      width: 300, background: '#fff', borderRadius: 16,
      boxShadow: '0 8px 40px rgba(31,59,114,.20)', border: '1px solid #e8edf5',
      overflow: 'hidden', fontFamily: F_BODY, animation: 'slideIn .2s ease',
    }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, padding: '14px 16px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><XIcon size={14} strokeWidth={2.5} /></button>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: F_TITLE, lineHeight: 1.2, paddingRight: 30 }}>{client.nom} {client.prenom}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{client.profil}</div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {([
          { icon: <Hash size={13} strokeWidth={2} />, label: 'Référence',   value: client.ref },
          { icon: <MapPin size={13} strokeWidth={2} />, label: 'Secteur',     value: client.uo },
          { icon: <Home size={13} strokeWidth={2} />, label: 'Adresse',     value: client.adresse || '—' },
          { icon: <Phone size={13} strokeWidth={2} />, label: 'Téléphone',   value: client.telephone || '—' },
          { icon: <Droplets size={13} strokeWidth={2} />, label: 'Compteur',    value: client.compteur ? `N° ${client.compteur} · ${client.diametre || ''}` : '—' },
          { icon: <Route size={13} strokeWidth={2} />, label: 'Tournée',     value: client.tournee || '—' },
          { icon: <Crosshair size={13} strokeWidth={2} />, label: 'Coordonnées', value: `${client.lat.toFixed(5)}, ${client.lng.toFixed(5)}` },
        ] as { icon: React.ReactNode; label: string; value: string }[]).map(r => (
          <div key={r.label} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2, color: 'rgba(31,59,114,.4)' }}>{r.icon}</span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{r.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C_NAVY, lineHeight: 1.3 }}>{r.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════ PANNEAU RISQUES (overlay) ═════════════════════════ */
function RiskPanel({
  secteurs,
  onFocus,
  onClose,
}: {
  secteurs:  SecteurPoint[]
  onFocus:   (s: SecteurPoint) => void
  onClose:   () => void
}) {
  // Secteurs à risque triés du pire au meilleur
  const risque = useMemo(() =>
    secteurs
      .filter(s => (s.taux_recouvrement ?? 0) > 0 && s.taux_recouvrement! < OBJECTIF)
      .sort((a, b) => (a.taux_recouvrement ?? 0) - (b.taux_recouvrement ?? 0))
  , [secteurs])

  if (risque.length === 0) return (
    <div style={panelStyle}>
      <PanelHeader count={0} onClose={onClose} />
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: '#22c55e', fontFamily: F_BODY, fontWeight: 600 }}>
        <CheckCircle2 size={14} strokeWidth={2} />Tous les secteurs atteignent l&apos;objectif
      </div>
    </div>
  )

  return (
    <div style={panelStyle}>
      <PanelHeader count={risque.length} onClose={onClose} />
      <div style={{ overflowY: 'auto', maxHeight: 360 }}>
        {risque.map((s, i) => {
          const color = secteurColor(s.taux_recouvrement)
          const taux  = s.taux_recouvrement ?? 0
          return (
            <button
              key={s.uo}
              onClick={() => onFocus(s)}
              style={{
                width: '100%', textAlign: 'left', background: 'none',
                border: 'none', borderBottom: '1px solid #f1f5f9',
                padding: '9px 14px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 10, transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {/* Rang */}
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: '#fff' }}>
                {i + 1}
              </div>
              {/* Infos secteur */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C_NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.uo}
                </div>
                {/* Mini barre */}
                <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', marginTop: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, taux)}%`, background: color, borderRadius: 2 }} />
                  <div style={{ position: 'absolute', top: 0, left: '98.5%', width: 1.5, height: '100%', background: '#334155', opacity: .5 }} />
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                  {fmtN(s.nb_total)} clients · {fmtF(s.imp_total ?? 0)} impayés
                  {(s.nb_sans_facture ?? 0) > 0 && (
                    <span style={{ color: '#E84040', fontWeight: 700, marginLeft: 4 }}>
                      · {fmtN(s.nb_sans_facture!)} non fact.
                    </span>
                  )}
                </div>
              </div>
              {/* Taux */}
              <div style={{ flexShrink: 0, fontWeight: 900, fontSize: 13, color, fontFamily: F_TITLE }}>
                {taux.toFixed(1)}%
              </div>
              {/* Flèche focus */}
              <div style={{ fontSize: 14, color: '#94a3b8', flexShrink: 0 }}>›</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'absolute', top: 80, left: 12, zIndex: 1100,
  width: 300, background: '#fff', borderRadius: 14,
  boxShadow: '0 8px 32px rgba(31,59,114,.16)', border: '1px solid #e8edf5',
  overflow: 'hidden', fontFamily: F_BODY, animation: 'slideInL .2s ease',
}


function PanelHeader({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div style={{ padding: '11px 14px', background: count > 0 ? 'rgba(220,38,38,.06)' : 'rgba(34,197,94,.06)',
      borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
      <style>{`@keyframes slideInL{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: count > 0 ? C_RED : '#22c55e', flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 11, fontWeight: 800, color: C_NAVY }}>
        {count > 0 ? `${count} secteur${count > 1 ? 's' : ''} à risque` : 'Aucun secteur à risque'}
        {count > 0 && <span style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginLeft: 6 }}>cliquez pour centrer</span>}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}><XIcon size={15} strokeWidth={2} /></button>
    </div>
  )
}

/* ── Types filtres disponibles ── */
interface FiltresDispo {
  annees:  number[]
  drs:     string[]
  statuts: string[]
  groupes: string[]
}

/* ══════════════════════════ COMPOSANT PRINCIPAL ═══════════════════════════ */
export default function RapportCarteClients() {
  const router = useRouter()
  const [secteurs,      setSecteurs]      = useState<SecteurPoint[]>([])
  const [loadingOvw,    setLoadingOvw]    = useState(true)
  const [errOvw,        setErrOvw]        = useState('')
  const [filtresDispo,  setFiltresDispo]  = useState<FiltresDispo | null>(null)
  const [showRiskPanel,  setShowRiskPanel]  = useState(false)
  // Filtres financiers (déclenchent un re-fetch)
  const [filtreAnnee,    setFiltreAnnee]    = useState(2025)
  const [filtreBimestre, setFiltreBimestre] = useState('')
  const [filtreDR,       setFiltreDR]       = useState('')
  const [filtreStatut,   setFiltreStatut]   = useState('')
  const [filtreGroupe,   setFiltreGroupe]   = useState<string[]>([])

  const [stats,         setStats]         = useState({ nbVisible: 0, capped: false, zoom: 7 })
  const [clientSel,     setClientSel]     = useState<ClientPoint | null>(null)
  const [focusLatLng,   setFocusLatLng]   = useState<[number, number] | null>(null)
  const [showFilters,   setShowFilters]   = useState(false)

  /* ── Charger les valeurs de filtres disponibles (une seule fois) ── */
  useEffect(() => {
    fetch('/api/carte/filtres')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFiltresDispo(d) })
      .catch(() => {})
  }, [])

  /* ── Re-charger l'overview quand les filtres financiers changent ── */
  useEffect(() => {
    setLoadingOvw(true)
    setErrOvw('')
    const p = new URLSearchParams({ annee: String(filtreAnnee) })
    if (filtreBimestre)        p.set('bimestre', filtreBimestre)
    if (filtreDR)              p.set('dr',       filtreDR)
    if (filtreStatut)          p.set('statut',   filtreStatut)
    filtreGroupe.forEach(g => p.append('groupe', g))

    fetch(`/api/carte/overview?${p}`)
      .then(r => r.ok ? r.json() : Promise.reject('Erreur serveur'))
      .then(d => { setSecteurs(d.secteurs ?? []); setLoadingOvw(false) })
      .catch(e => { setErrOvw(String(e)); setLoadingOvw(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreAnnee, filtreBimestre, filtreDR, filtreStatut, filtreGroupe.join(',')])

  /* ── Secteurs actifs dans le périmètre filtré ── */
  // Quand DR / statut / groupe est actif → ne garder que les secteurs avec données financières
  // (secteurs hors DR auraient nb_factures=0, taux=0 → inutile de les afficher)
  const hasFilterRestrictif = !!(filtreDR || filtreStatut || filtreGroupe.length > 0)
  const secteursActifs = useMemo(
    () => hasFilterRestrictif ? secteurs.filter(s => (s.nb_factures ?? 0) > 0) : secteurs,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [secteurs, hasFilterRestrictif]
  )

  /* ── Calculs globaux (basés sur secteursActifs pour cohérence map ↔ KPI) ── */
  const totalParcActif = useMemo(() => secteursActifs.reduce((s, r) => s + (r.nb_total_live ?? r.nb_total), 0), [secteursActifs])
  const totalActifs    = useMemo(() => secteursActifs.reduce((s, r) => s + (r.nb_avec_facture     ?? 0),    0), [secteursActifs])
  const totalSansFact  = useMemo(() => secteursActifs.reduce((s, r) => s + (r.nb_sans_facture_filtre ?? 0), 0), [secteursActifs])
  const caTotal        = useMemo(() => secteursActifs.reduce((s, r) => s + (r.ca_total  ?? 0), 0), [secteursActifs])
  const impTotal       = useMemo(() => secteursActifs.reduce((s, r) => s + (r.imp_total ?? 0), 0), [secteursActifs])
  const nbRisque       = useMemo(() => secteursActifs.filter(s => (s.taux_recouvrement ?? 0) > 0 && s.taux_recouvrement! < OBJECTIF).length, [secteursActifs])
  const tauxGlobal     = useMemo(() => caTotal > 0 ? Math.round((caTotal - impTotal) / caTotal * 1000) / 10 : 0, [caTotal, impTotal])
  const pctSansFact    = useMemo(() => totalParcActif > 0 ? Math.round(totalSansFact / totalParcActif * 100) : 0, [totalSansFact, totalParcActif])


  const isZoomDetail = stats.zoom >= 13

  /* Centrer la carte sur un secteur depuis le panneau risques */
  function focusSecteur(s: SecteurPoint) {
    setFocusLatLng([s.lat, s.lng])
    setTimeout(() => setFocusLatLng(null), 200)
  }

  const hasActiveFilters = !!(filtreBimestre || filtreDR || filtreStatut || filtreGroupe.length > 0)

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', fontFamily: F_BODY }}>
      <style>{`@keyframes spin-crt { to { transform: rotate(360deg); } }`}</style>

      {/* ══ CARTE — plein écran ════════════════════════════════════════════ */}
      {!loadingOvw && !errOvw && (
        <CarteMap
          secteurs={secteursActifs}
          filtreUO=""
          filtreProfil=""
          onStatsUpdate={setStats}
          onSelectClient={setClientSel}
          focusLatLng={focusLatLng}
        />
      )}

      {/* Skeleton chargement carte */}
      {loadingOvw && (
        <div style={{ position: 'absolute', inset: 0, background: '#eef3f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-crt 0.9s linear infinite' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: C_NAVY }}>Chargement de la carte…</div>
        </div>
      )}

      {/* ══ OVERLAY TOP — KPIs flottants ══════════════════════════════════ */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap',
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 14, padding: '8px 12px',
        boxShadow: '0 4px 24px rgba(31,59,114,.14), 0 0 0 1px rgba(31,59,114,.06)',
      }}>
        {/* Spinner inline */}
        {loadingOvw && <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-crt 0.8s linear infinite', flexShrink: 0 }} />}

        <KpiChip label={totalActifs > 0 ? 'Facturés' : 'Actifs'} value={loadingOvw ? '…' : fmtN(totalActifs > 0 ? totalActifs : totalParcActif)} color={C_GREEN} sub={!loadingOvw && totalActifs > 0 ? `/ ${fmtN(totalParcActif)}` : undefined} />

        <div style={{ width: 1, height: 28, background: '#e8edf5', flexShrink: 0 }} />

        <KpiChip label="Secteurs" value={loadingOvw ? '…' : fmtN(secteursActifs.length)} color={C_NAVY} />

        {!loadingOvw && caTotal > 0 && (<>
          <div style={{ width: 1, height: 28, background: '#e8edf5', flexShrink: 0 }} />
          <KpiChip label="Taux global" value={`${tauxGlobal.toFixed(1)} %`}
            color={tauxGlobal >= OBJECTIF ? '#22c55e' : tauxGlobal >= 95 ? '#ca8a04' : tauxGlobal >= 90 ? '#d97706' : C_RED}
            sub={`obj. ${OBJECTIF} %`} />
        </>)}

        {!loadingOvw && impTotal > 0 && (<>
          <div style={{ width: 1, height: 28, background: '#e8edf5', flexShrink: 0 }} />
          <KpiChip label="Impayés" value={fmtF(impTotal)} color={C_RED} />
        </>)}

        {!loadingOvw && totalSansFact > 0 && (<>
          <div style={{ width: 1, height: 28, background: '#e8edf5', flexShrink: 0 }} />
          <KpiChip label="Non facturés" value={fmtN(totalSansFact)} color="#E84040" sub={`${pctSansFact} % du parc`} />
        </>)}

        {isZoomDetail && (<>
          <div style={{ width: 1, height: 28, background: '#e8edf5', flexShrink: 0 }} />
          <KpiChip label={stats.capped ? 'Points (max)' : 'Points'} value={fmtN(stats.nbVisible)} color={stats.capped ? '#d97706' : C_NAVY} />
        </>)}
      </div>

      {/* ══ OVERLAY TOP-LEFT — Bouton filtres + bouton risques ════════════ */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Bouton filtres */}
        <button onClick={() => setShowFilters(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
          background: showFilters ? C_NAVY : 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${showFilters ? C_NAVY : 'rgba(31,59,114,.1)'}`,
          borderRadius: 11, cursor: 'pointer', fontFamily: F_BODY,
          boxShadow: '0 2px 12px rgba(31,59,114,.14)',
          transition: 'all .15s',
        }}>
          <SlidersHorizontal size={13} color={showFilters ? '#fff' : C_NAVY} strokeWidth={2.2} />
          <span style={{ fontSize: 11, fontWeight: 800, color: showFilters ? '#fff' : C_NAVY }}>Filtres</span>
          {hasActiveFilters && !showFilters && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C_GREEN, display: 'inline-block' }} />
          )}
          {showFilters ? <ChevronUp size={11} color="#fff" /> : <ChevronDown size={11} color={C_NAVY} />}
        </button>

        {/* Bouton secteurs à risque */}
        {!loadingOvw && (
          <button onClick={() => setShowRiskPanel(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
            background: showRiskPanel ? C_RED : nbRisque > 0 ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.75)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${showRiskPanel ? C_RED : nbRisque > 0 ? 'rgba(232,64,64,.3)' : 'rgba(31,59,114,.08)'}`,
            borderRadius: 11, cursor: 'pointer', fontFamily: F_BODY,
            boxShadow: '0 2px 12px rgba(31,59,114,.12)', transition: 'all .15s',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: showRiskPanel ? '#fff' : (nbRisque > 0 ? C_RED : '#94a3b8'), flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: showRiskPanel ? '#fff' : (nbRisque > 0 ? C_RED : 'rgba(31,59,114,.4)') }}>
              {nbRisque} à risque
            </span>
          </button>
        )}

        {/* Bouton CA manquant */}
        {!loadingOvw && totalSansFact > 0 && (
          <button onClick={() => router.push('/viewer/prises-facturation')} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
            background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(232,64,64,.25)', borderRadius: 11, cursor: 'pointer', fontFamily: F_BODY,
            boxShadow: '0 2px 12px rgba(31,59,114,.12)', transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C_RED; (e.currentTarget.querySelector('span') as HTMLElement).style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.92)'; (e.currentTarget.querySelector('span') as HTMLElement).style.color = C_RED }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C_RED, transition: 'color .15s' }}>CA manquant →</span>
          </button>
        )}
      </div>

      {/* ══ PANNEAU FILTRES — dropdown overlay ════════════════════════════ */}
      {showFilters && (
        <div style={{
          position: 'absolute', top: 56, left: 12, zIndex: 30,
          background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 14, padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(31,59,114,.16), 0 0 0 1px rgba(31,59,114,.06)',
          display: 'flex', flexDirection: 'column', gap: 12, minWidth: 320,
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Filtres recouvrement
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FiltreSelect label="Année" value={String(filtreAnnee)} onChange={v => setFiltreAnnee(Number(v))}
              options={(filtresDispo?.annees ?? [2025, 2024, 2023]).map(a => ({ value: String(a), label: String(a) }))} />
            <FiltreSelect label="Bimestre" value={filtreBimestre} onChange={setFiltreBimestre} placeholder="Tous"
              options={[
                { value: '1', label: 'B1 — Jan · Fév' }, { value: '2', label: 'B2 — Mar · Avr' },
                { value: '3', label: 'B3 — Mai · Jun' }, { value: '4', label: 'B4 — Jul · Aoû' },
                { value: '5', label: 'B5 — Sep · Oct' }, { value: '6', label: 'B6 — Nov · Déc' },
              ]} />
            <FiltreSelect label="Direction Régionale" value={filtreDR} onChange={setFiltreDR} placeholder="Toutes les DR"
              options={(filtresDispo?.drs ?? []).map(d => ({ value: d, label: d }))} />
            <FiltreSelect label="Statut facture" value={filtreStatut} onChange={setFiltreStatut} placeholder="Tous les statuts"
              options={(filtresDispo?.statuts ?? []).map(s => ({ value: s, label: s }))} />
          </div>
          <MultiSelect label="Groupe facturation" values={filtreGroupe} onChange={setFiltreGroupe}
            placeholder="Tous les groupes" options={(filtresDispo?.groupes ?? []).map(g => ({ value: g, label: g }))} />
          {hasActiveFilters && (
            <button onClick={() => { setFiltreBimestre(''); setFiltreDR(''); setFiltreStatut(''); setFiltreGroupe([]) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #e8edf5', background: '#f8fafc', color: 'rgba(31,59,114,.55)', fontSize: 11, fontWeight: 700, fontFamily: F_BODY, cursor: 'pointer', alignSelf: 'flex-start' }}>
              <RotateCcw size={11} strokeWidth={2.2} /> Réinitialiser les filtres
            </button>
          )}
          {loadingOvw && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(31,59,114,.4)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #e8edf5', borderTopColor: C_NAVY, animation: 'spin-crt 0.8s linear infinite' }} />
              Actualisation…
            </div>
          )}
        </div>
      )}

      {/* ══ PANNEAU RISQUES — overlay gauche ═══════════════════════════════ */}
      {showRiskPanel && !loadingOvw && (
        <RiskPanel secteurs={secteursActifs} onFocus={focusSecteur} onClose={() => setShowRiskPanel(false)} />
      )}

      {/* ══ LÉGENDE — bottom-left ══════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', bottom: 28, left: 12, zIndex: 10,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 4px 20px rgba(31,59,114,.12), 0 0 0 1px rgba(31,59,114,.06)',
        fontFamily: F_BODY, minWidth: 170,
      }}>
        <div style={legendTitle}>Taux de recouvrement</div>
        {RISK_SCALE.map(r => (
          <LegendRow key={r.label} color={r.color} label={r.label}
            sub={r.min > 0 && r.max < Infinity ? `${r.min} – ${r.max} %`
              : r.min >= OBJECTIF ? `≥ ${OBJECTIF} %`
              : r.min === 0 ? `< 90 %` : undefined} />
        ))}
        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 7, lineHeight: 1.5, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
          Taille ∝ nb clients actifs<br />Zoom ≥ 13 pour les points
        </div>
      </div>

      {/* ══ SOURCE — bottom-right ═════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', bottom: 6, right: 12, zIndex: 10,
        fontSize: 9, fontWeight: 600, color: 'rgba(31,59,114,.45)', fontFamily: F_BODY,
        background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(8px)',
        padding: '3px 8px', borderRadius: 6,
      }}>
        SEN&apos;EAU · {filtreAnnee}{filtreBimestre ? ` · B${filtreBimestre}` : ''}{filtreDR ? ` · ${filtreDR}` : ''}{filtreGroupe.length > 0 ? ` · ${filtreGroupe.join(', ')}` : ''}{filtreStatut ? ` · ${filtreStatut}` : ''}
      </div>

      {/* ══ ERREUR ════════════════════════════════════════════════════════ */}
      {errOvw && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
          background: 'rgba(255,255,255,.95)', borderRadius: 10, padding: '10px 16px',
          border: '1px solid rgba(232,64,64,.25)', boxShadow: '0 4px 20px rgba(232,64,64,.12)',
          fontSize: 12, color: C_RED, fontFamily: F_BODY, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={13} strokeWidth={2} style={{ flexShrink: 0 }} />{errOvw}
        </div>
      )}

      {/* ══ PANNEAU CLIENT ════════════════════════════════════════════════ */}
      {clientSel && <ClientPanel client={clientSel} onClose={() => setClientSel(null)} />}
    </div>
  )
}

/* ═══════════════════════════ SOUS-COMPOSANTS ══════════════════════════════ */
function KpiChip({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '7px 14px', border: '1px solid #e8edf5', textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: F_BODY }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, fontFamily: F_TITLE, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function LegendRow({ color, label, sub }: { color: string; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.12)' }} />
      <div>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#1F3B72' }}>{label}</span>
        {sub && <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  )
}

const legendTitle: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, color: 'rgba(31,59,114,.4)',
  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
}

/* ── Multi-select filtre (checkboxes) ── */
function MultiSelect({ label, values, onChange, options, placeholder }: {
  label:        string
  values:       string[]
  onChange:     (v: string[]) => void
  options:      { value: string; label: string }[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'Nunito', sans-serif" }}>
        {label}
      </span>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px 8px', borderRadius: 7,
          border: `1px solid ${values.length > 0 ? '#1F3B72' : '#e8edf5'}`,
          fontSize: 11, fontWeight: values.length > 0 ? 700 : 500,
          fontFamily: "'Nunito', sans-serif",
          color: values.length > 0 ? '#1F3B72' : 'rgba(31,59,114,.5)',
          background: values.length > 0 ? 'rgba(31,59,114,.04)' : '#fff',
          cursor: 'pointer', minWidth: 130, textAlign: 'left',
        }}
      >
        {values.length === 0 ? (placeholder ?? 'Tous') : `${values.length} sélectionné${values.length > 1 ? 's' : ''}`}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 500,
          background: '#fff', border: '1px solid #e8edf5', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(31,59,114,.12)', minWidth: 220,
          marginTop: 4, maxHeight: 240, overflowY: 'auto',
        }}>
          {options.map(o => (
            <label key={o.value} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 12px', cursor: 'pointer', fontSize: 11,
              fontWeight: 600, color: '#1F3B72', fontFamily: "'Nunito', sans-serif",
              borderBottom: '1px solid #f8fafc',
            }}>
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                onChange={e => {
                  if (e.target.checked) onChange([...values, o.value])
                  else onChange(values.filter(v => v !== o.value))
                }}
                style={{ accentColor: '#1F3B72' }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Dropdown filtre générique ── */
function FiltreSelect({
  label, value, onChange, options, placeholder,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  options:      { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(31,59,114,.4)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'Nunito', sans-serif" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '5px 8px', borderRadius: 7,
          border: `1px solid ${value ? '#1F3B72' : '#e8edf5'}`,
          fontSize: 11, fontWeight: value ? 700 : 500,
          fontFamily: "'Nunito', sans-serif",
          color: value ? '#1F3B72' : 'rgba(31,59,114,.5)',
          background: value ? 'rgba(31,59,114,.04)' : '#fff',
          cursor: 'pointer', outline: 'none', minWidth: 130,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
