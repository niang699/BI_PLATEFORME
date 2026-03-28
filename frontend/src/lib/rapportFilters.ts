/**
 * Utilitaire partagé — construction de la clause WHERE + parsing des filtres
 * groupe_facturation et cat_branchement supportent la sélection multiple (IN)
 */

export interface RapportFilters {
  annee:              number | null
  bimestre:           number | null
  categorie_rgp:      string | null
  dr:                 string | null
  uo:                 string | null
  groupe_facturation: string[]      // [] = tous, sinon IN (...)
  cat_branchement:    string[]      // [] = tous, sinon IN (...)
  type_facture:       string | null
  statut_facture:     string | null
}

export const BIMESTRE_EXPR = `
  CASE
    WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (11,12) THEN 6
    WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (9,10)  THEN 5
    WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (7,8)   THEN 4
    WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (5,6)   THEN 3
    WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (3,4)   THEN 2
    ELSE 1
  END`

export function parseFilters(sp: URLSearchParams): RapportFilters {
  const s = (k: string) => { const v = sp.get(k); return v && v !== 'all' ? v : null }
  const n = (k: string) => { const v = s(k); return v ? parseInt(v, 10) : null }
  const arr = (k: string) => sp.getAll(k).filter(v => v && v !== 'all')

  return {
    annee:              n('annee'),
    bimestre:           n('bimestre'),
    categorie_rgp:      s('categorie_rgp'),
    dr:                 s('dr'),
    uo:                 s('uo'),
    groupe_facturation: arr('groupe_facturation'),
    cat_branchement:    arr('cat_branchement'),
    type_facture:       s('type_facture'),
    statut_facture:     s('statut_facture'),
  }
}

/**
 * Génère un CTE matérialisé `base` pré-filtré et pré-calculé.
 * _raw scanne la table UNE SEULE FOIS ; base ajoute bv (bimestre calculé).
 * Les requêtes suivantes (GROUP BY, UNION ALL) travaillent sur le cache en RAM.
 */
export function buildCteQuery(f: RapportFilters): { cte: string; params: (number | string)[] } {
  // Optimisation : si une année est fixée, le regex ^[0-9]{2}/YYYY$ remplace
  // les deux conditions génériques (validation format + CAST+SPLIT_PART) en un seul
  // test de chaîne — bien plus rapide sur de grosses tables.
  const conds: string[] = f.annee !== null
    ? [`"PERIODE_FACTURATION" ~ '^[0-9]{2}/${f.annee}$'`]
    : [
        `"PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'`,
        `CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) BETWEEN 2010 AND 2030`,
      ]

  const params: (number | string)[] = []

  const p1 = (val: number | string, cond: string) => {
    params.push(val); conds.push(cond.replace('%%', `$${params.length}`))
  }
  const pIn = (vals: string[], col: string) => {
    if (!vals.length) return
    const start = params.length + 1
    vals.forEach(v => params.push(v))
    conds.push(`${col} IN (${vals.map((_, i) => `$${start + i}`).join(',')})`)
  }

  // annee déjà intégrée dans conds[0] ci-dessus — ne pas re-filtrer
  if (f.categorie_rgp !== null)  p1(f.categorie_rgp, `categorie_rgp = %%`)
  if (f.dr !== null)             p1(f.dr,            `"DR" = %%`)
  if (f.uo !== null)             p1(f.uo,            `"UO" = %%`)
  if (f.type_facture !== null)    p1(f.type_facture,   `"TYPE_FACTURE" = %%`)
  if (f.statut_facture !== null)  p1(f.statut_facture, `statut_facture = %%`)
  pIn(f.groupe_facturation, `"GROUPE_FACTURATION"`)
  pIn(f.cat_branchement,    `"CAT_BRANCHEMENT"`)

  let bimFilter = ''
  if (f.bimestre !== null) {
    params.push(f.bimestre)
    bimFilter = `WHERE bv = $${params.length}`
  }

  // PostgreSQL ne permet pas de référencer un alias (bv) dans le WHERE du même SELECT.
  // On imbrique le calcul bv dans un sous-SELECT pour que base puisse filtrer dessus.
  const cte = `
    WITH _raw AS MATERIALIZED (
      SELECT
        "DR", "UO", "GROUPE_FACTURATION", "TYPE_FACTURE", "CAT_BRANCHEMENT",
        categorie_rgp, statut_facture,
        chiffre_affaire, montant_regle, impaye,
        j, jp15, jp30, jp45, jp60, jp75, jp90, js90,
        CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) AS mv,
        CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) AS av
      FROM public.mv_recouvrement
      WHERE ${conds.join(' AND ')}
    ),
    base AS (
      SELECT * FROM (
        SELECT *,
          CASE WHEN mv IN (11,12) THEN 6
               WHEN mv IN (9,10)  THEN 5
               WHEN mv IN (7,8)   THEN 4
               WHEN mv IN (5,6)   THEN 3
               WHEN mv IN (3,4)   THEN 2
               ELSE 1 END AS bv
        FROM _raw
      ) _bim
      ${bimFilter}
    )`

  return { cte, params }
}

/**
 * Retourne les filtres de la période précédente selon le contexte :
 *  - annee + bimestre → bimestre précédent (ou B6 de l'année précédente si B1)
 *  - annee seule      → année précédente
 *  - sinon            → null (pas de comparaison)
 */
export function buildPrevFilters(f: RapportFilters): { filters: RapportFilters; label: string } | null {
  if (f.annee === null) return null

  if (f.bimestre !== null) {
    if (f.bimestre > 1) {
      return {
        filters: { ...f, bimestre: f.bimestre - 1 },
        label: `B${f.bimestre - 1} ${f.annee}`,
      }
    } else {
      // B1 → B6 de l'année précédente
      return {
        filters: { ...f, annee: f.annee - 1, bimestre: 6 },
        label: `B6 ${f.annee - 1}`,
      }
    }
  }

  return {
    filters: { ...f, annee: f.annee - 1 },
    label: String(f.annee - 1),
  }
}

export function buildWhere(f: RapportFilters): { where: string; params: (number | string)[] } {
  const conds: string[] = [
    `"PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'`,
    `CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) BETWEEN 2010 AND 2030`,
  ]
  const params: (number | string)[] = []

  const push1 = (val: number | string, cond: string) => {
    params.push(val)
    conds.push(cond.replace('%%', `$${params.length}`))
  }

  const pushIn = (vals: string[], col: string) => {
    if (vals.length === 0) return
    const start = params.length + 1
    vals.forEach(v => params.push(v))
    const ph = vals.map((_, i) => `$${start + i}`).join(', ')
    conds.push(`${col} IN (${ph})`)
  }

  if (f.annee !== null)
    push1(f.annee, `CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = %%`)
  if (f.bimestre !== null)
    push1(f.bimestre, `(${BIMESTRE_EXPR}) = %%`)
  if (f.categorie_rgp !== null)
    push1(f.categorie_rgp, `categorie_rgp = %%`)
  if (f.dr !== null)
    push1(f.dr, `"DR" = %%`)
  if (f.uo !== null)
    push1(f.uo, `"UO" = %%`)

  pushIn(f.groupe_facturation, `"GROUPE_FACTURATION"`)
  pushIn(f.cat_branchement,    `"CAT_BRANCHEMENT"`)

  if (f.type_facture !== null)
    push1(f.type_facture, `"TYPE_FACTURE" = %%`)
  if (f.statut_facture !== null)
    push1(f.statut_facture, `statut_facture = %%`)

  return { where: conds.join(' AND '), params }
}
