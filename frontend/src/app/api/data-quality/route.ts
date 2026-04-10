/**
 * GET /api/data-quality
 * Calcule le Data Quality Score par source et par dimension.
 *
 * Sources couvertes :
 *   - RH          → sen_dwh  (dwh_rh.dim_personnel, dtm_drht_collaborateur)
 *   - Facturation → sen_ods  (public.mv_recouvrement)
 *
 * 6 dimensions : Complétude, Exactitude, Cohérence, Fraîcheur, Unicité, Conformité
 * Cache TTL 1h
 */
import { NextResponse } from 'next/server'
import poolDwh from '@/lib/dbDwh'
import poolOds from '@/lib/dbOds'
import { withCache, TTL_1H } from '@/lib/serverCache'
import { saveSnapshot } from '@/lib/dqHistory'

/* ─── Types ────────────────────────────────────────────────────────────────── */

export type DqDimension = 'completude' | 'exactitude' | 'coherence' | 'fraicheur' | 'unicite' | 'conformite'

export interface DqRule {
  id:        string
  label:     string
  source:    string
  dimension: DqDimension
  score:     number     // 0-100
  nb_total:  number
  nb_ok:     number
  nb_ko:     number
}

export interface DqSource {
  id:         string
  label:      string
  schema:     string
  score:      number
  nb_rules:   number
  nb_ok:      number   // rules with score >= 90
}

export interface DqResponse {
  score_global:  number
  last_run:      string   // ISO timestamp
  sources:       DqSource[]
  dimensions:    { id: DqDimension; label: string; score: number; weight: number }[]
  rules:         DqRule[]
  _errors:       string[]
}

/* ─── Poids des dimensions ──────────────────────────────────────────────────── */
const WEIGHTS: Record<DqDimension, number> = {
  completude:  0.30,
  exactitude:  0.25,
  coherence:   0.20,
  fraicheur:   0.15,
  unicite:     0.07,
  conformite:  0.03,
}

const DIM_LABELS: Record<DqDimension, string> = {
  completude:  'Complétude',
  exactitude:  'Exactitude',
  coherence:   'Cohérence',
  fraicheur:   'Fraîcheur',
  unicite:     'Unicité',
  conformite:  'Conformité',
}

