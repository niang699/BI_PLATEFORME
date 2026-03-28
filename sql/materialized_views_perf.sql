-- ============================================================
-- VUES MATÉRIALISÉES — Optimisation performances SEN'EAU Portal
-- À exécuter une fois en tant que DBA (postgres)
-- Gain estimé : 2-4s → <100ms par requête
-- ============================================================

-- ── 1. sen_dwh : Vue secteurs carte (remplace le GROUP BY 1.3M lignes) ──
-- Durée création : ~15s | Refresh : quotidien suffit

\c sen_dwh

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_carte_secteurs AS
SELECT
  "UO"                                                          AS uo,
  "CODE_UO"                                                     AS code_uo,
  COUNT(*)::int                                                 AS nb_total,
  ROUND(AVG(CASE
    WHEN "COORD_X" ~ '^-?[0-9]+[.,]?[0-9]*$'
     AND REPLACE("COORD_X",',','.')::float BETWEEN 10 AND 17
    THEN REPLACE("COORD_X",',','.')::float END)::numeric, 6)   AS lat,
  ROUND(AVG(CASE
    WHEN "COORD_Y" ~ '^-?[0-9]+[.,]?[0-9]*$'
     AND REPLACE("COORD_Y",',','.')::float BETWEEN -18 AND -10
    THEN REPLACE("COORD_Y",',','.')::float END)::numeric, 6)   AS lng,
  COUNT(DISTINCT "CODE_TOURNEE")::int                           AS nb_tournees
FROM "API_CLIENT"
WHERE "STATUT" = 'actif' AND "UO" IS NOT NULL
GROUP BY "UO", "CODE_UO"
HAVING AVG(CASE
  WHEN "COORD_X" ~ '^-?[0-9]+[.,]?[0-9]*$'
   AND REPLACE("COORD_X",',','.')::float BETWEEN 10 AND 17
  THEN REPLACE("COORD_X",',','.')::float END) IS NOT NULL
WITH DATA;

-- Index pour filtrage rapide par UO
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_carte_secteurs_uo ON mv_carte_secteurs (uo);

-- Refresh quotidien (à planifier via pg_cron ou cron OS) :
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_carte_secteurs;


-- ── 2. sen_ods : Index sur l'année extraite de PERIODE_FACTURATION ──
-- Évite le SPLIT_PART + CAST sur chaque ligne à chaque requête

\c sen_ods

-- Colonne calculée persistante (PostgreSQL 12+)
ALTER TABLE public.mv_recouvrement
  ADD COLUMN IF NOT EXISTS annee_fact int
  GENERATED ALWAYS AS (
    CASE WHEN "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
    THEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int)
    END
  ) STORED;

-- Index sur la nouvelle colonne
CREATE INDEX IF NOT EXISTS idx_mv_recvt_annee ON public.mv_recouvrement (annee_fact);
CREATE INDEX IF NOT EXISTS idx_mv_recvt_dr    ON public.mv_recouvrement ("DR");
CREATE INDEX IF NOT EXISTS idx_mv_recvt_annee_dr ON public.mv_recouvrement (annee_fact, "DR");

-- ── 3. sen_dwh : Index sur API_CLIENT pour les requêtes bbox ──

\c sen_dwh

-- Index fonctionnel sur les coordonnées (pour les requêtes de points dans bbox)
CREATE INDEX IF NOT EXISTS idx_api_client_statut ON "API_CLIENT" ("STATUT");
CREATE INDEX IF NOT EXISTS idx_api_client_uo     ON "API_CLIENT" ("UO") WHERE "STATUT" = 'actif';

-- ── Vérification après création ──
SELECT schemaname, matviewname, ispopulated
FROM pg_matviews
WHERE matviewname LIKE 'mv_%';

-- ── Rappel : cross-join sen_ods × sen_dwh ──
-- Exécuter séparément : sql/mv_recouvrement_geo.sql
-- Crée mv_recouvrement_geo avec lat/lng/REFERENCE_CLIENT/ADRESSE_TECHNIQUE/CODE_TOURNEE
-- Prérequis : postgres_fdw + credentials sen_dwh dans le script
