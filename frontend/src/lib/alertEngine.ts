/**
 * Moteur de détection des alertes — 7 règles sur données réelles
 *
 * Règles :
 *  1. taux_recouv_dr_critical  — taux recouvrement DR < 40%
 *  2. taux_recouv_dr_warning   — taux recouvrement DR < 95%
 *  3. impaye_global_warning    — taux impayés global > 10%
 *  4. impaye_global_critical   — taux impayés global > 20%
 *  5. rh_hs_warning            — taux heures supp > 2.5% de la masse
 *  6. dq_warning               — score data quality < 80
 *  7. dq_critical              — score data quality < 60
 *
 * Appelé par POST /api/alerts/run (déclenché par le scheduler quotidien)
 */
import { upsertAlert, purgeOldAlerts } from '@/lib/alertsDb'

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return null
    return await r.json() as T
  } catch {
    return null
  }
}

/* ── Types minimaux des APIs ──────────────────────────────────────────────── */
interface FactKpi {
  taux_recouvrement: number
  taux_impaye:       number
  par_dr:                 { dr: string; taux_recouvrement: number; taux_impaye: number }[]
  par_groupe_facturation: { groupe: string; taux_recouvrement: number; ca_total: number }[]
}
interface RhKpi { taux_hs: number; masse_salariale: number; montant_hs: number }
interface DqResponse { score_global: number }

/* ══════════════════════════════════════════════════════════════════════════
   RÈGLES
══════════════════════════════════════════════════════════════════════════ */

async function ruleFacturation(annee: number) {
  const fact = await safeFetch<FactKpi>(`${BASE}/api/facturation/kpis?annee=${annee}`)
  if (!fact) return

  /* Règles groupes prioritaires — Clients Privés & Gros Consommateurs */
  const GROUPES_PRIORITAIRES = ['Clients Privés', 'Gros Consommateurs']
  for (const grp of (fact.par_groupe_facturation ?? [])) {
    if (!GROUPES_PRIORITAIRES.includes(grp.groupe)) continue
    const t = grp.taux_recouvrement
    if (t < 40) {
      await upsertAlert({
        rule_id:   `taux_recouv_groupe_critical_${grp.groupe.replace(/\s+/g, '_')}`,
        severity:  'critical',
        title:     `Recouvrement critique — ${grp.groupe}`,
        message:   `Le taux de recouvrement du groupe "${grp.groupe}" est à ${t.toFixed(1)} %, très en dessous de l'objectif de 98,5 % (seuil critique : 40 %). CA concerné : ${(grp.ca_total / 1_000_000).toFixed(1)} M FCFA.`,
        dr:        null,
        value:     t,
        threshold: 40,
        report_id: 'recouvrement-dt',
      })
    } else if (t < 95) {
      await upsertAlert({
        rule_id:   `taux_recouv_groupe_warning_${grp.groupe.replace(/\s+/g, '_')}`,
        severity:  'warning',
        title:     `Recouvrement faible — ${grp.groupe}`,
        message:   `Le taux de recouvrement du groupe "${grp.groupe}" est à ${t.toFixed(1)} %, sous le seuil d'alerte de 95 %. Objectif : 98,5 %. CA concerné : ${(grp.ca_total / 1_000_000).toFixed(1)} M FCFA.`,
        dr:        null,
        value:     t,
        threshold: 95,
        report_id: 'recouvrement-dt',
      })
    }
  }

  /* Règle 3 & 4 — impayés global */
  if (fact.taux_impaye >= 20) {
    await upsertAlert({
      rule_id:   'impaye_global_critical',
      severity:  'critical',
      title:     `Taux d'impayés critique — ${fact.taux_impaye.toFixed(1)} %`,
      message:   `Le taux d'impayés global a atteint ${fact.taux_impaye.toFixed(1)} % sur l'exercice ${annee}, bien au-dessus du seuil d'alerte (20 %). Une action urgente est requise.`,
      dr:        null,
      value:     fact.taux_impaye,
      threshold: 20,
      report_id: 'recouvrement-dt',
    })
  } else if (fact.taux_impaye >= 10) {
    await upsertAlert({
      rule_id:   'impaye_global_warning',
      severity:  'warning',
      title:     `Taux d'impayés en hausse — ${fact.taux_impaye.toFixed(1)} %`,
      message:   `Le taux d'impayés global est à ${fact.taux_impaye.toFixed(1)} % sur l'exercice ${annee} (seuil : 10 %). Surveillance recommandée.`,
      dr:        null,
      value:     fact.taux_impaye,
      threshold: 10,
      report_id: 'recouvrement-dt',
    })
  }

  /* Règles 1 & 2 — taux recouvrement par DR */
  for (const dr of (fact.par_dr ?? [])) {
    const t   = dr.taux_recouvrement
    const nom = dr.dr

    if (t < 40) {
      await upsertAlert({
        rule_id:   'taux_recouv_dr_critical',
        severity:  'critical',
        title:     `Recouvrement critique — ${nom}`,
        message:   `Le taux de recouvrement de ${nom} est à ${t.toFixed(1)} %, très en dessous de l'objectif de 98,5 % et du seuil d'urgence de 40 %. Action immédiate requise.`,
        dr:        nom,
        value:     t,
        threshold: 40,
        report_id: 'recouvrement-dt',
      })
    } else if (t < 95) {
      await upsertAlert({
        rule_id:   'taux_recouv_dr_warning',
        severity:  'warning',
        title:     `Recouvrement faible — ${nom}`,
        message:   `Le taux de recouvrement de ${nom} est à ${t.toFixed(1)} %, sous le seuil d'alerte de 95 %. Objectif : 98,5 %.`,
        dr:        nom,
        value:     t,
        threshold: 95,
        report_id: 'recouvrement-dt',
      })
    }
  }
}

