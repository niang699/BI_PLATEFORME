/**
 * GET /api/rh/hs-topn?n=10&annee=2024&mois=all&eta=all&quali=all&categorie=all
 * Top N matricules par montant heures supplémentaires
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/dbDwh'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const n         = Math.min(50, Math.max(1, parseInt(searchParams.get('n') || '10')))
  const annee     = searchParams.get('annee')     || null
  const mois      = searchParams.get('mois')      || null
  const eta       = searchParams.get('eta')       || null
  const quali     = searchParams.get('quali')     || null
  const categorie = searchParams.get('categorie') || null

  const conds: string[] = []
  const params: (string | number)[] = []

  if (annee)    conds.push(`d.annee      = $${params.push(parseInt(annee))}`)
  if (mois      && mois      !== 'all') conds.push(`d.mois       = $${params.push(parseInt(mois))}`)
  if (eta       && eta       !== 'all') conds.push(`d.code_eta   = $${params.push(eta)}`)
  if (quali     && quali     !== 'all') conds.push(`d.code_quali = $${params.push(quali)}`)
  if (categorie && categorie !== 'all') conds.push(`d.categorie  = $${params.push(categorie)}`)

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''

  try {
    const client = await pool.connect()
    try {
      const res = await client.query(`
        SELECT
          t.matricule,
          COALESCE(MAX(p.nom_prenom), t.matricule)                   AS nom_prenom,
          COALESCE(MAX(e.etablissement), MAX(t.code_eta))            AS direction,
          COALESCE(MAX(q.qualification), MAX(t.code_quali::text))    AS fonction,
          MAX(t.categorie)                                            AS categorie,
          COALESCE(SUM(t.mhs), 0)::float8                            AS montant_hs,
          COALESCE(SUM(t.hs),  0)::float8                            AS nb_heures
        FROM (
          SELECT DISTINCT d.matricule, d.annee, d.mois, d.code_eta,
                 d.code_quali, d.categorie,
                 d.heure_sup AS hs, d.heure_sup_mont AS mhs
          FROM dwh_rh.dtm_drht_collaborateur d
          ${where}
        ) t
        LEFT JOIN dwh_rh.dim_personnel      p ON t.matricule  = p.matricule
        LEFT JOIN dwh_rh.dim_etablissement  e ON t.code_eta   = e.code_eta
        LEFT JOIN dwh_rh.dim_qualification  q ON t.code_quali = q.code_quali
        GROUP BY t.matricule
        HAVING COALESCE(SUM(t.mhs), 0) > 0
        ORDER BY montant_hs DESC
        LIMIT $${params.push(n)}
      `, params)

      return NextResponse.json(res.rows.map(r => ({
        matricule:  r.matricule,
        nom_prenom: r.nom_prenom  ?? r.matricule,
        direction:  r.direction   ?? 'N/A',
        fonction:   r.fonction    ?? 'N/A',
        categorie:  r.categorie   ?? 'N/A',
        montant_hs: parseFloat(r.montant_hs),
        nb_heures:  parseFloat(r.nb_heures),
      })))
    } finally {
      client.release()
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/rh/hs-topn]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
