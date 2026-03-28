/**
 * GET /api/carte/ca-manquant/retour-facturation
 *
 * Taux de retour en facturation : mesure l'efficacité des actions correctives
 * en comptant les PDIs qui étaient absents au bimestre N-1 et
 * réapparaissent en bimestre N.
 *
 * Pour chaque transition bimestrielle de l'année :
 *   taux_retour = nb PDIs facturés en N parmi ceux absents en N-1
 *                 ────────────────────────────────────────────────
 *                 nb PDIs absents en N-1 (parc actif − facturés N-1)
 *
 * Retourne :
 *   - points : [ { bim_prev, bim_curr, label, nb_absents_prev, nb_retour, taux_retour } ]
 *   - taux_moyen : moyenne annuelle du taux de retour
 *
 * Cache 30 min
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { withCache } from '@/lib/serverCache'

const TTL_30M = 30 * 60 * 1000

const BIM_LABELS: Record<number, string> = {
  1: 'Jan–Fév', 2: 'Mar–Avr', 3: 'Mai–Jun',
  4: 'Jul–Aoû', 5: 'Sep–Oct', 6: 'Nov–Déc',
}

async function fetchRetourFacturation(qs: string) {
  const sp    = new URLSearchParams(qs)
  const annee = parseInt(sp.get('annee') ?? '2025', 10)
  const dr    = sp.get('dr') ?? null

  const drCond       = dr ? `AND "DR" = $2` : ''
  const drCondClient = dr ? `AND "DR" = $2` : ''
  const params       = dr ? [annee, dr] : [annee]

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 300000')

    const res = await client.query(`
      WITH
      /* ── Taille du parc actif ── */
      parc_size AS (
        SELECT COUNT(DISTINCT "PDI_REFERENCE")::int AS n
        FROM "API_CLIENT"
        WHERE "STATUT" = 'actif'
          AND "PDI_REFERENCE" IS NOT NULL
          ${drCondClient}
      ),

      /* ── Présences distinctes par PDI × bimestre ── */
      fact_bim AS (
        SELECT DISTINCT
          "PDI_REFERENCE",
          CEIL(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) / 2.0)::int AS bim
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" LIKE '__/____'
          AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) = $1
          AND chiffre_affaire > 0
          AND "PDI_REFERENCE" IS NOT NULL
          ${drCond}
      ),

      /* ── Nb facturés distincts par bimestre ── */
      fact_by_bim AS (
        SELECT bim, COUNT(DISTINCT "PDI_REFERENCE")::int AS nb_fact
        FROM fact_bim
        GROUP BY bim
      ),

      /* ── PDIs facturés en bim N qui n'étaient PAS en bim N-1 ── */
      retour AS (
        SELECT
          f_curr.bim                          AS bim_curr,
          COUNT(DISTINCT f_curr."PDI_REFERENCE")::int AS nb_retour
        FROM fact_bim f_curr
        LEFT JOIN fact_bim f_prev
          ON  f_curr."PDI_REFERENCE" = f_prev."PDI_REFERENCE"
          AND f_prev.bim = f_curr.bim - 1
        WHERE f_curr.bim >= 2
          AND f_prev."PDI_REFERENCE" IS NULL   -- absent en N-1 = retour
        GROUP BY f_curr.bim
      )

      SELECT
        r.bim_curr - 1                                                             AS bim_prev,
        r.bim_curr,
        /* nb absents en N-1 = parc - facturés en N-1 */
        (SELECT n FROM parc_size) - COALESCE(b.nb_fact, 0)                        AS nb_absents_prev,
        r.nb_retour,
        COALESCE(b.nb_fact, 0)                                                     AS nb_fact_prev,
        ROUND(
          r.nb_retour * 100.0 /
          NULLIF((SELECT n FROM parc_size) - COALESCE(b.nb_fact, 0), 0)
        )::int                                                                     AS taux_retour
      FROM retour r
      LEFT JOIN fact_by_bim b ON b.bim = r.bim_curr - 1
      ORDER BY r.bim_curr
    `, params)

    /* Calculer taux moyen (sur les transitions disponibles) */
    const points = res.rows.map((r: {
      bim_prev: number; bim_curr: number
      nb_absents_prev: number; nb_retour: number
      nb_fact_prev: number; taux_retour: number
    }) => ({
      bim_prev:       r.bim_prev,
      bim_curr:       r.bim_curr,
      label:          `B${r.bim_prev}→B${r.bim_curr}`,
      label_prev:     BIM_LABELS[r.bim_prev] ?? `B${r.bim_prev}`,
      label_curr:     BIM_LABELS[r.bim_curr] ?? `B${r.bim_curr}`,
      nb_absents_prev: r.nb_absents_prev,
      nb_retour:      r.nb_retour,
      nb_fact_prev:   r.nb_fact_prev,
      taux_retour:    r.taux_retour ?? 0,
    }))

    const taux_moyen = points.length > 0
      ? Math.round(points.reduce((s: number, p: { taux_retour: number }) => s + p.taux_retour, 0) / points.length)
      : 0

    return {
      points,
      taux_moyen,
      annee,
      filters: { annee, dr },
      timestamp: new Date().toISOString(),
    }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`ca_retour:${qs}`, () => fetchRetourFacturation(qs), TTL_30M)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/carte/ca-manquant/retour-facturation]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