async function ruleRH(annee: number) {
  const rh = await safeFetch<RhKpi>(`${BASE}/api/rh/kpis?annee=${annee}`)
  if (!rh) return

  /* Règle 5 — taux heures supplémentaires */
  if (rh.taux_hs >= 2.5) {
    const sev = rh.taux_hs >= 5 ? 'critical' : 'warning'
    await upsertAlert({
      rule_id:   'rh_hs_warning',
      severity:  sev,
      title:     `Heures supplémentaires élevées — ${rh.taux_hs.toFixed(2)} %`,
      message:   `Le montant des heures supplémentaires représente ${rh.taux_hs.toFixed(2)} % de la masse salariale (seuil : 2,5 %). Masse HS : ${(rh.montant_hs / 1_000_000).toFixed(1)} M FCFA.`,
      dr:        null,
      value:     rh.taux_hs,
      threshold: 2.5,
      report_id: 'rh-hs',
    })
  }
}

async function ruleDataQuality() {
  const dq = await safeFetch<DqResponse>(`${BASE}/api/data-quality`)
  if (!dq) return

  const score = dq.score_global
  if (score < 60) {
    await upsertAlert({
      rule_id:   'dq_critical',
      severity:  'critical',
      title:     `Qualité des données critique — score ${score.toFixed(0)} / 100`,
      message:   `Le score global de qualité des données est à ${score.toFixed(0)}/100, en dessous du seuil critique (60). La fiabilité des rapports peut être compromise.`,
      dr:        null,
      value:     score,
      threshold: 60,
      report_id: 'gouvernance',
    })
  } else if (score < 80) {
    await upsertAlert({
      rule_id:   'dq_warning',
      severity:  'warning',
      title:     `Qualité des données dégradée — score ${score.toFixed(0)} / 100`,
      message:   `Le score global de qualité des données est à ${score.toFixed(0)}/100 (seuil recommandé : 80). Des vérifications sont conseillées avant publication des rapports.`,
      dr:        null,
      value:     score,
      threshold: 80,
      report_id: 'gouvernance',
    })
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   POINT D'ENTRÉE
══════════════════════════════════════════════════════════════════════════ */

export async function runAlertEngine(): Promise<{
  checked: string[]
  errors:  string[]
}> {
  const annee   = new Date().getFullYear()
  const checked: string[] = []
  const errors:  string[] = []

  /* Purge préventive */
  try { await purgeOldAlerts() } catch { /* non bloquant */ }

  /* Règles facturation */
  try {
    await ruleFacturation(annee)
    checked.push('facturation')
  } catch (e) {
    errors.push(`facturation: ${e instanceof Error ? e.message : String(e)}`)
  }

  /* Règles RH */
  try {
    await ruleRH(annee)
    checked.push('rh')
  } catch (e) {
    errors.push(`rh: ${e instanceof Error ? e.message : String(e)}`)
  }

  /* Règles Data Quality */
  try {
    await ruleDataQuality()
    checked.push('data-quality')
  } catch (e) {
    errors.push(`data-quality: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { checked, errors }
}
