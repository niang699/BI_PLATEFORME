/**
 * GET /api/rh/details?annee=2024&mois=all&eta=all&quali=all&categorie=all
 * Répartitions : effectif/eta, effectif/quali, masse/eta, masse/statut,
 *                formation/theme, formation/eta — schéma dwh_rh
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbDwh'
import { withCache, TTL_1H } from '@/lib/serverCache'

async function safeQuery(
  client: import('pg').PoolClient,
  sql: string,
  params: (string | number)[] = [],
): Promise<Record<string, unknown>[]> {
  try { return (await client.query(sql, params)).rows }
  catch { return [] }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const annee     = searchParams.get('annee')     || null
  const mois      = searchParams.get('mois')      || null
  const eta       = searchParams.get('eta')       || null
  const quali     = searchParams.get('quali')     || null
  const categorie = searchParams.get('categorie') || null

  const cacheKey = `rh_details:${annee}:${mois}:${eta}:${quali}:${categorie}`

  /* ── helper : conditions communes effectif (cumulatif ANNEE <=) ── */
  function buildEffConds() {
    const conds = ["p.date_sortie = '1999-12-31'", "p.type_contrat <> 'JR'"]
    const p: (string | number)[] = []
    if (annee)    conds.push(`d.annee      <= $${p.push(parseInt(annee))}`)
    if (eta       && eta       !== 'all') conds.push(`d.code_eta   = $${p.push(eta)}`)
    if (quali     && quali     !== 'all') conds.push(`d.code_quali = $${p.push(quali)}`)
    if (categorie && categorie !== 'all') conds.push(`d.categorie  = $${p.push(categorie)}`)
    return { conds, p }
  }

  /* ── helper : conditions communes masse (exercice ANNEE =) ── */
  function buildMasseConds() {
    const conds = ["LEFT(d.rubrique, 3) = 'A03'"]
    const p: (string | number)[] = []
    if (annee)    conds.push(`d.annee      = $${p.push(parseInt(annee))}`)
    if (mois      && mois      !== 'all') conds.push(`d.mois       = $${p.push(parseInt(mois))}`)
    if (eta       && eta       !== 'all') conds.push(`d.code_eta   = $${p.push(eta)}`)
    if (quali     && quali     !== 'all') conds.push(`d.code_quali = $${p.push(quali)}`)
    if (categorie && categorie !== 'all') conds.push(`d.categorie  = $${p.push(categorie)}`)
    return { conds, p }
  }

  /* ── helper : conditions communes heures supplémentaires ── */
  function buildHsConds() {
    const conds: string[] = []
    const p: (string | number)[] = []
    if (annee)    conds.push(`d.annee      = $${p.push(parseInt(annee))}`)
    if (mois      && mois      !== 'all') conds.push(`d.mois       = $${p.push(parseInt(mois))}`)
    if (eta       && eta       !== 'all') conds.push(`d.code_eta   = $${p.push(eta)}`)
    if (quali     && quali     !== 'all') conds.push(`d.code_quali = $${p.push(quali)}`)
    if (categorie && categorie !== 'all') conds.push(`d.categorie  = $${p.push(categorie)}`)
    return { conds, p }
  }

  /* ── helper : conditions communes formation ── */
  function buildFormConds() {
    const conds = ['d.heure_formation <> 0']
    const p: (string | number)[] = []
    if (annee)    conds.push(`d.annee      = $${p.push(parseInt(annee))}`)
    if (eta       && eta       !== 'all') conds.push(`d.code_eta   = $${p.push(eta)}`)
    if (quali     && quali     !== 'all') conds.push(`d.code_quali = $${p.push(quali)}`)
    if (categorie && categorie !== 'all') conds.push(`d.categorie  = $${p.push(categorie)}`)
    return { conds, p }
  }


  try {
    const data = await withCache(cacheKey, async () => {
      const client = await pool.connect()
      try {
        const { conds: effC, p: effP } = buildEffConds()
        const { conds: masseC, p: masseP } = buildMasseConds()
        const { conds: formC, p: formP } = buildFormConds()
        const { conds: hsC, p: hsP } = buildHsConds()
        const { conds: hsC2, p: hsP2 } = buildHsConds()
        const { conds: hsC3, p: hsP3 } = buildHsConds()

        const { conds: effC2, p: effP2 } = buildEffConds()

        const [etaRows, qualiRows, masseEtaRows, masseStatutRows, formThemeRows, formEtaRows, ancTranchesRows, contratRows,
               hsRubriqueRows, hsEtaRows, hsCatRows] =
          await Promise.all([

            /* Effectif par établissement */
            safeQuery(client, `
              SELECT COALESCE(e.etablissement, d.code_eta) AS etablissement,
                     COUNT(DISTINCT d.matricule)::int AS effectif
              FROM dwh_rh.dtm_drht_collaborateur d
              JOIN  dwh_rh.dim_personnel     p ON d.matricule = p.matricule
              LEFT JOIN dwh_rh.dim_etablissement e ON d.code_eta = e.code_eta
              WHERE ${effC.join(' AND ')}
              GROUP BY COALESCE(e.etablissement, d.code_eta)
              ORDER BY effectif DESC
            `, effP),

            /* Effectif par qualification */
            safeQuery(client, `
              SELECT COALESCE(q.qualification, d.code_quali::text, 'Non défini') AS qualification,
                     COUNT(DISTINCT d.matricule)::int AS effectif
              FROM dwh_rh.dtm_drht_collaborateur d
              JOIN  dwh_rh.dim_personnel     p ON d.matricule  = p.matricule
              LEFT JOIN dwh_rh.dim_qualification q ON d.code_quali = q.code_quali
              WHERE ${effC.join(' AND ')}
              GROUP BY COALESCE(q.qualification, d.code_quali::text, 'Non défini')
              ORDER BY effectif DESC
            `, effP),

            /* Masse par établissement */
            safeQuery(client, `
              SELECT COALESCE(e.etablissement, d.code_eta) AS etablissement,
                     COALESCE(SUM(rev), 0)::float8 AS masse
              FROM (
                SELECT DISTINCT d.matricule, d.annee, d.mois, d.code_eta, d.rubrique, d.revenu AS rev
                FROM dwh_rh.dtm_drht_collaborateur d
                WHERE ${masseC.join(' AND ')}
              ) d
              LEFT JOIN dwh_rh.dim_etablissement e ON d.code_eta = e.code_eta
              GROUP BY COALESCE(e.etablissement, d.code_eta)
              ORDER BY masse DESC
            `, masseP),

            /* Masse par statut / qualification */
            safeQuery(client, `
              SELECT COALESCE(q.qualification, d.code_quali::text, 'Non défini') AS statut,
                     COALESCE(SUM(rev), 0)::float8 AS masse
              FROM (
                SELECT DISTINCT d.matricule, d.annee, d.mois, d.code_quali, d.rubrique, d.revenu AS rev
                FROM dwh_rh.dtm_drht_collaborateur d
                WHERE ${masseC.join(' AND ')}
              ) d
              LEFT JOIN dwh_rh.dim_qualification q ON d.code_quali = q.code_quali
              GROUP BY COALESCE(q.qualification, d.code_quali::text, 'Non défini')
              ORDER BY masse DESC
            `, masseP),

            /* Formation par thème */
            safeQuery(client, `
              SELECT COALESCE(f.theme, 'Non défini') AS theme,
                     COALESCE(SUM(d.heure_formation), 0)::float8 AS heures,
                     COUNT(DISTINCT d.matricule)::int             AS nb_collab
              FROM dwh_rh.dtm_drht_collaborateur d
              LEFT JOIN dwh_rh.dim_formation f ON d.id_formation = f.id_formation
              WHERE ${formC.join(' AND ')}
              GROUP BY COALESCE(f.theme, 'Non défini')
              ORDER BY heures DESC
            `, formP),

            /* Formation par établissement */
            safeQuery(client, `
              SELECT COALESCE(e.etablissement, d.code_eta) AS etablissement,
                     COALESCE(SUM(d.heure_formation), 0)::float8 AS heures,
                     COUNT(DISTINCT d.matricule)::int             AS nb_collab
              FROM dwh_rh.dtm_drht_collaborateur d
              LEFT JOIN dwh_rh.dim_etablissement e ON d.code_eta = e.code_eta
              WHERE ${formC.join(' AND ')}
              GROUP BY COALESCE(e.etablissement, d.code_eta)
              ORDER BY heures DESC
            `, formP),

            /* Ancienneté par tranche */
            safeQuery(client, `
              SELECT tranche, sort_key, COUNT(*)::int AS effectif
              FROM (
                SELECT DISTINCT d.matricule,
                  CASE
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 2  THEN '< 2 ans'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 5  THEN '2–4 ans'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 10 THEN '5–9 ans'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 15 THEN '10–14 ans'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 20 THEN '15–19 ans'
                    ELSE '≥ 20 ans'
                  END AS tranche,
                  CASE
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 2  THEN 0
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 5  THEN 1
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 10 THEN 2
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 15 THEN 3
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_embauche)) < 20 THEN 4
                    ELSE 5
                  END AS sort_key
                FROM dwh_rh.dtm_drht_collaborateur d
                JOIN dwh_rh.dim_personnel p ON d.matricule = p.matricule
                WHERE ${effC2.join(' AND ')}
              ) t
              GROUP BY tranche, sort_key
              ORDER BY sort_key
            `, effP2),

            /* Répartition CDI / CDD */
            safeQuery(client, `
              SELECT p.type_contrat,
                CASE p.type_contrat WHEN 'DI' THEN 'CDI' WHEN 'DD' THEN 'CDD' ELSE p.type_contrat END AS libelle,
                COUNT(DISTINCT d.matricule)::int AS effectif
              FROM dwh_rh.dtm_drht_collaborateur d
              JOIN dwh_rh.dim_personnel p ON d.matricule = p.matricule
              WHERE ${effC2.join(' AND ')}
              GROUP BY p.type_contrat
              ORDER BY effectif DESC
            `, effP2),

            /* HS par rubrique (HS1, HS2, HS3, HS4…) */
            safeQuery(client, `
              SELECT d.rubrique,
                     COALESCE(SUM(rev), 0)::float8          AS montant,
                     COUNT(DISTINCT d.matricule)::int        AS nb_collab
              FROM (
                SELECT DISTINCT d.matricule, d.annee, d.mois, d.rubrique, d.revenu AS rev
                FROM dwh_rh.dtm_drht_collaborateur d
                WHERE d.rubrique LIKE 'HS%'
                  ${hsC.length ? 'AND ' + hsC.join(' AND ') : ''}
              ) d
              GROUP BY d.rubrique
              ORDER BY d.rubrique
            `, hsP),

            /* HS par établissement */
            safeQuery(client, `
              SELECT COALESCE(e.etablissement, d.code_eta)    AS etablissement,
                     COALESCE(SUM(mhs), 0)::float8            AS montant,
                     COALESCE(SUM(hs),  0)::float8            AS nb_heures,
                     COUNT(DISTINCT CASE WHEN hs > 0 THEN d.matricule END)::int AS nb_collab
              FROM (
                SELECT DISTINCT d.matricule, d.annee, d.mois, d.code_eta,
                       d.heure_sup AS hs, d.heure_sup_mont AS mhs
                FROM dwh_rh.dtm_drht_collaborateur d
                ${hsC2.length ? 'WHERE ' + hsC2.join(' AND ') : ''}
              ) d
              LEFT JOIN dwh_rh.dim_etablissement e ON d.code_eta = e.code_eta
              GROUP BY COALESCE(e.etablissement, d.code_eta)
              HAVING COALESCE(SUM(hs), 0) > 0
              ORDER BY montant DESC
            `, hsP2),

            /* HS par catégorie */
            safeQuery(client, `
              SELECT d.categorie,
                     COALESCE(SUM(mhs), 0)::float8 AS montant
              FROM (
                SELECT DISTINCT d.matricule, d.annee, d.mois, d.categorie,
                       d.heure_sup_mont AS mhs
                FROM dwh_rh.dtm_drht_collaborateur d
                WHERE d.heure_sup_mont <> 0 AND d.categorie IS NOT NULL
                  ${hsC3.length ? 'AND ' + hsC3.join(' AND ') : ''}
              ) d
              GROUP BY d.categorie
              ORDER BY montant DESC
            `, hsP3),
          ])

        return {
          effectif_par_eta:           etaRows,
          effectif_par_qualification: qualiRows,
          masse_par_eta:              masseEtaRows,
          masse_par_statut:           masseStatutRows,
          formation_par_theme:        formThemeRows,
          formation_par_eta:          formEtaRows,
          anciennete_tranches:        ancTranchesRows,
          repartition_contrat:        contratRows,
          hs_par_rubrique:            hsRubriqueRows,
          hs_par_eta:                 hsEtaRows,
          hs_par_categorie:           hsCatRows,
        }
      } finally {
        client.release()
      }
    }, TTL_1H)

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
