-- ============================================================
-- mv_carte_secteurs — Vue matérialisée GÉO uniquement (sen_ods)
-- Source : API_CLIENT seul (données stables, indépendantes des filtres)
--
-- Les données financières (CA, taux, impayés) sont calculées
-- dynamiquement dans l'API avec les filtres (annee, DR, statut, groupe)
--
-- Colonnes :
--   uo, code_uo       — identité du secteur
--   nb_total          — clients actifs
--   nb_sans_facture   — clients sans aucune facture (prises non facturées)
--   nb_tournees       — tournées distinctes
--   lat, lng          — centroïde GPS du secteur
--
-- Build : ~15s | Refresh : quotidien
-- ============================================================

\c sen_ods

DROP MATERIALIZED VIEW IF EXISTS mv_carte_secteurs CASCADE;

CREATE MATERIALIZED VIEW mv_carte_secteurs AS

WITH

-- Tous les PDI ayant au moins une facture (toutes périodes)
pdi_factures AS (
  SELECT DISTINCT "PDI_REFERENCE"
  FROM public.mv_recouvrement
  WHERE "PDI_REFERENCE" IS NOT NULL
)

SELECT
  c."UO"                                                           AS uo,
  c."CODE_UO"                                                      AS code_uo,
  COUNT(*)::int                                                    AS nb_total,
  -- Clients actifs SANS aucune ligne de facture = prises non facturées
  COUNT(*) FILTER (WHERE f."PDI_REFERENCE" IS NULL)::int           AS nb_sans_facture,
  COUNT(DISTINCT c."CODE_TOURNEE")::int                            AS nb_tournees,
  ROUND(
    AVG(CASE
      WHEN c."COORD_X" ~ '^-?[0-9]+[.,]?[0-9]*$'
       AND REPLACE(c."COORD_X", ',', '.')::float BETWEEN 10 AND 17
      THEN REPLACE(c."COORD_X", ',', '.')::float
    END)::numeric, 6
  )                                                                AS lat,
  ROUND(
    AVG(CASE
      WHEN c."COORD_Y" ~ '^-?[0-9]+[.,]?[0-9]*$'
       AND REPLACE(c."COORD_Y", ',', '.')::float BETWEEN -18 AND -10
      THEN REPLACE(c."COORD_Y", ',', '.')::float
    END)::numeric, 6
  )                                                                AS lng
FROM "API_CLIENT" c
LEFT JOIN pdi_factures f ON c."PDI_REFERENCE" = f."PDI_REFERENCE"
WHERE c."STATUT" = 'actif'
  AND c."UO" IS NOT NULL
GROUP BY c."UO", c."CODE_UO"
HAVING AVG(CASE
  WHEN c."COORD_X" ~ '^-?[0-9]+[.,]?[0-9]*$'
   AND REPLACE(c."COORD_X", ',', '.')::float BETWEEN 10 AND 17
  THEN REPLACE(c."COORD_X", ',', '.')::float
END) IS NOT NULL
ORDER BY nb_total DESC

WITH DATA;

-- ── Index ──────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_carte_secteurs_uo
  ON mv_carte_secteurs (uo);

CREATE INDEX IF NOT EXISTS idx_mv_carte_secteurs_sans_fact
  ON mv_carte_secteurs (nb_sans_facture DESC);

ANALYZE mv_carte_secteurs;

-- ── Vérification ───────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                                          AS nb_secteurs,
  SUM(nb_total)                                                     AS total_clients_actifs,
  SUM(nb_sans_facture)                                              AS total_sans_facture,
  ROUND(SUM(nb_sans_facture)::numeric / NULLIF(SUM(nb_total),0) * 100, 1)
                                                                    AS pct_sans_facture
FROM mv_carte_secteurs;

-- ── Refresh quotidien ──────────────────────────────────────────────────────
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_carte_secteurs;
