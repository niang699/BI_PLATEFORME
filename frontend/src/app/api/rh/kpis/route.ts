/**
 * GET /api/rh/kpis?annee=2024&mois=all&eta=all&quali=all&categorie=all
 * KPIs RH + variation N-1 + concentration top 20%
 * Source : sen_dwh · schéma dwh_rh
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbDwh'
import { withCache, TTL_1H } from '@/lib/serverCache'

/* ── helper : exécute une requête, retourne {} si elle échoue ── */
async function safeQ(
  client: import('pg').PoolClient,
  label: string,
  sql: string,
  params: (string | number)[] = [],
): Promise<Record<string, unknown>> {
  try {
    const r = await client.query(sql, params)
    return r.rows[0] ?? {}
  } catch (e) {
    console.error(`[kpis] FAIL:${label}`, e instanceof Error ? e.message : e)
    return {}
  }
}

/* ── Requêtes atomiques ── */
async function queryKpis(
  client: import('pg').PoolClient,
  annee: string | null,
  mois: string | null,
  eta: string | null,
  quali: string | null,
  categorie: string | null,
) {
  /* Effectif */
  const efConds = ["p.date_sortie = '1999-12-31'", "p.type_contrat <> 'JR'"]
  const efP: (string | number)[] = []
  if (annee)    efConds.push(`d.annee <= $${efP.push(parseInt(annee))}`)
  if (eta       && eta       !== 'all') efConds.push(`d.code_eta   = $${efP.push(eta)}`)
  if (quali     && quali     !== 'all') efConds.push(`d.code_quali = $${efP.push(quali)}`)
  if (categorie && categorie !== 'all') efConds.push(`d.categorie  = $${efP.push(categorie)}`)

  const e = await safeQ(client, 'effectif', `
    SELECT
      COUNT(DISTINCT d.matricule)::int AS nb_salaries,
      COUNT(DISTINCT CASE WHEN p.sexe = 'FEMININ'        THEN d.matricule END)::int AS nb_femmes,
      COUNT(DISTINCT CASE WHEN p.type_contrat = 'DI'     THEN d.matricule END)::int AS nb_cdi,
      COUNT(DISTINCT CASE WHEN p.type_contrat = 'DD'     THEN d.matricule END)::int AS nb_cdd
    FROM dwh_rh.dtm_drht_collaborateur d
    JOIN dwh_rh.dim_personnel p ON d.matricule = p.matricule
    WHERE ${efConds.join(' AND ')}
  `, efP)

  /* Ancienneté — séparée, colonne date_embauche peut manquer */
  const anc = await safeQ(client, 'anciennete', `
    SELECT ROUND(
      AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)))::numeric, 1
    )::float8 AS anciennete_moy
    FROM (
      SELECT DISTINCT d.matricule
      FROM dwh_rh.dtm_drht_collaborateur d
      JOIN dwh_rh.dim_personnel p ON d.matricule = p.matricule
      WHERE ${efConds.join(' AND ')}
    ) sub
    JOIN dwh_rh.dim_personnel p ON sub.matricule = p.matricule
  `, efP)

  /* Masse Salariale */
  const mConds = ["LEFT(d.rubrique, 3) = 'A03'"]
  const mP: (string | number)[] = []
  if (annee)    mConds.push(`d.annee = $${mP.push(parseInt(annee))}`)
  if (mois      && mois      !== 'all') mConds.push(`d.mois       = $${mP.push(parseInt(mois))}`)
  if (eta       && eta       !== 'all') mConds.push(`d.code_eta   = $${mP.push(eta)}`)
  if (quali     && quali     !== 'all') mConds.push(`d.code_quali = $${mP.push(quali)}`)
  if (categorie && categorie !== 'all') mConds.push(`d.categorie  = $${mP.push(categorie)}`)

  const m = await safeQ(client, 'masse', `
    SELECT COALESCE(SUM(rev), 0)::float8 AS masse
    FROM (
      SELECT DISTINCT d.matricule, d.annee, d.mois, d.rubrique, d.revenu AS rev
      FROM dwh_rh.dtm_drht_collaborateur d
      WHERE ${mConds.join(' AND ')}
    ) t
  `, mP)

  /* Heures Supplémentaires */
  const hConds: string[] = []
  const hP: (string | number)[] = []
  if (annee)    hConds.push(`d.annee      = $${hP.push(parseInt(annee))}`)
  if (mois      && mois      !== 'all') hConds.push(`d.mois       = $${hP.push(parseInt(mois))}`)
  if (eta       && eta       !== 'all') hConds.push(`d.code_eta   = $${hP.push(eta)}`)
  if (quali     && quali     !== 'all') hConds.push(`d.code_quali = $${hP.push(quali)}`)
  if (categorie && categorie !== 'all') hConds.push(`d.categorie  = $${hP.push(categorie)}`)

  const h = await safeQ(client, 'hs', `
    SELECT
      COALESCE(SUM(hs),  0)::float8 AS nb_heures_sup,
      COALESCE(SUM(mhs), 0)::float8 AS montant_hs
    FROM (
      SELECT DISTINCT d.matricule, d.annee, d.mois, d.heure_sup AS hs, d.heure_sup_mont AS mhs
      FROM dwh_rh.dtm_drht_collaborateur d
      ${hConds.length ? 'WHERE ' + hConds.join(' AND ') : ''}
    ) t
  `, hP)

  /* Formation */
  const fConds = ['d.heure_formation <> 0']
  const fP: (string | number)[] = []
  if (annee)    fConds.push(`d.annee      = $${fP.push(parseInt(annee))}`)
  if (eta       && eta       !== 'all') fConds.push(`d.code_eta   = $${fP.push(eta)}`)
  if (quali     && quali     !== 'all') fConds.push(`d.code_quali = $${fP.push(quali)}`)
  if (categorie && categorie !== 'all') fConds.push(`d.categorie  = $${fP.push(categorie)}`)

  const f = await safeQ(client, 'formation', `
    SELECT
      COALESCE(SUM(d.heure_formation), 0)::float8 AS nb_heures_formation,
      COUNT(DISTINCT d.matricule)::int             AS nb_collaborateurs_formes
    FROM dwh_rh.dtm_drht_collaborateur d
    WHERE ${fConds.join(' AND ')}
  `, fP)

  const nb_sal = (e.nb_salaries as number) ?? 0
  const nb_f   = (e.nb_femmes  as number) ?? 0
  const nb_cdi = (e.nb_cdi     as number) ?? 0
  const nb_cdd = (e.nb_cdd     as number) ?? 0
  const anc_moy = parseFloat(anc.anciennete_moy as string) || 0
  const masse   = parseFloat(m.masse            as string) || 0
  const nb_hs   = parseFloat(h.nb_heures_sup    as string) || 0
  const mhs     = parseFloat(h.montant_hs       as string) || 0
  const nb_hf   = parseFloat(f.nb_heures_formation as string) || 0
  const nb_cf   = (f.nb_collaborateurs_formes as number) ?? 0

  return {
    nb_salaries:              nb_sal,
    nb_femmes:                nb_f,
    taux_feminisation:        nb_sal ? Math.round(nb_f / nb_sal * 1000) / 10 : 0,
    nb_cdi,
    nb_cdd,
    taux_cdi:                 nb_sal ? Math.round(nb_cdi / nb_sal * 1000) / 10 : 0,
    anciennete_moy:           anc_moy,
    masse_salariale:          masse,
    salaire_moyen:            nb_sal ? Math.round(masse / nb_sal) : 0,
    montant_hs:               mhs,
    nb_heures_sup:            nb_hs,
    taux_hs:                  masse ? Math.round(mhs / masse * 10000) / 100 : 0,
    nb_heures_formation:      nb_hf,
    nb_collaborateurs_formes: nb_cf,
    pct_formes:               nb_sal ? Math.round(nb_cf / nb_sal * 1000) / 10 : 0,
  }
}

