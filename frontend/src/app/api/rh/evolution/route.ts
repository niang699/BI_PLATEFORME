/**
 * GET /api/rh/evolution?annee=2024&eta=all&quali=all&categorie=all
 * Évolution mensuelle + annuelle masse & effectif — schéma dwh_rh
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbDwh'
import { withCache, TTL_1H } from '@/lib/serverCache'

const MOIS_LABELS: Record<number, string> = {
  1: 'Janv', 2: 'Févr', 3: 'Mars', 4: 'Avr', 5: 'Mai',  6: 'Juin',
  7: 'Juil', 8: 'Août', 9: 'Sept', 10: 'Oct', 11: 'Nov', 12: 'Déc',
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const annee     = searchParams.get('annee')     || null
  const eta       = searchParams.get('eta')       || null
  const quali     = searchParams.get('quali')     || null
  const categorie = searchParams.get('categorie') || null

  const cacheKey = `rh_evolution:${annee}:${eta}:${quali}:${categorie}`


  try {
    const data = await withCache(cacheKey, async () => {
      const client = await pool.connect()
      try {
        /* ── helpers conditions ── */
        const masseConds = (a: string | null) => {
          const c = ["LEFT(d.rubrique, 3) = 'A03'"]
          const p: (string | number)[] = []
          if (a) c.push(`d.annee = $${p.push(parseInt(a))}`)
          if (eta       && eta       !== 'all') c.push(`d.code_eta   = $${p.push(eta)}`)
          if (quali     && quali     !== 'all') c.push(`d.code_quali = $${p.push(quali)}`)
          if (categorie && categorie !== 'all') c.push(`d.categorie  = $${p.push(categorie)}`)
          return { c, p }
        }

        const hsConds = (a: string | null) => {
          const c: string[] = []
          const p: (string | number)[] = []
          if (a) c.push(`d.annee = $${p.push(parseInt(a))}`)
          if (eta       && eta       !== 'all') c.push(`d.code_eta   = $${p.push(eta)}`)
          if (quali     && quali     !== 'all') c.push(`d.code_quali = $${p.push(quali)}`)
          if (categorie && categorie !== 'all') c.push(`d.categorie  = $${p.push(categorie)}`)
          return { c, p }
        }

        const anneeN1 = annee ? String(parseInt(annee) - 1) : null
        const { c: mC,  p: mP  } = masseConds(annee)
        const { c: hC,  p: hP  } = hsConds(annee)
        const { c: mC1, p: mP1 } = masseConds(anneeN1)

        /* conditions annuelle HS (toutes années, sans filtre annee) */
        const hsAnConds: string[] = []
        if (eta       && eta       !== 'all') hsAnConds.push(`code_eta   = '${eta.replace(/'/g, "''")}'`)
        if (quali     && quali     !== 'all') hsAnConds.push(`code_quali = '${quali.replace(/'/g, "''")}'`)
        if (categorie && categorie !== 'all') hsAnConds.push(`categorie  = '${categorie.replace(/'/g, "''")}'`)

        const [masseR, hsR, masseN1R, masseAnR, hsAnR, effAnR] = await Promise.all([

          /* Masse mensuelle N */
          client.query(`
            SELECT d.mois, COALESCE(SUM(rev), 0)::float8 AS masse
            FROM (
              SELECT DISTINCT d.matricule, d.annee, d.mois, d.rubrique, d.revenu AS rev
              FROM dwh_rh.dtm_drht_collaborateur d
              WHERE ${mC.join(' AND ')}
            ) d GROUP BY d.mois ORDER BY d.mois
          `, mP),

          /* HS mensuelle N */
          client.query(`
            SELECT d.mois,
              COALESCE(SUM(hs),  0)::float8 AS nb_hs,
              COALESCE(SUM(mhs), 0)::float8 AS montant_hs
            FROM (
              SELECT DISTINCT d.matricule, d.annee, d.mois,
                     d.heure_sup AS hs, d.heure_sup_mont AS mhs
              FROM dwh_rh.dtm_drht_collaborateur d
              ${hC.length ? 'WHERE ' + hC.join(' AND ') : ''}
            ) d GROUP BY d.mois ORDER BY d.mois
          `, hP),

          /* Masse mensuelle N-1 */
          anneeN1 ? client.query(`
            SELECT d.mois, COALESCE(SUM(rev), 0)::float8 AS masse
            FROM (
              SELECT DISTINCT d.matricule, d.annee, d.mois, d.rubrique, d.revenu AS rev
              FROM dwh_rh.dtm_drht_collaborateur d
              WHERE ${mC1.join(' AND ')}
            ) d GROUP BY d.mois ORDER BY d.mois
          `, mP1) : Promise.resolve({ rows: [] }),

          /* Masse par exercice (toutes années — tendance globale, filtre eta uniquement) */
          client.query(`
            SELECT annee, COALESCE(SUM(rev), 0)::float8 AS masse
            FROM (
              SELECT DISTINCT matricule, annee, mois, rubrique, revenu AS rev
              FROM dwh_rh.dtm_drht_collaborateur
              WHERE LEFT(rubrique, 3) = 'A03'
                ${eta && eta !== 'all' ? `AND code_eta = '${eta.replace(/'/g, "''")}'` : ''}
            ) t GROUP BY annee ORDER BY annee
          `),

          /* HS par exercice (toutes années — tendance globale) */
          client.query(`
            SELECT annee,
              COALESCE(SUM(mhs), 0)::float8 AS montant_hs,
              COALESCE(SUM(hs),  0)::float8 AS nb_heures
            FROM (
              SELECT DISTINCT matricule, annee, mois,
                     heure_sup AS hs, heure_sup_mont AS mhs
              FROM dwh_rh.dtm_drht_collaborateur
              ${hsAnConds.length ? 'WHERE ' + hsAnConds.join(' AND ') : ''}
            ) t
            GROUP BY annee ORDER BY annee
          `),

          /* Effectif + Féminisation par exercice — même filtre que KPI et details */
          client.query(`
            SELECT d.annee,
              COUNT(DISTINCT d.matricule)::int                                        AS nb_total,
              COUNT(DISTINCT CASE WHEN p.sexe = 'FEMININ' THEN d.matricule END)::int  AS nb_femmes
            FROM dwh_rh.dtm_drht_collaborateur d
            JOIN dwh_rh.dim_personnel p ON d.matricule = p.matricule
            WHERE d.annee IS NOT NULL
              AND p.date_sortie = '1999-12-31'
              AND p.type_contrat <> 'JR'
              ${eta       && eta       !== 'all' ? `AND d.code_eta   = '${eta.replace(/'/g, "''")}'`       : ''}
              ${quali     && quali     !== 'all' ? `AND d.code_quali = '${quali.replace(/'/g, "''")}'`     : ''}
              ${categorie && categorie !== 'all' ? `AND d.categorie  = '${categorie.replace(/'/g, "''")}'` : ''}
            GROUP BY d.annee ORDER BY d.annee
          `),
        ])

        /* Fusion mensuelle */
        const masseMap:   Record<number, number> = {}
        const hsMap:      Record<number, number> = {}
        const mhsMap:     Record<number, number> = {}
        const masseN1Map: Record<number, number> = {}
        masseR.rows.forEach(r  => { masseMap[r.mois]   = parseFloat(r.masse) })
        hsR.rows.forEach(r     => { hsMap[r.mois]      = parseFloat(r.nb_hs); mhsMap[r.mois] = parseFloat(r.montant_hs) })
        masseN1R.rows.forEach(r => { masseN1Map[r.mois] = parseFloat(r.masse) })

        const mensuel = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1
          return {
            mois:       m,
            label:      MOIS_LABELS[m],
            masse:      masseMap[m]   ?? 0,
            masse_n1:   masseN1Map[m] ?? 0,
            nb_hs:      hsMap[m]      ?? 0,
            montant_hs: mhsMap[m]     ?? 0,
          }
        }).filter(r => r.masse > 0 || r.nb_hs > 0 || r.masse_n1 > 0)

        /* Cumul masse */
        let cumul = 0
        const mensuel_cumul = mensuel.map(r => {
          cumul += r.masse
          return { ...r, masse_cumul: cumul }
        })

        /* Annuelle effectif */
        const annuelle_effectif = effAnR.rows.map(r => ({
          annee:             parseInt(r.annee),
          nb_total:          r.nb_total,
          nb_femmes:         r.nb_femmes,
          nb_hommes:         r.nb_total - r.nb_femmes,
          taux_feminisation: r.nb_total > 0
            ? Math.round(r.nb_femmes / r.nb_total * 1000) / 10
            : 0,
        }))

        /* Annuelle masse */
        const annuelle_masse = masseAnR.rows.map((r, i) => ({
          annee:   parseInt(r.annee),
          masse:   parseFloat(r.masse),
          is_last: i === masseAnR.rows.length - 1,
        }))

        /* Annuelle HS — ne garder que les années avec des HS */
        const hsAnFiltered = hsAnR.rows.filter(r => parseFloat(r.nb_heures) > 0 || parseFloat(r.montant_hs) > 0)
        const annuelle_hs = hsAnFiltered.map((r, i) => ({
          annee:      parseInt(r.annee),
          montant_hs: parseFloat(r.montant_hs),
          nb_heures:  parseFloat(r.nb_heures),
          is_last:    i === hsAnFiltered.length - 1,
        }))

        return {
          mensuel: mensuel_cumul,
          annuelle_effectif,
          annuelle_masse,
          annuelle_hs,
          annee_n1: anneeN1,
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
