/**
 * GET /api/rh/filtres?annee=2025&mois=3&eta=ETA01&quali=Q1
 * Filtres dynamiques en cascade depuis dtm_drht_collaborateur.
 *
 * Cascade :
 *   annees       — toujours toutes les années (pas de filtre)
 *   mois         — filtrés par annee
 *   etablissements — filtrés par annee + mois
 *   qualifications — filtrés par annee + mois + eta
 *   categories     — filtrés par annee + mois + eta + quali
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbDwh'
import { withCache, TTL_1H } from '@/lib/serverCache'

async function safeRows(
  client: import('pg').PoolClient,
  sql: string,
  params: (string | number)[] = [],
): Promise<Record<string, unknown>[]> {
  try { return (await client.query(sql, params)).rows }
  catch { return [] }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const annee = searchParams.get('annee') || null
  const mois  = searchParams.get('mois')  || null
  const eta   = searchParams.get('eta')   || null
  const quali = searchParams.get('quali') || null

  const cacheKey = `rh_filtres:${annee}:${mois}:${eta}:${quali}`

  try {
    const data = await withCache(cacheKey, async () => {
      const client = await pool.connect()
      try {
        /* ── Conditions cumulées ── */
        const cA:  (string | number)[] = []
        const cAM: (string | number)[] = []
        const cAME: (string | number)[] = []
        const cAMEQ: (string | number)[] = []

        const wA:   string[] = []
        const wAM:  string[] = []
        const wAME: string[] = []
        const wAMEQ: string[] = []

        if (annee) {
          const v = parseInt(annee)
          wA.push(`annee = $${cA.push(v)}`)
          wAM.push(`annee = $${cAM.push(v)}`)
          wAME.push(`annee = $${cAME.push(v)}`)
          wAMEQ.push(`annee = $${cAMEQ.push(v)}`)
        }
        if (mois) {
          const v = parseInt(mois)
          wAM.push(`mois = $${cAM.push(v)}`)
          wAME.push(`mois = $${cAME.push(v)}`)
          wAMEQ.push(`mois = $${cAMEQ.push(v)}`)
        }
        if (eta) {
          wAME.push(`code_eta = $${cAME.push(eta)}`)
          wAMEQ.push(`code_eta = $${cAMEQ.push(eta)}`)
        }
        if (quali) {
          wAMEQ.push(`code_quali = $${cAMEQ.push(quali)}`)
        }

        const toWhere = (c: string[]) => c.length ? 'WHERE ' + c.join(' AND ') : ''

        const [anneesR, moisR, etaR, qualiR, catR] = await Promise.all([

          /* Toutes les années disponibles (pas de filtre) */
          safeRows(client, `
            SELECT DISTINCT annee FROM dwh_rh.dtm_drht_collaborateur
            WHERE annee IS NOT NULL ORDER BY annee DESC
          `),

          /* Mois disponibles pour l'année sélectionnée */
          safeRows(client, `
            SELECT DISTINCT mois FROM dwh_rh.dtm_drht_collaborateur
            ${toWhere(wA)}
            ORDER BY mois
          `, cA),

          /* Établissements disponibles pour annee + mois */
          safeRows(client, `
            SELECT DISTINCT d.code_eta,
                   COALESCE(e.etablissement, d.code_eta) AS etablissement
            FROM dwh_rh.dtm_drht_collaborateur d
            LEFT JOIN dwh_rh.dim_etablissement e ON d.code_eta = e.code_eta
            ${toWhere(wAM)}
            ORDER BY etablissement
          `, cAM),

          /* Qualifications disponibles pour annee + mois + eta */
          safeRows(client, `
            SELECT DISTINCT d.code_quali,
                   COALESCE(q.qualification, d.code_quali::text) AS qualification
            FROM dwh_rh.dtm_drht_collaborateur d
            LEFT JOIN dwh_rh.dim_qualification q ON d.code_quali = q.code_quali
            ${toWhere(wAME)}
            ORDER BY qualification
          `, cAME),

          /* Catégories disponibles pour annee + mois + eta + quali */
          safeRows(client, `
            SELECT DISTINCT categorie
            FROM dwh_rh.dtm_drht_collaborateur
            ${toWhere([...wAMEQ, 'categorie IS NOT NULL'])}
            ORDER BY categorie
          `, cAMEQ),
        ])

        return {
          annees:         anneesR.map(r => parseInt(r.annee as string)),
          mois:           moisR.map(r => parseInt(r.mois as string)),
          etablissements: etaR,
          qualifications: qualiR,
          categories:     catR.map(r => String(r.categorie)),
        }
      } finally {
        client.release()
      }
    }, TTL_1H)

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rh/filtres]', msg)
    /* Retourner des filtres vides plutôt qu'un 500 — la page reste utilisable */
    return NextResponse.json({
      annees: [], mois: [], etablissements: [], qualifications: [], categories: [],
    })
  }
}