async function queryConcentration(
  client: import('pg').PoolClient,
  annee: string | null,
  mois: string | null,
  quali: string | null,
  categorie: string | null,
) {
  const conds = ["LEFT(d.rubrique, 3) = 'A03'"]
  const params: (string | number)[] = []
  if (annee) conds.push(`d.annee = $${params.push(parseInt(annee))}`)
  if (mois && mois !== 'all') conds.push(`d.mois = $${params.push(parseInt(mois))}`)
  if (quali && quali !== 'all') conds.push(`d.code_quali = $${params.push(quali)}`)
  if (categorie && categorie !== 'all') conds.push(`d.categorie = $${params.push(categorie)}`)

  try {
    const r = await client.query(`
      SELECT
        COUNT(*)::int                                                           AS nb_total,
        COALESCE(SUM(revenu), 0)::float8                                        AS masse_totale,
        CEIL(COUNT(*) * 0.2)::int                                               AS nb_top20,
        COALESCE(SUM(CASE WHEN rk <= CEIL(cnt * 0.2) THEN revenu ELSE 0 END), 0)::float8 AS masse_top20
      FROM (
        SELECT revenu,
          ROW_NUMBER() OVER (ORDER BY revenu DESC) AS rk,
          COUNT(*) OVER ()                          AS cnt
        FROM (
          SELECT d.matricule, SUM(rev) AS revenu
          FROM (
            SELECT DISTINCT d.matricule, d.annee, d.mois, d.rubrique, d.revenu AS rev
            FROM dwh_rh.dtm_drht_collaborateur d
            WHERE ${conds.join(' AND ')}
          ) d
          GROUP BY d.matricule
        ) t2
      ) t3
    `, params)

    const row = r.rows[0] ?? {}
    const mt = parseFloat(row.masse_totale) || 0
    const m20 = parseFloat(row.masse_top20) || 0
    return {
      pct_top20:    mt > 0 ? Math.round(m20 / mt * 1000) / 10 : 0,
      nb_top20:     row.nb_top20  ?? 0,
      masse_top20:  m20,
      masse_totale: mt,
    }
  } catch {
    return { pct_top20: 0, nb_top20: 0, masse_top20: 0, masse_totale: 0 }
  }
}

