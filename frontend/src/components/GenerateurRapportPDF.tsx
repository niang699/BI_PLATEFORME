'use client'
import { useState, useEffect } from 'react'
import {
  FileText, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react'

/* ─── Constantes (identiques au Planifier) ───────────────────────────────── */
const RAPPORTS = [
  { id: 'recouvrement', label: 'Recouvrement & Facturation', icon: '📈' },
  { id: 'facturation',  label: 'Facturation',                icon: '🧾' },
  { id: 'rh',           label: 'Ressources Humaines',        icon: '👥' },
]

const RH_INDICATEURS = [
  { id: 'kpis',       label: 'KPIs synthèse',            desc: 'Effectif, masse salariale, HS, formation' },
  { id: 'masse',      label: 'Masse salariale mensuelle', desc: 'Évolution mensuelle N vs N-1 + cumul' },
  { id: 'effectif',   label: 'Effectif & Structure',      desc: 'Par établissement et qualification' },
  { id: 'hs',         label: 'Heures supplémentaires',    desc: 'Par rubrique, établissement, catégorie' },
  { id: 'formation',  label: 'Formation',                 desc: 'Par thème et établissement' },
  { id: 'anciennete', label: 'Ancienneté',                desc: 'Tranches et féminisation' },
]

const FACT_INDICATEURS = [
  { id: 'kpis',         label: 'KPIs synthèse',          desc: 'CA, encaissement, impayés, taux recouvrement' },
  { id: 'par_dt',       label: 'Recouvrement par DT',     desc: 'CA, encaissement et taux par Direction Territoriale' },
  { id: 'par_bimestre', label: 'Évolution par bimestre',  desc: 'CA + encaissement + taux sur la période' },
  { id: 'impayes',      label: 'Analyse des impayés',     desc: 'Par DR, statut facture et groupe facturation' },
  { id: 'aging',        label: 'Aging des créances',      desc: 'Répartition J, J+15, J+30 … J+90, >90 jours' },
  { id: 'ca_detail',    label: 'Détail CA',               desc: 'Par groupe facturation, type facture, branchement' },
  { id: 'matrice',      label: 'Matrice DR × UO',         desc: 'Pivot Direction × Unité Opérationnelle × bimestres' },
]

const RECOUV_INDICATEURS = [
  { id: 'kpis',         label: 'KPIs synthèse',          desc: 'CA, encaissements, impayés, taux recouvrement' },
  { id: 'par_dt',       label: 'Recouvrement par DT',     desc: 'CA, encaissement et taux par Direction Territoriale' },
  { id: 'par_bimestre', label: 'Évolution par bimestre',  desc: 'CA + encaissement + taux sur la période' },
  { id: 'impayes',      label: 'Analyse des impayés',     desc: 'Par DR, statut facture et groupe facturation' },
  { id: 'aging',        label: 'Aging des créances',      desc: 'Répartition J, J+15, J+30 … J+90, >90 jours' },
]

const ANNEES = [2022, 2023, 2024, 2025, 2026]

const INDICATEURS_MAP: Record<string, typeof RH_INDICATEURS> = {
  rh:           RH_INDICATEURS,
  facturation:  FACT_INDICATEURS,
  recouvrement: RECOUV_INDICATEURS,
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Config {
  rapport_id:  string
  annee:       string
  dr:          string
  indicateurs: string[]
  groupes_fact: string[]
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANT
════════════════════════════════════════════════════════════════════════════ */
export default function GenerateurRapportPDF() {
  const [config, setConfig] = useState<Config>({
    rapport_id:  'recouvrement',
    annee:       String(new Date().getFullYear()),
    dr:          '',
    indicateurs: RECOUV_INDICATEURS.map(i => i.id),
    groupes_fact: [],
  })
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)
  const [groupesDispo, setGroupesDispo] = useState<string[]>([])

  /* Charger groupes facturation */
  useEffect(() => {
    fetch('/api/filtres')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.groupes_facturation)) setGroupesDispo(d.groupes_facturation) })
      .catch(() => {})
  }, [])

  /* Quand le rapport change → réinitialiser les indicateurs */
  const handleRapportChange = (id: string) => {
    const allIds = (INDICATEURS_MAP[id] ?? []).map(i => i.id)
    setConfig(c => ({ ...c, rapport_id: id, indicateurs: allIds, groupes_fact: [] }))
    setError(null)
    setSuccess(false)
  }

  const toggleIndicateur = (id: string) => {
    setConfig(c => ({
      ...c,
      indicateurs: c.indicateurs.includes(id)
        ? c.indicateurs.filter(x => x !== id)
        : [...c.indicateurs, id],
    }))
  }

  const toggleGroupe = (g: string) => {
    setConfig(c => ({
      ...c,
      groupes_fact: c.groupes_fact.includes(g)
        ? c.groupes_fact.filter(x => x !== g)
        : [...c.groupes_fact, g],
    }))
  }

  const currentIndicateurs = INDICATEURS_MAP[config.rapport_id] ?? []
  const allIds = currentIndicateurs.map(i => i.id)
  const canGenerate = config.indicateurs.length > 0

  /* ── Génération ── */
  const handleGenerate = async () => {
    if (!canGenerate) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    /*
     * Ouvrir la fenêtre IMMÉDIATEMENT (synchrone, dans le même event handler)
     * avant tout await — les navigateurs n'autorisent window.open() que
     * lorsqu'il est appelé directement depuis un geste utilisateur.
     */
    const win = window.open('', '_blank')
    if (!win) {
      setError('Votre navigateur bloque les popups. Autorisez-les pour ce site dans la barre d\'adresse.')
      setLoading(false)
      return
    }

    /* Afficher un écran de chargement pendant le fetch */
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>
        body { margin:0; display:flex; align-items:center; justify-content:center;
               min-height:100vh; font-family:'Nunito',sans-serif; background:#f8fafc; color:#1F3B72; }
        .loader { text-align:center; }
        .spinner { width:40px; height:40px; border:4px solid rgba(31,59,114,.15);
                   border-top-color:#1F3B72; border-radius:50%;
                   animation:spin .8s linear infinite; margin:0 auto 16px; }
        @keyframes spin { to { transform:rotate(360deg); } }
        p { font-size:14px; font-weight:600; opacity:.6; }
      </style></head><body>
      <div class="loader"><div class="spinner"></div><p>Génération du rapport en cours…</p></div>
    </body></html>`)
    win.document.close()

    const filtres: Record<string, string> = {
      indicateurs: config.indicateurs.join(','),
    }
    if (config.annee) filtres.annee = config.annee
    if (config.dr)    filtres.dr    = config.dr
    if (config.groupes_fact.length > 0)
      filtres.groupe_facturation = config.groupes_fact.join(',')

    try {
      const res = await fetch('/api/rapports/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rapport_id: config.rapport_id, filtres }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }))
        win.close()
        throw new Error(err.error ?? 'Erreur lors de la génération')
      }

      const html = await res.text()

      /* Écrire le rapport dans la fenêtre déjà ouverte */
      win.document.open()
      win.document.write(html)
      win.document.close()

      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const rapportCourant = RAPPORTS.find(r => r.id === config.rapport_id)!
  const showGroupes    = (config.rapport_id === 'facturation' || config.rapport_id === 'recouvrement') && groupesDispo.length > 0

  /* ─── RENDER ────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>

      {/* ══ PANNEAU GAUCHE — CONFIGURATION ══════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Choix du rapport */}
        <Card title="Type de rapport" icon="📋">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RAPPORTS.map(r => {
              const active = config.rapport_id === r.id
              return (
                <button key={r.id} onClick={() => handleRapportChange(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10, border: '1.5px solid',
                    borderColor: active ? '#1F3B72' : 'rgba(31,59,114,.12)',
                    background:  active ? 'rgba(31,59,114,.05)' : '#fff',
                    cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
                    fontFamily: "'Nunito', sans-serif",
                  }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 600,
                    color: active ? '#1F3B72' : 'rgba(31,59,114,.55)' }}>
                    {r.label}
                  </span>
                  {active && (
                    <span style={{
                      marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%',
                      background: '#1F3B72', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Filtres */}
        <Card title="Filtres" icon="🔍">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Année + DR */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FieldSmall label="Année">
                <select value={config.annee} onChange={e => setConfig(c => ({ ...c, annee: e.target.value }))}
                  style={inputSm}>
                  <option value="">Toutes années</option>
                  {ANNEES.map(a => <option key={a} value={String(a)}>{a}</option>)}
                </select>
              </FieldSmall>
              <FieldSmall label="Direction (DR)">
                <input value={config.dr}
                  onChange={e => setConfig(c => ({ ...c, dr: e.target.value }))}
                  placeholder="Ex : DR DAKAR"
                  style={inputSm} />
              </FieldSmall>
            </div>

            {/* Groupes facturation — toujours visible pour Facturation & Recouvrement */}
            {showGroupes && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.55)',
                    textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Groupe(s) de facturation
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {config.groupes_fact.length > 0 && (
                      <button onClick={() => setConfig(c => ({ ...c, groupes_fact: [] }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontSize: 10, fontWeight: 700, color: '#DC2626', fontFamily: "'Nunito', sans-serif" }}>
                        Réinitialiser
                      </button>
                    )}
                    <span style={{ fontSize: 10, color: 'rgba(31,59,114,.35)', fontWeight: 500 }}>
                      {config.groupes_fact.length === 0
                        ? 'Tous inclus'
                        : `${config.groupes_fact.length} sélectionné(s)`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {groupesDispo.map(g => {
                    const checked = config.groupes_fact.includes(g)
                    return (
                      <button key={g} onClick={() => toggleGroupe(g)}
                        style={{
                          padding: '4px 11px', borderRadius: 20, border: '1.5px solid',
                          borderColor: checked ? '#96C11E' : 'rgba(31,59,114,.14)',
                          background:  checked ? 'rgba(150,193,30,.1)' : '#fafbfc',
                          fontSize: 11, fontWeight: checked ? 700 : 500,
                          color: checked ? '#5a7a10' : 'rgba(31,59,114,.5)',
                          cursor: 'pointer', transition: 'all .14s',
                          fontFamily: "'Nunito', sans-serif",
                        }}>
                        {checked && <span style={{ marginRight: 4 }}>✓</span>}
                        {g}
                      </button>
                    )
                  })}
                </div>

                {groupesDispo.length === 0 && (
                  <p style={{ fontSize: 11, color: 'rgba(31,59,114,.3)', marginTop: 4 }}>
                    Chargement des groupes…
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Bouton générer */}
        <button onClick={handleGenerate}
          disabled={loading || !canGenerate}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '14px 24px', borderRadius: 12, border: 'none',
            background: (!canGenerate || loading) ? 'rgba(31,59,114,.2)' : 'linear-gradient(135deg, #1F3B72, #2B50A0)',
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: (!canGenerate || loading) ? 'not-allowed' : 'pointer',
            boxShadow: (!canGenerate || loading) ? 'none' : '0 6px 20px rgba(31,59,114,.3)',
            transition: 'all .2s', fontFamily: "'Nunito', sans-serif",
          }}>
          {loading ? (
            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Génération en cours…</>
          ) : (
            <><FileText size={16} /> Générer le rapport PDF</>
          )}
        </button>

        {/* Feedback */}
        {error && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.2)',
            borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#DC2626',
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}
        {success && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            background: 'rgba(5,150,105,.07)', border: '1px solid rgba(5,150,105,.2)',
            borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#059669', fontWeight: 600,
          }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            Rapport ouvert dans un nouvel onglet — utilisez Ctrl+P pour enregistrer en PDF.
          </div>
        )}
      </div>

      {/* ══ PANNEAU DROIT — INDICATEURS ══════════════════════════════════ */}
      <Card
        title={`Indicateurs — ${rapportCourant.label}`}
        icon={rapportCourant.icon}
        action={
          <button onClick={() => setConfig(c => ({
            ...c, indicateurs: c.indicateurs.length === allIds.length ? [] : allIds,
          }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 11, fontWeight: 700, color: '#1F3B72', opacity: .6 }}>
            {config.indicateurs.length === allIds.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        }>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {currentIndicateurs.map(ind => {
            const checked = config.indicateurs.includes(ind.id)
            return (
              <label key={ind.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                  padding: '11px 14px', borderRadius: 10, border: '1.5px solid',
                  borderColor: checked ? 'rgba(150,193,30,.35)' : 'rgba(31,59,114,.1)',
                  background:  checked ? 'rgba(150,193,30,.05)' : '#fafbfc',
                  transition: 'all .15s',
                }}>
                <input type="checkbox" checked={checked} onChange={() => toggleIndicateur(ind.id)}
                  style={{ marginTop: 3, accentColor: '#96C11E', flexShrink: 0, width: 14, height: 14 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    color: checked ? '#1F3B72' : 'rgba(31,59,114,.45)' }}>
                    {ind.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(31,59,114,.38)', marginTop: 2, lineHeight: 1.4 }}>
                    {ind.desc}
                  </div>
                </div>
                {checked && (
                  <span style={{
                    flexShrink: 0, marginTop: 2, width: 7, height: 7, borderRadius: '50%',
                    background: '#96C11E', display: 'block',
                  }} />
                )}
              </label>
            )
          })}
        </div>

        {config.indicateurs.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
            Sélectionnez au moins un indicateur pour générer le rapport.
          </div>
        )}

        {/* Récapitulatif sélection */}
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(31,59,114,.04)', border: '1px solid rgba(31,59,114,.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(31,59,114,.45)', fontWeight: 600 }}>
            {config.indicateurs.length} / {allIds.length} indicateurs sélectionnés
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: config.annee ? 'rgba(31,59,114,.08)' : 'rgba(150,193,30,.1)',
            color: config.annee ? '#1F3B72' : '#5a7a10',
          }}>
            {config.annee ? `Année ${config.annee}` : 'Toutes années'}
            {config.dr ? ` · ${config.dr}` : ''}
          </span>
        </div>
      </Card>

      {/* Spinner animation inline */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ─── Composants internes ─────────────────────────────────────────────────── */
function Card({
  title, icon, children, action,
}: {
  title: string; icon: string
  children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      boxShadow: '0 2px 10px rgba(31,59,114,.10)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 16px', borderBottom: '1px solid rgba(31,59,114,.07)',
        background: 'linear-gradient(135deg, #fafbfc, #fff)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1F3B72',
            textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {title}
          </span>
        </div>
        {action}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function FieldSmall({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(31,59,114,.5)',
        textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</label>
      {children}
    </div>
  )
}

const inputSm: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 7, fontSize: 12,
  border: '1px solid rgba(31,59,114,.16)', color: '#1F3B72',
  background: '#fff', outline: 'none', width: '100%',
  boxSizing: 'border-box', fontFamily: "'Nunito', sans-serif",
}
