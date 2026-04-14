'use client'
import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Play, Pencil,
  Mail, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Plan {
  id: number; name: string; rapport_id: string
  filtres: Record<string, string>; format: string
  frequence: string; destinataires: string[]
  sujet: string; actif: boolean
  derniere_exec: string | null; dernier_statut: 'ok' | 'error' | null
  created_at: string
}

/* ─── Constantes ─────────────────────────────────────────────────────────── */
const RAPPORTS = [
  { id: 'recouvrement', label: 'Recouvrement & Facturation' },
  { id: 'rh',           label: 'Ressources Humaines' },
  { id: 'facturation',  label: 'Facturation' },
]

const RH_INDICATEURS = [
  { id: 'kpis',       label: 'KPIs synthèse',            desc: 'Effectif, masse salariale, HS, formation' },
  { id: 'masse',      label: 'Masse salariale mensuelle', desc: 'Évolution mensuelle N vs N-1 + cumul' },
  { id: 'effectif',   label: 'Effectif & Structure',      desc: 'Par établissement et qualification' },
  { id: 'hs',         label: 'Heures supplémentaires',    desc: 'Par rubrique, établissement, catégorie' },
  { id: 'formation',  label: 'Formation',                 desc: 'Par thème et établissement' },
  { id: 'anciennete', label: 'Ancienneté',                desc: 'Tranches et féminisation' },
]
const RH_ALL = RH_INDICATEURS.map(i => i.id)

const FACT_INDICATEURS = [
  { id: 'kpis',         label: 'KPIs synthèse',         desc: 'CA, encaissement, impayés, taux recouvrement' },
  { id: 'par_dt',       label: 'Recouvrement par DT',   desc: 'CA, encaissement et taux par Direction Territoriale' },
  { id: 'par_bimestre', label: 'Évolution par bimestre',desc: 'CA + encaissement + taux sur la période' },
  { id: 'impayes',      label: 'Analyse des impayés',   desc: 'Par DR, statut facture et groupe facturation' },
  { id: 'aging',        label: 'Aging des créances',    desc: 'Répartition J, J+15, J+30 … J+90, >90 jours' },
  { id: 'ca_detail',    label: 'Détail CA',              desc: 'Par groupe facturation, type facture, branchement' },
  { id: 'matrice',      label: 'Matrice DR × UO',        desc: 'Pivot Direction × Unité Opérationnelle × bimestres' },
]
const FACT_ALL = FACT_INDICATEURS.map(i => i.id)

const RECOUV_INDICATEURS = [
  { id: 'kpis',         label: 'KPIs synthèse',         desc: 'CA, encaissements, impayés, taux recouvrement' },
  { id: 'par_dt',       label: 'Recouvrement par DT',   desc: 'CA, encaissement et taux par Direction Territoriale' },
  { id: 'par_bimestre', label: 'Évolution par bimestre',desc: 'CA + encaissement + taux sur la période' },
  { id: 'impayes',      label: 'Analyse des impayés',   desc: 'Par DR, statut facture et groupe facturation' },
  { id: 'aging',        label: 'Aging des créances',    desc: 'Répartition J, J+15, J+30 … J+90, >90 jours' },
]
const RECOUV_ALL = RECOUV_INDICATEURS.map(i => i.id)

const FREQUENCES = [
  { id: 'daily',   label: 'Quotidien',    detail: 'Tous les jours à 7h00' },
  { id: 'weekly',  label: 'Hebdomadaire', detail: 'Tous les lundis à 7h00' },
  { id: 'monthly', label: 'Mensuel',      detail: 'Le 1er de chaque mois à 7h00' },
]
const FREQ_COLOR: Record<string, string> = {
  daily: '#DC2626', weekly: '#D97706', monthly: '#96C11E',
}