/* ─── Helper safe query ─────────────────────────────────────────────────────── */
async function safeQ(
  client: import('pg').PoolClient,
  sql: string,
): Promise<Record<string, unknown>> {
  try {
    const r = await client.query(sql)
    return r.rows[0] ?? {}
  } catch (e) {
    return { _err: e instanceof Error ? e.message : String(e) }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RÈGLES RH  (sen_dwh)
════════════════════════════════════════════════════════════════════════════ */
async function runRhRules(errors: string[]): Promise<DqRule[]> {
  const rules: DqRule[] = []
  const client = await poolDwh.connect()
  try {
    /* ── base count (actifs) ── */
    const base = await safeQ(client, `
      SELECT COUNT(*)::int AS n FROM dwh_rh.dim_personnel
      WHERE date_sortie = '1999-12-31'
    `)
    const N = (base.n as number) || 1

    /* ── Complétude ── */
    const cFields: { id: string; label: string; col: string }[] = [
      { id: 'rh_sexe',         label: 'Sexe renseigné',          col: 'sexe' },
      { id: 'rh_date_emb',     label: 'Date embauche renseignée', col: 'date_embauche' },
      { id: 'rh_code_eta',     label: 'Code établissement',       col: 'code_eta' },
      { id: 'rh_categorie',    label: 'Catégorie renseignée',     col: 'categorie' },
      { id: 'rh_type_contrat', label: 'Type contrat renseigné',   col: 'type_contrat' },
    ]
    for (const f of cFields) {
      const r = await safeQ(client, `
        SELECT COUNT(*) FILTER (WHERE ${f.col} IS NOT NULL AND ${f.col}::text <> '')::int AS nb_ok
        FROM dwh_rh.dim_personnel WHERE date_sortie = '1999-12-31'
      `)
      if (r._err) { errors.push(`RH complétude ${f.id}: ${r._err}`); continue }
      const nb_ok = (r.nb_ok as number) ?? 0
      rules.push({ id: f.id, label: f.label, source: 'RH', dimension: 'completude',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

    /* ── Exactitude ── */
    const ex1 = await safeQ(client, `
      SELECT COUNT(*) FILTER (
        WHERE date_embauche IS NOT NULL
          AND date_embauche > '1960-01-01'
          AND date_embauche <= CURRENT_DATE
      )::int AS nb_ok
      FROM dwh_rh.dim_personnel WHERE date_sortie = '1999-12-31'
    `)
    if (!ex1._err) {
      const nb_ok = (ex1.nb_ok as number) ?? 0
      rules.push({ id: 'rh_date_emb_range', label: 'Date embauche plausible (1960–auj.)',
        source: 'RH', dimension: 'exactitude',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

    const ex2 = await safeQ(client, `
      SELECT COUNT(*) FILTER (WHERE sexe IN ('MASCULIN', 'FEMININ'))::int AS nb_ok
      FROM dwh_rh.dim_personnel WHERE date_sortie = '1999-12-31' AND sexe IS NOT NULL
    `)
    if (!ex2._err) {
      const nb_ok = (ex2.nb_ok as number) ?? 0
      rules.push({ id: 'rh_sexe_valeur', label: "Valeur sexe valide (MASCULIN/FEMININ)",
        source: 'RH', dimension: 'exactitude',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

    /* ── Unicité ── */
    const u1 = await safeQ(client, `
      SELECT COUNT(*)::int AS total,
             COUNT(DISTINCT matricule)::int AS uniques
      FROM dwh_rh.dim_personnel WHERE date_sortie = '1999-12-31'
    `)
    if (!u1._err) {
      const total   = (u1.total   as number) ?? 0
      const uniques = (u1.uniques as number) ?? 0
      rules.push({ id: 'rh_matricule_unique', label: 'Matricule unique (actifs)',
        source: 'RH', dimension: 'unicite',
        score: total > 0 ? Math.round(uniques / total * 100) : 100,
        nb_total: total, nb_ok: uniques, nb_ko: total - uniques })
    }

    /* ── Conformité ── */
    const co1 = await safeQ(client, `
      SELECT COUNT(*) FILTER (
        WHERE type_contrat IN ('DI','DD','JR','ST','CO') OR type_contrat LIKE '%DI' OR type_contrat LIKE '%DD'
      )::int AS nb_ok
      FROM dwh_rh.dim_personnel WHERE date_sortie = '1999-12-31' AND type_contrat IS NOT NULL
    `)
    if (!co1._err) {
      const nb_ok = (co1.nb_ok as number) ?? 0
      rules.push({ id: 'rh_type_contrat_valeur', label: 'Type contrat dans nomenclature',
        source: 'RH', dimension: 'conformite',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

    /* ── Fraîcheur ── */
    const f1 = await safeQ(client, `
      SELECT MAX(date_embauche) AS last_date FROM dwh_rh.dim_personnel WHERE date_sortie = '1999-12-31'
    `)
    if (!f1._err && f1.last_date) {
      const lastDate = new Date(f1.last_date as string)
      const ageJours = Math.floor((Date.now() - lastDate.getTime()) / 86400000)
      // Score: 100 si <30j, 80 si <90j, 60 si <180j, 40 si <365j, 20 sinon
      const score = ageJours < 30 ? 100 : ageJours < 90 ? 80 : ageJours < 180 ? 60 : ageJours < 365 ? 40 : 20
      rules.push({ id: 'rh_fraicheur', label: `Fraîcheur données (dernière entrée il y a ${ageJours}j)`,
        source: 'RH', dimension: 'fraicheur',
        score, nb_total: 1, nb_ok: score >= 80 ? 1 : 0, nb_ko: score >= 80 ? 0 : 1 })
    }

    /* ── Cohérence RH (date_sortie cohérente) ── */
    const ch1 = await safeQ(client, `
      SELECT COUNT(*)::int AS nb_ok
      FROM dwh_rh.dim_personnel
      WHERE date_sortie = '1999-12-31'
        AND date_embauche IS NOT NULL
        AND date_embauche < CURRENT_DATE
    `)
    if (!ch1._err) {
      const nb_ok = (ch1.nb_ok as number) ?? 0
      rules.push({ id: 'rh_coher_dates', label: 'Date embauche antérieure à aujourd\'hui',
        source: 'RH', dimension: 'coherence',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

  } catch (e) {
    errors.push(`RH global: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    client.release()
  }
  return rules
}

/* ═══════════════════════════════════════════════════════════════════════════
   RÈGLES FACTURATION  (sen_ods)
════════════════════════════════════════════════════════════════════════════ */
async function runFactRules(errors: string[]): Promise<DqRule[]> {
  const rules: DqRule[] = []
  const client = await poolOds.connect()
  try {
    const base = await safeQ(client, `SELECT COUNT(*)::int AS n FROM public.mv_recouvrement`)
    const N = (base.n as number) || 1

    /* ── Complétude ── */
    const fc: { id: string; label: string; col: string }[] = [
      { id: 'fact_client',  label: 'Code client renseigné',      col: '"CODE_CLIENT"' },
      { id: 'fact_montant', label: 'Montant facturé renseigné',  col: '"MONTANT_FACTURE"' },
      { id: 'fact_periode', label: 'Période facturation renseignée', col: '"PERIODE_FACTURATION"' },
      { id: 'fact_dt',      label: 'Direction territoriale renseignée', col: '"DIRECTION_TERRITORIALE"' },
    ]
    for (const f of fc) {
      const r = await safeQ(client, `
        SELECT COUNT(*) FILTER (WHERE ${f.col} IS NOT NULL AND ${f.col}::text <> '')::int AS nb_ok
        FROM public.mv_recouvrement
      `)
      if (r._err) { errors.push(`Fact complétude ${f.id}: ${r._err}`); continue }
      const nb_ok = (r.nb_ok as number) ?? 0
      rules.push({ id: f.id, label: f.label, source: 'Facturation', dimension: 'completude',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

    /* ── Exactitude : montants négatifs ── */
    const ex1 = await safeQ(client, `
      SELECT COUNT(*) FILTER (WHERE "MONTANT_FACTURE" >= 0)::int AS nb_ok
      FROM public.mv_recouvrement WHERE "MONTANT_FACTURE" IS NOT NULL
    `)
    if (!ex1._err) {
      const nb_ok = (ex1.nb_ok as number) ?? 0
      rules.push({ id: 'fact_montant_pos', label: 'Montant facturé non négatif',
        source: 'Facturation', dimension: 'exactitude',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

    /* ── Conformité : format période ── */
    const cf1 = await safeQ(client, `
      SELECT COUNT(*) FILTER (
        WHERE "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
      )::int AS nb_ok
      FROM public.mv_recouvrement WHERE "PERIODE_FACTURATION" IS NOT NULL
    `)
    if (!cf1._err) {
      const nb_ok = (cf1.nb_ok as number) ?? 0
      rules.push({ id: 'fact_periode_fmt', label: 'Format période valide (MM/AAAA)',
        source: 'Facturation', dimension: 'conformite',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

    /* ── Unicité : doublons (client + période) ── */
    const u1 = await safeQ(client, `
      SELECT COUNT(*)::int AS total,
             COUNT(DISTINCT ("CODE_CLIENT" || "PERIODE_FACTURATION"))::int AS uniques
      FROM public.mv_recouvrement
    `)
    if (!u1._err) {
      const total   = (u1.total   as number) ?? 0
      const uniques = (u1.uniques as number) ?? 0
      rules.push({ id: 'fact_unicite', label: 'Unicité (client + période)',
        source: 'Facturation', dimension: 'unicite',
        score: total > 0 ? Math.round(uniques / total * 100) : 100,
        nb_total: total, nb_ok: uniques, nb_ko: total - uniques })
    }

    /* ── Fraîcheur ── */
    const f1 = await safeQ(client, `
      SELECT MAX(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int)) AS last_annee,
             MAX(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)) AS last_mois
      FROM public.mv_recouvrement
      WHERE "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
    `)
    if (!f1._err && f1.last_annee) {
      const lastDate  = new Date(Number(f1.last_annee), Number(f1.last_mois) - 1, 1)
      const ageJours  = Math.floor((Date.now() - lastDate.getTime()) / 86400000)
      const score = ageJours < 45 ? 100 : ageJours < 90 ? 75 : ageJours < 180 ? 50 : 25
      rules.push({ id: 'fact_fraicheur', label: `Fraîcheur données (dernière période : ${f1.last_mois}/${f1.last_annee})`,
        source: 'Facturation', dimension: 'fraicheur',
        score, nb_total: 1, nb_ok: score >= 75 ? 1 : 0, nb_ko: score >= 75 ? 0 : 1 })
    }

    /* ── Cohérence : taux de recouvrement vraisemblable (0-150%) ── */
    const ch1 = await safeQ(client, `
      SELECT COUNT(*) FILTER (
        WHERE "MONTANT_FACTURE" > 0 AND "MONTANT_REGLE" / NULLIF("MONTANT_FACTURE",0) BETWEEN 0 AND 1.5
      )::int AS nb_ok
      FROM public.mv_recouvrement
      WHERE "MONTANT_FACTURE" IS NOT NULL AND "MONTANT_REGLE" IS NOT NULL
    `)
    if (!ch1._err) {
      const nb_ok = (ch1.nb_ok as number) ?? 0
      rules.push({ id: 'fact_taux_recouv', label: 'Taux recouvrement vraisemblable (0–150%)',
        source: 'Facturation', dimension: 'coherence',
        score: Math.round(nb_ok / N * 100), nb_total: N, nb_ok, nb_ko: N - nb_ok })
    }

  } catch (e) {
    errors.push(`Facturation global: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    client.release()
  }
  return rules
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGRÉGATION
════════════════════════════════════════════════════════════════════════════ */
function aggregate(rules: DqRule[]): DqResponse {
  /* Score par dimension */
  const dimScores: Record<DqDimension, number[]> = {
    completude: [], exactitude: [], coherence: [],
    fraicheur: [], unicite: [], conformite: [],
  }
  for (const r of rules) dimScores[r.dimension].push(r.score)
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : 100

  const dimensions = (Object.keys(WEIGHTS) as DqDimension[]).map(id => ({
    id,
    label:  DIM_LABELS[id],
    score:  avg(dimScores[id]),
    weight: WEIGHTS[id],
  }))

  /* Score global pondéré */
  const score_global = Math.round(
    dimensions.reduce((acc, d) => acc + d.score * d.weight, 0) * 10
  ) / 10

  /* Par source */
  const srcIds = Array.from(new Set(rules.map(r => r.source)))
  const sources: DqSource[] = srcIds.map(id => {
    const sRules = rules.filter(r => r.source === id)
    const schema = id === 'RH' ? 'dwh_rh.dim_personnel' : 'public.mv_recouvrement'
    const score  = avg(sRules.map(r => r.score))
    return {
      id, label: id, schema, score,
      nb_rules: sRules.length,
      nb_ok:    sRules.filter(r => r.score >= 90).length,
    }
  })

  return {
    score_global,
    last_run: new Date().toISOString(),
    sources,
    dimensions,
    rules,
    _errors: [],
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HANDLER
════════════════════════════════════════════════════════════════════════════ */
export async function GET() {
  try {
    const data = await withCache('data_quality:v1', async () => {
      const errors: string[] = []
      const [rhRules, factRules] = await Promise.all([
        runRhRules(errors).catch(e => { errors.push(String(e)); return [] as DqRule[] }),
        runFactRules(errors).catch(e => { errors.push(String(e)); return [] as DqRule[] }),
      ])
      const result = aggregate([...rhRules, ...factRules])
      result._errors = errors

      // Persiste le snapshot (fire-and-forget)
      const dimMap = Object.fromEntries(result.dimensions.map(d => [d.id, d.score]))
      saveSnapshot({
        score_global: result.score_global,
        completude:   dimMap.completude   ?? 0,
        exactitude:   dimMap.exactitude   ?? 0,
        coherence:    dimMap.coherence    ?? 0,
        fraicheur:    dimMap.fraicheur    ?? 0,
        unicite:      dimMap.unicite      ?? 0,
        conformite:   dimMap.conformite   ?? 0,
      })

      return result
    }, TTL_1H)

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { score_global: 0, last_run: new Date().toISOString(), sources: [], dimensions: [], rules: [], _errors: [String(err)] },
      { status: 500 }
    )
  }
}
