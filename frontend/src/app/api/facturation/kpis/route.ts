/**
 * GET /api/facturation/kpis
 * Indicateurs facturation & recouvrement — source : sen_ods.mv_recouvrement
 * Structure uniforme avec /api/rapports (mêmes noms de champs)
 *
 * Params (optionnels) :
 *   annee    — ex. 2025  (défaut : année max de la table)
 *   bimestre — 1-6       (défaut : toute l'année)
 *
 * Objectif taux de recouvrement par DT : 98.5%
 * Cache TTL 1h
 */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/dbOds'
import { parseFilters, buildCteQuery } from '@/lib/rapportFilters'
import { withCache } from '@/lib/serverCache'

// Données journalières → cache 4h (réduit les hits DB sur serveur partagé chargé)
const TTL_4H = 4 * 60 * 60 * 1000

const OBJECTIF_TAUX = 98.5

async function fetchData(qs: string) {
  const sp   = new URLSearchParams(qs)
  const mode = sp.get('mode') ?? 'full'   // 'summary' | 'full'
  let f = parseFilters(sp)

  const client = await pool.connect()
  try {
    await client.query('SET statement_timeout = 120000')

    // Si aucune année fournie → détecter l'année max disponible
    if (f.annee === null) {
      const yr = await client.query(`
        SELECT MAX(CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int)) AS annee
        FROM public.mv_recouvrement
        WHERE "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
      `)
      f = { ...f, annee: yr.rows[0]?.annee ?? new Date().getFullYear() }
    }

    const { cte, params } = buildCteQuery(f)

    /* ── Mode summary : une seule agrégation globale (pas de UNION ALL) ── */
    if (mode === 'summary') {
      const res = await client.query(`
        ${cte}
        SELECT
          COUNT(*)::int                             AS nb_factures,
          COALESCE(SUM(chiffre_affaire),0)::float8  AS ca,
          COALESCE(SUM(montant_regle),  0)::float8  AS enc,
          COALESCE(SUM(impaye),         0)::float8  AS imp,
          COUNT(DISTINCT "DR")::int                 AS nb_dr
        FROM base
      `, params)
      const row = res.rows[0] ?? {}
      const ca  = Number(row.ca  ?? 0)
      const enc = Number(row.enc ?? 0)
      const imp = Number(row.imp ?? 0)
      const taux = ca > 0 ? Math.round(enc * 1000 / ca) / 10 : 0
      return {
        filters:           f,
        nb_factures:       Number(row.nb_factures ?? 0),
        ca_total:          ca,
        encaissement:      enc,
        impaye:            imp,
        taux_recouvrement: taux,
        taux_impaye:       ca > 0 ? Math.round(imp * 1000 / ca) / 10 : 0,
        nb_dr:             Number(row.nb_dr ?? 0),
        objectif_taux:     OBJECTIF_TAUX,
      }
    }

    const res = await client.query(`
      ${cte}

      -- Indicateurs globaux
      SELECT 'kpi'::text AS t, NULL::text AS lbl, NULL::int AS bv, NULL::int AS av,
        COUNT(*)::int                                AS nb_factures,
        COALESCE(SUM(chiffre_affaire),0)::float8     AS ca,
        COALESCE(SUM(montant_regle),  0)::float8     AS enc,
        COALESCE(SUM(impaye),         0)::float8     AS imp,
        COUNT(DISTINCT "DR")::int                    AS nb_dr
      FROM base

      UNION ALL

      -- Détail par DT (DR)
      SELECT 'dr', "DR", NULL, NULL,
        COUNT(*)::int,
        COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),  0)::float8,
        COALESCE(SUM(impaye),         0)::float8,
        NULL
      FROM base
      WHERE "DR" IS NOT NULL
      GROUP BY "DR"

      UNION ALL

      -- Évolution par bimestre
      SELECT 'bim', NULL, bv, av,
        COUNT(*)::int,
        COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),  0)::float8,
        NULL, NULL
      FROM base
      GROUP BY bv, av

      UNION ALL

      -- Répartition par groupe de facturation
      SELECT 'grp', "GROUPE_FACTURATION", NULL, NULL,
        COUNT(*)::int,
        COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),  0)::float8,
        COALESCE(SUM(impaye),         0)::float8,
        NULL
      FROM base
      WHERE "GROUPE_FACTURATION" IS NOT NULL AND "GROUPE_FACTURATION" <> ''
      GROUP BY "GROUPE_FACTURATION"

      UNION ALL

      -- Détail par secteur (UO) — utilisé quand un DT est filtré sur sa DR
      SELECT 'uo', "UO", NULL, NULL,
        COUNT(*)::int,
        COALESCE(SUM(chiffre_affaire),0)::float8,
        COALESCE(SUM(montant_regle),  0)::float8,
        COALESCE(SUM(impaye),         0)::float8,
        NULL
      FROM base
      WHERE "UO" IS NOT NULL AND "UO" <> ''
      GROUP BY "UO"

      ORDER BY t, ca DESC NULLS LAST
    `, params)

    const rows = res.rows
    const kRow = rows.find(r => r.t === 'kpi') ?? {}
    const ca   = Number(kRow.ca  ?? 0)
    const enc  = Number(kRow.enc ?? 0)
    const imp  = Number(kRow.imp ?? 0)
    const taux = ca > 0 ? Math.round(enc * 1000 / ca) / 10 : 0

    const par_dr = rows.filter(r => r.t === 'dr').map(r => {
      const rCa   = Number(r.ca)
      const rEnc  = Number(r.enc)
      const rImp  = Number(r.imp)
      const rTaux = rCa > 0 ? Math.round(rEnc * 1000 / rCa) / 10 : 0
      return {
        dr:                String(r.lbl),
        nb_factures:       Number(r.nb_factures),
        ca_total:          rCa,
        encaissement:      rEnc,
        impaye:            rImp,
        taux_recouvrement: rTaux,
        taux_impaye:       rCa > 0 ? Math.round(rImp * 1000 / rCa) / 10 : 0,
        a_risque:          rTaux < OBJECTIF_TAUX,
        ecart_objectif:    Math.round((rTaux - OBJECTIF_TAUX) * 10) / 10,
      }
    }).sort((a, b) => b.taux_recouvrement - a.taux_recouvrement)

    const par_bimestre = rows.filter(r => r.t === 'bim').map(r => {
      const rCa  = Number(r.ca)
      const rEnc = Number(r.enc)
      return {
        bimestre:          Number(r.bv),
        annee:             Number(r.av),
        nb_factures:       Number(r.nb_factures),
        ca_total:          rCa,
        encaissement:      rEnc,
        taux_recouvrement: rCa > 0 ? Math.round(rEnc * 1000 / rCa) / 10 : 0,
      }
    })

    const par_uo = rows.filter(r => r.t === 'uo').map(r => {
      const rCa  = Number(r.ca)
      const rEnc = Number(r.enc)
      const rImp = Number(r.imp)
      const rTaux = rCa > 0 ? Math.round(rEnc * 1000 / rCa) / 10 : 0
      return {
        uo:                String(r.lbl),
        nb_factures:       Number(r.nb_factures),
        ca_total:          rCa,
        encaissement:      rEnc,
        impaye:            rImp,
        taux_recouvrement: rTaux,
        taux_impaye:       rCa > 0 ? Math.round(rImp * 1000 / rCa) / 10 : 0,
        a_risque:          rTaux < OBJECTIF_TAUX,
        ecart_objectif:    Math.round((rTaux - OBJECTIF_TAUX) * 10) / 10,
      }
    }).sort((a, b) => b.taux_recouvrement - a.taux_recouvrement)

    const par_groupe_facturation = rows.filter(r => r.t === 'grp').map(r => {
      const rCa  = Number(r.ca)
      const rEnc = Number(r.enc)
      const rImp = Number(r.imp)
      return {
        groupe:            String(r.lbl),
        nb_factures:       Number(r.nb_factures),
        ca_total:          rCa,
        encaissement:      rEnc,
        impaye:            rImp,
        taux_recouvrement: rCa > 0 ? Math.round(rEnc * 1000 / rCa) / 10 : 0,
        taux_impaye:       rCa > 0 ? Math.round(rImp * 1000 / rCa) / 10 : 0,
      }
    }).sort((a, b) => b.taux_recouvrement - a.taux_recouvrement)

    const dts_a_risque = par_dr.filter(d => d.a_risque).sort((a, b) => a.taux_recouvrement - b.taux_recouvrement)
    const meilleure    = par_dr[0]    ?? null
    const pire         = par_dr[par_dr.length - 1] ?? null

    return {
      filters:           f,
      // ── Indicateurs globaux (noms uniformisés mv_recouvrement) ──
      nb_factures:       Number(kRow.nb_factures ?? 0),
      ca_total:          ca,
      encaissement:      enc,
      impaye:            imp,
      taux_recouvrement: taux,
      taux_impaye:       ca > 0 ? Math.round(imp * 1000 / ca) / 10 : 0,
      nb_dr:             Number(kRow.nb_dr ?? 0),
      objectif_taux:     OBJECTIF_TAUX,
      // ── Détail par DT ──
      par_dr,
      par_uo,
      par_bimestre,
      par_groupe_facturation,
      dts_a_risque,
      meilleure_dt: meilleure ? { direction_territoriale: meilleure.dr, taux_recouvrement: meilleure.taux_recouvrement } : null,
      pire_dt:      pire      ? { direction_territoriale: pire.dr,      taux_recouvrement: pire.taux_recouvrement      } : null,
      // ── Alias rétrocompatibilité ──
      ca:         ca,
      nb_clients: Number(kRow.nb_factures ?? 0),
      source:     'sen_ods · mv_recouvrement',
      timestamp:  new Date().toISOString(),
    }
  } finally {
    client.release()
  }
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  try {
    const data = await withCache(`facturation_kpis:${qs}`, () => fetchData(qs), TTL_4H)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/facturation/kpis]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