const EMPTY_FORM = {
  name: '', rapport_id: 'recouvrement', format: 'xlsx',
  frequence: 'monthly', sujet: '', actif: true,
  destinataires_txt: '', annee: '', dr: '',
  rh_indicateurs:     RH_ALL     as string[],
  fact_indicateurs:   FACT_ALL   as string[],
  recouv_indicateurs: RECOUV_ALL as string[],
  groupes_fact:       []         as string[],
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANT
════════════════════════════════════════════════════════════════════════════ */
export default function RapportsPlanifiesPanel() {
  const [plans,        setPlans]        = useState<Plan[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(false)
  const [editPlan,     setEditPlan]     = useState<Plan | null>(null)
  const [form,         setForm]         = useState({ ...EMPTY_FORM })
  const [saving,       setSaving]       = useState(false)
  const [testing,      setTesting]      = useState<number | null>(null)
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [groupesDispo, setGroupesDispo] = useState<string[]>([])

  const load = () => {
    setLoading(true)
    fetch('/api/scheduler/plans')
      .then(r => r.json())
      .then(d => { setPlans(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch('/api/filtres')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d?.groupes_facturation) ? d.groupes_facturation as string[] : []
        setGroupesDispo(list)
      })
      .catch(() => {})
  }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const openCreate = () => { setEditPlan(null); setForm({ ...EMPTY_FORM }); setModal(true) }

  const openEdit = (p: Plan) => {
    setEditPlan(p)
    setForm({
      name: p.name, rapport_id: p.rapport_id, format: p.format,
      frequence: p.frequence, sujet: p.sujet, actif: p.actif,
      destinataires_txt: p.destinataires.join(', '),
      annee: p.filtres.annee ?? '', dr: p.filtres.dr ?? '',
      rh_indicateurs:     p.rapport_id === 'rh' && p.filtres.indicateurs ? p.filtres.indicateurs.split(',') : RH_ALL,
      fact_indicateurs:   p.rapport_id === 'facturation' && p.filtres.indicateurs ? p.filtres.indicateurs.split(',') : FACT_ALL,
      recouv_indicateurs: p.rapport_id === 'recouvrement' && p.filtres.indicateurs ? p.filtres.indicateurs.split(',') : RECOUV_ALL,
      groupes_fact: p.filtres.groupe_facturation ? p.filtres.groupe_facturation.split(',').map(s => s.trim()).filter(Boolean) : [],
    })
    setModal(true)
  }

  const handleSubmit = async () => {
    if (!form.name || !form.destinataires_txt) return
    if (form.rapport_id === 'rh'           && (form.rh_indicateurs     ?? []).length === 0) return
    if (form.rapport_id === 'facturation'  && (form.fact_indicateurs   ?? []).length === 0) return
    if (form.rapport_id === 'recouvrement' && (form.recouv_indicateurs ?? []).length === 0) return
    setSaving(true)
    const body = {
      name: form.name, rapport_id: form.rapport_id, format: form.format,
      frequence: form.frequence, sujet: form.sujet || form.name,
      actif: form.actif,
      destinataires: form.destinataires_txt.split(',').map(s => s.trim()).filter(Boolean),
      filtres: {
        ...(form.annee ? { annee: form.annee } : {}),
        ...(form.dr    ? { dr:    form.dr    } : {}),
        ...(form.rapport_id === 'rh' && (form.rh_indicateurs ?? []).length > 0
          ? { indicateurs: (form.rh_indicateurs ?? []).join(',') } : {}),
        ...(form.rapport_id === 'facturation' && (form.fact_indicateurs ?? []).length > 0
          ? { indicateurs: (form.fact_indicateurs ?? []).join(',') } : {}),
        ...(form.rapport_id === 'recouvrement' && (form.recouv_indicateurs ?? []).length > 0
          ? { indicateurs: (form.recouv_indicateurs ?? []).join(',') } : {}),
        ...((form.rapport_id === 'facturation' || form.rapport_id === 'recouvrement') && (form.groupes_fact ?? []).length > 0
          ? { groupe_facturation: (form.groupes_fact ?? []).join(',') } : {}),
      },
    }
    try {
      const url    = editPlan ? `/api/scheduler/plans/${editPlan.id}` : '/api/scheduler/plans'
      const method = editPlan ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error(await r.text())
      setModal(false); load()
      showToast(editPlan ? 'Planification mise à jour' : 'Planification créée', true)
    } catch (e) {
      showToast(`Erreur : ${e}`, false)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette planification ?')) return
    await fetch(`/api/scheduler/plans/${id}`, { method: 'DELETE' })
    load(); showToast('Planification supprimée', true)
  }

  const handleToggle = async (p: Plan) => {
    await fetch(`/api/scheduler/plans/${p.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !p.actif }),
    })
    load()
  }

  const handleTest = async (id: number) => {
    setTesting(id)
    try {
      const r = await fetch(`/api/scheduler/test/${id}`, { method: 'POST' })
      const d = await r.json()
      if (d.success) showToast(`Email test envoyé à ${d.to?.join(', ')}`, true)
      else           showToast(`Échec : ${d.error}`, false)
      load()
    } catch (e) { showToast(`Erreur : ${e}`, false) }
    finally { setTesting(null) }
  }

  const actifCount = plans.filter(p => p.actif).length

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* ── Stats bar ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total planifications', value: plans.length,  color: '#1F3B72',  bg: 'rgba(31,59,114,.07)'  },
          { label: 'Actives',              value: actifCount,    color: '#96C11E',  bg: 'rgba(150,193,30,.10)'  },
          { label: 'Inactives',            value: plans.length - actifCount, color: '#6b7280', bg: 'rgba(107,114,128,.08)' },
          { label: 'Erreurs',              value: plans.filter(p => p.dernier_statut === 'error').length, color: '#DC2626', bg: 'rgba(220,38,38,.07)' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: 12, padding: '12px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100,
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 10, color: 'rgba(31,59,114,.45)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 3 }}>{s.label}</span>
          </div>
        ))}

        <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #1F3B72, #2B50A0)',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(31,59,114,.25)', fontFamily: "'Nunito', sans-serif",
          }}>
            <Plus size={15} /> Nouvelle planification
          </button>
        </div>
      </div>


      {/* ── Liste ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(31,59,114,.35)', fontSize: 13 }}>
          Chargement…
        </div>
      ) : plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'rgba(31,59,114,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={28} style={{ color: 'rgba(31,59,114,.2)' }} />
          </div>
          <p style={{ color: 'rgba(31,59,114,.4)', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
            Aucune planification configurée
          </p>
          <p style={{ color: 'rgba(31,59,114,.3)', fontSize: 12, margin: '0 0 20px' }}>
            Créez votre première planification pour automatiser vos envois
          </p>
          <button onClick={openCreate} style={{
            background: '#1F3B72', color: '#fff', border: 'none', borderRadius: 9,
            padding: '10px 24px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
          }}>
            Créer la première planification
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.map(plan => (
            <div key={plan.id} style={{
              background: '#fff', borderRadius: 14, padding: '18px 20px',
              boxShadow: plan.actif ? '0 2px 10px rgba(31,59,114,.10)' : '0 1px 4px rgba(31,59,114,.05)',
              opacity: plan.actif ? 1 : .55,
              transition: 'all .2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>

                {/* Icône statut */}
                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: plan.dernier_statut === 'error' ? 'rgba(220,38,38,.08)'
                    : plan.dernier_statut === 'ok' ? 'rgba(150,193,30,.10)'
                    : 'rgba(31,59,114,.06)',
                }}>
                  {plan.dernier_statut === 'error'
                    ? <AlertCircle  size={18} style={{ color: '#DC2626' }} />
                    : plan.dernier_statut === 'ok'
                    ? <CheckCircle2 size={18} style={{ color: '#96C11E' }} />
                    : <Mail         size={18} style={{ color: 'rgba(31,59,114,.35)' }} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1F3B72' }}>{plan.name}</span>
                    <span style={{
                      background: `${FREQ_COLOR[plan.frequence] ?? '#6b7280'}18`,
                      color: FREQ_COLOR[plan.frequence] ?? '#6b7280',
                      borderRadius: 6, padding: '2px 9px', fontSize: 10, fontWeight: 700,
                    }}>
                      {FREQUENCES.find(f => f.id === plan.frequence)?.label ?? plan.frequence}
                    </span>
                    <span style={{
                      background: 'rgba(31,59,114,.06)', color: 'rgba(31,59,114,.6)',
                      borderRadius: 6, padding: '2px 9px', fontSize: 10, fontWeight: 600,
                    }}>
                      {RAPPORTS.find(r => r.id === plan.rapport_id)?.label ?? plan.rapport_id}
                    </span>
                    <span style={{
                      background: 'rgba(8,145,178,.08)', color: '#0891B2',
                      borderRadius: 6, padding: '2px 9px', fontSize: 10, fontWeight: 700,
                    }}>
                      {plan.format.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {plan.destinataires.map(d => (
                      <span key={d} style={{
                        background: 'rgba(31,59,114,.05)', borderRadius: 20,
                        padding: '2px 10px', fontSize: 10, color: 'rgba(31,59,114,.55)', fontWeight: 500,
                      }}>{d}</span>
                    ))}
                  </div>

                  <div style={{ marginTop: 7, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {Object.entries(plan.filtres).length > 0 && (
                      <span style={{ fontSize: 10, color: 'rgba(31,59,114,.38)' }}>
                        Filtres : {Object.entries(plan.filtres).map(([k,v]) => `${k}=${v}`).join(' · ')}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'rgba(31,59,114,.32)' }}>
                      Dernier envoi : {fmtDate(plan.derniere_exec)}
                      {plan.dernier_statut === 'error' && (
                        <span style={{ color: '#DC2626', marginLeft: 4 }}>⚠ Erreur</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleToggle(plan)}
                    title={plan.actif ? 'Désactiver' : 'Activer'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                      borderRadius: 8, display: 'flex', alignItems: 'center',
                      color: plan.actif ? '#96C11E' : 'rgba(31,59,114,.28)',
                    }}>
                    {plan.actif ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>

                  <button onClick={() => handleTest(plan.id)}
                    disabled={testing === plan.id}
                    title="Envoyer maintenant (test)"
                    style={{
                      background: testing === plan.id ? 'rgba(31,59,114,.05)' : 'rgba(150,193,30,.1)',
                      border: '1px solid rgba(150,193,30,.2)',
                      borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 700, color: '#5a7a10',
                      fontFamily: "'Nunito', sans-serif",
                    }}>
                    <Play size={11} />
                    {testing === plan.id ? 'Envoi…' : 'Tester'}
                  </button>

                  <button onClick={() => openEdit(plan)} title="Modifier"
                    style={{
                      background: 'rgba(31,59,114,.05)', border: 'none', borderRadius: 8,
                      padding: '8px 10px', cursor: 'pointer', color: 'rgba(31,59,114,.5)',
                      display: 'flex', alignItems: 'center',
                    }}>
                    <Pencil size={13} />
                  </button>

                  <button onClick={() => handleDelete(plan.id)} title="Supprimer"
                    style={{
                      background: 'rgba(220,38,38,.05)', border: 'none', borderRadius: 8,
                      padding: '8px 10px', cursor: 'pointer', color: '#DC2626',
                      display: 'flex', alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,38,38,.05)')}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════ MODAL ══════════ */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,18,36,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>

          <div style={{
            background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560,
            maxHeight: '92vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(10,18,36,.28)',
          }}>
            {/* Header */}
            <div style={{
              padding: '22px 26px', borderBottom: '1px solid rgba(31,59,114,.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(135deg, #f8fafc, #fff)',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1F3B72' }}>
                  {editPlan ? 'Modifier la planification' : 'Nouvelle planification'}
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(31,59,114,.4)' }}>
                  {editPlan ? 'Modifiez les paramètres de votre rapport automatique' : 'Configurez votre rapport automatique par email'}
                </p>
              </div>
              <button onClick={() => setModal(false)}
                style={{
                  background: 'rgba(31,59,114,.06)', border: 'none', borderRadius: 8,
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'rgba(31,59,114,.45)', cursor: 'pointer', lineHeight: 1,
                }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              <Field label="Nom de la planification *">
                <input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex : Rapport mensuel recouvrement DAKAR"
                  style={inputStyle} />
              </Field>

              <Field label="Rapport *">
                <select value={form.rapport_id}
                  onChange={e => setForm(f => ({ ...f, rapport_id: e.target.value }))}
                  style={inputStyle}>
                  {RAPPORTS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </Field>

              {form.rapport_id === 'rh' && (
                <Field label="Indicateurs à inclure *">
                  <IndicateursSelector
                    liste={RH_INDICATEURS} selected={form.rh_indicateurs}
                    allIds={RH_ALL} onChange={ids => setForm(f => ({ ...f, rh_indicateurs: ids }))} />
                </Field>
              )}
              {form.rapport_id === 'facturation' && (
                <Field label="Indicateurs à inclure *">
                  <IndicateursSelector
                    liste={FACT_INDICATEURS} selected={form.fact_indicateurs}
                    allIds={FACT_ALL} onChange={ids => setForm(f => ({ ...f, fact_indicateurs: ids }))} />
                </Field>
              )}
              {form.rapport_id === 'recouvrement' && (
                <Field label="Indicateurs à inclure *">
                  <IndicateursSelector
                    liste={RECOUV_INDICATEURS} selected={form.recouv_indicateurs}
                    allIds={RECOUV_ALL} onChange={ids => setForm(f => ({ ...f, recouv_indicateurs: ids }))} />
                </Field>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Année (optionnel)">
                  <input value={form.annee}
                    onChange={e => setForm(f => ({ ...f, annee: e.target.value }))}
                    placeholder="Ex : 2025" style={inputStyle} />
                </Field>
                <Field label="Direction (DR) (optionnel)">
                  <input value={form.dr}
                    onChange={e => setForm(f => ({ ...f, dr: e.target.value }))}
                    placeholder="Ex : DR DAKAR" style={inputStyle} />
                </Field>
              </div>

              {(form.rapport_id === 'facturation' || form.rapport_id === 'recouvrement') && groupesDispo.length > 0 && (
                <Field label="Groupe(s) de facturation (optionnel)">
                  <GroupesFacturationSelector
                    groupes={groupesDispo} selected={form.groupes_fact ?? []}
                    onChange={ids => setForm(f => ({ ...f, groupes_fact: ids }))} />
                </Field>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Format">
                  <select value={form.format}
                    onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                    style={inputStyle}>
                    <option value="xlsx">Excel (.xlsx)</option>
                    <option value="pdf">PDF (rapport complet)</option>
                    <option value="html">HTML (email)</option>
                  </select>
                </Field>
                <Field label="Fréquence">
                  <select value={form.frequence}
                    onChange={e => setForm(f => ({ ...f, frequence: e.target.value }))}
                    style={inputStyle}>
                    {FREQUENCES.map(f => (
                      <option key={f.id} value={f.id}>{f.label} — {f.detail}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Destinataires * (séparés par des virgules)">
                <input value={form.destinataires_txt}
                  onChange={e => setForm(f => ({ ...f, destinataires_txt: e.target.value }))}
                  placeholder="dg@seneau.sn, daf@seneau.sn"
                  style={inputStyle} />
              </Field>

              <Field label="Objet de l'email">
                <input value={form.sujet}
                  onChange={e => setForm(f => ({ ...f, sujet: e.target.value }))}
                  placeholder="Ex : Rapport mensuel recouvrement — {date}"
                  style={inputStyle} />
                <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginTop: 4, display: 'block' }}>
                  Variables : {'{date}'} = date d'envoi · {'{annee}'} = année filtrée
                </span>
              </Field>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: form.actif ? '#96C11E' : 'rgba(31,59,114,.28)' }}>
                  {form.actif ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
                <span style={{ fontSize: 12, fontWeight: 600,
                  color: form.actif ? '#96C11E' : 'rgba(31,59,114,.4)' }}>
                  {form.actif ? 'Planification active' : 'Planification inactive'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 26px', borderTop: '1px solid rgba(31,59,114,.07)',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              background: '#fafbfc', borderRadius: '0 0 18px 18px',
            }}>
              <button onClick={() => setModal(false)}
                style={{
                  padding: '9px 22px', borderRadius: 9,
                  border: '1px solid rgba(31,59,114,.15)', background: '#fff',
                  fontSize: 13, fontWeight: 600, color: 'rgba(31,59,114,.5)',
                  cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
                }}>
                Annuler
              </button>
              <button onClick={handleSubmit}
                disabled={saving || !form.name || !form.destinataires_txt}
                style={{
                  padding: '9px 26px', borderRadius: 9, border: 'none',
                  background: (!form.name || !form.destinataires_txt) ? 'rgba(31,59,114,.18)' : 'linear-gradient(135deg, #1F3B72, #2B50A0)',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: (!form.name || !form.destinataires_txt) ? 'not-allowed' : 'pointer',
                  fontFamily: "'Nunito', sans-serif",
                  boxShadow: (!form.name || !form.destinataires_txt) ? 'none' : '0 4px 12px rgba(31,59,114,.25)',
                }}>
                {saving ? 'Enregistrement…' : editPlan ? 'Mettre à jour' : 'Créer la planification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TOAST ══════════ */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
          background: toast.ok ? '#96C11E' : '#DC2626', color: '#fff',
          borderRadius: 12, padding: '13px 22px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 28px rgba(0,0,0,.22)',
          display: 'flex', alignItems: 'center', gap: 9,
          animation: 'fadeIn .2s ease',
        }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ─── Sous-composants ────────────────────────────────────────────────────── */
function IndicateursSelector({ liste, selected = [], onChange, allIds }: {
  liste: { id: string; label: string; desc: string }[]
  selected?: string[]
  onChange: (ids: string[]) => void
  allIds: string[]
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button type="button"
          onClick={() => onChange(selected.length === allIds.length ? [] : allIds)}
          style={{ fontSize: 10, fontWeight: 700, background: 'none', border: 'none',
            cursor: 'pointer', color: '#1F3B72', padding: 0, opacity: .6 }}>
          {selected.length === allIds.length ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {liste.map(ind => {
          const checked = selected.includes(ind.id)
          return (
            <label key={ind.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              padding: '8px 12px', borderRadius: 8, border: '1px solid',
              borderColor: checked ? 'rgba(150,193,30,.35)' : 'rgba(31,59,114,.1)',
              background: checked ? 'rgba(150,193,30,.05)' : '#fafbfc', transition: 'all .15s',
            }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(ind.id)}
                style={{ marginTop: 2, accentColor: '#96C11E', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700,
                  color: checked ? '#1F3B72' : 'rgba(31,59,114,.5)' }}>{ind.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(31,59,114,.4)', marginTop: 1 }}>{ind.desc}</div>
              </div>
            </label>
          )
        })}
      </div>
      {selected.length === 0 && (
        <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 4 }}>
          Sélectionnez au moins un indicateur.
        </div>
      )}
    </div>
  )
}

function GroupesFacturationSelector({ groupes, selected, onChange }: {
  groupes: string[]; selected: string[]; onChange: (ids: string[]) => void
}) {
  const toggle = (g: string) =>
    onChange(selected.includes(g) ? selected.filter(x => x !== g) : [...selected, g])
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'rgba(31,59,114,.4)' }}>
          {selected.length === 0 ? 'Tous les groupes inclus' : `${selected.length} groupe(s) sélectionné(s)`}
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])}
            style={{ fontSize: 10, fontWeight: 700, background: 'none', border: 'none',
              cursor: 'pointer', color: '#DC2626', padding: 0 }}>
            Réinitialiser
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {groupes.map(g => {
          const checked = selected.includes(g)
          return (
            <label key={g} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '7px 12px', borderRadius: 8, border: '1px solid',
              borderColor: checked ? 'rgba(31,59,114,.3)' : 'rgba(31,59,114,.1)',
              background: checked ? 'rgba(31,59,114,.05)' : '#fafbfc', transition: 'all .15s',
            }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(g)}
                style={{ accentColor: '#1F3B72', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: checked ? 700 : 500,
                color: checked ? '#1F3B72' : 'rgba(31,59,114,.5)' }}>{g}</span>
            </label>
          )
        })}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 10, color: 'rgba(31,59,114,.35)', lineHeight: 1.5 }}>
        Aucune sélection = tous les groupes.
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(31,59,114,.55)',
        letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid rgba(31,59,114,.16)', color: '#1F3B72',
  background: '#fff', outline: 'none', width: '100%',
  boxSizing: 'border-box', fontFamily: "'Nunito', sans-serif",
}