function pctVar(a: number, b: number): number | null {
  if (!b) return null
  return Math.round((a - b) / b * 1000) / 10
}

/** Dernière année avec au moins 10 mois de données (= année complète) */
async function detectAnneeRef(client: import('pg').PoolClient): Promise<number> {
  try {
    const r = await client.query(`
      SELECT annee, COUNT(DISTINCT mois) AS nb_mois
      FROM dwh_rh.dtm_drht_collaborateur
      WHERE annee IS NOT NULL
      GROUP BY annee
      HAVING COUNT(DISTINCT mois) >= 10
      ORDER BY annee DESC
      LIMIT 1
    `)
    return r.rows[0]?.annee ?? new Date().getFullYear() - 1
  } catch {
    return new Date().getFullYear() - 1
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  let   annee     = searchParams.get('annee')    || null
  const mois      = searchParams.get('mois')     || null
  const eta       = searchParams.get('eta')      || null
  const quali     = searchParams.get('quali')    || null
  const categorie = searchParams.get('categorie') || null

  const cacheKey = `rh_kpis:${annee}:${mois}:${eta}:${quali}:${categorie}`

  try {
    const data = await withCache(cacheKey, async () => {
      const client = await pool.connect()
      try {
        // Si aucune année fournie → détecter la dernière année complète (≥ 10 mois)
        if (!annee) {
          const ref = await detectAnneeRef(client)
          annee = String(ref)
        }

        const current       = await queryKpis(client, annee, mois, eta, quali, categorie)
        const concentration = await queryConcentration(client, annee, mois, quali, categorie)

        let variation: Record<string, number | null> = {}
        let annee_precedente: string | null = null

        if (annee) {
          try {
            const an1 = String(parseInt(annee) - 1)
            annee_precedente = an1
            const prev = await queryKpis(client, an1, mois, eta, quali, categorie)

            const var_masse = pctVar(current.masse_salariale, prev.masse_salariale)
            const var_eff   = pctVar(current.nb_salaries, prev.nb_salaries)

            variation = {
              masse_salariale:     var_masse,
              nb_salaries:         var_eff,
              salaire_moyen:       pctVar(current.salaire_moyen,        prev.salaire_moyen),
              montant_hs:          pctVar(current.montant_hs,           prev.montant_hs),
              nb_heures_formation: pctVar(current.nb_heures_formation,  prev.nb_heures_formation),
              drift: (var_masse !== null && var_eff !== null)
                ? Math.round((var_masse - var_eff) * 10) / 10
                : null,
            }
          } catch { /* variation indisponible */ }
        }

        return { ...current, variation, concentration, annee_precedente, annee_reference: parseInt(annee) }
      } finally {
        client.release()
      }
    }, TTL_1H)

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rh/kpis] CONNEXION/CACHE:', msg)
    /* Retourner des KPIs à zéro — la page reste utilisable */
    return NextResponse.json({
      nb_salaries: 0, nb_femmes: 0, taux_feminisation: 0,
      nb_cdi: 0, nb_cdd: 0, taux_cdi: 0, anciennete_moy: 0,
      masse_salariale: 0, salaire_moyen: 0,
      montant_hs: 0, nb_heures_sup: 0, taux_hs: 0,
      nb_heures_formation: 0, nb_collaborateurs_formes: 0, pct_formes: 0,
      variation: {}, concentration: { pct_top20: 0, nb_top20: 0, masse_top20: 0, masse_totale: 0 },
      annee_precedente: null,
      _error: msg,
    })
  }
}
