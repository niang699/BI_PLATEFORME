-- ============================================================
-- mv_recouvrement_geo — Enrichissement géographique
-- Joint mv_recouvrement (sen_ods) × API_CLIENT (sen_dwh)
-- via PDI_REFERENCE (clé commune unique sur API_CLIENT)
--
-- Colonnes ajoutées : REFERENCE_CLIENT, COORD_X, COORD_Y,
--                     ADRESSE_TECHNIQUE, CODE_TOURNEE
--
-- Prérequis : être connecté en tant que superuser (postgres)
-- Durée de création : ~30s | Refresh : quotidien
-- ============================================================

\c sen_ods

-- ── 1. Extension postgres_fdw (si pas déjà installée) ──────────────────────
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- ── 2. Serveur distant (sen_dwh sur le même instance PostgreSQL) ────────────
-- Adapter host/port si nécessaire
CREATE SERVER IF NOT EXISTS sen_dwh_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '10.106.99.138', port '5432', dbname 'sen_dwh');

-- ── 3. Mapping utilisateur ──────────────────────────────────────────────────
-- Remplacer 'postgres'/'votre_mot_de_passe' par les vrais credentials
-- Si même utilisateur que la session courante, utiliser CURRENT_USER
CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
  SERVER sen_dwh_server
  OPTIONS (user 'postgres', password 'votre_mot_de_passe');

-- ── 4. Table étrangère (seulement les colonnes utiles) ─────────────────────
-- Évite de rapatrier les 30+ colonnes de API_CLIENT
DROP FOREIGN TABLE IF EXISTS api_client_fdw;

CREATE FOREIGN TABLE api_client_fdw (
  "PDI_REFERENCE"      text,
  "REFERENCE_CLIENT"   text,
  "COORD_X"            text,    -- latitude  (stockée en texte, ex: "14,752009")
  "COORD_Y"            text,    -- longitude (stockée en texte, ex: "-17,167963")
  "ADRESSE_TECHNIQUE"  text,
  "CODE_TOURNEE"       text,
  "STATUT"             text
)
SERVER sen_dwh_server
OPTIONS (schema_name 'public', table_name '"API_CLIENT"');

-- ── 5. Vue matérialisée enrichie ────────────────────────────────────────────
-- LEFT JOIN : les factures sans correspondance GPS gardent lat/lng = NULL
-- ~30s de build pour 1,3M de lignes

DROP MATERIALIZED VIEW IF EXISTS mv_recouvrement_geo CASCADE;

CREATE MATERIALIZED VIEW mv_recouvrement_geo AS
SELECT
  r."REFERENCE_FACTURE",
  r."FAE_ID",
  r."PDI_REFERENCE",
  r."DR",
  r."UO",
  r."PERIODE_FACTURATION",
  r."DATE_EMISSION",
  r."GROUPE_FACTURATION",
  r."PRODUIT",
  r."TYPE_FACTURE",
  r."CAT_BRANCHEMENT",
  r."CAT_COMPTABLE",
  r."CODE_RGP",
  r."categorie_rgp",
  r."REL_ESTIMEE",
  r."DATE_RELEVE_PREC",
  r."DATE_RELEVE_NOUVELLE",
  r."volume",
  r."nb_tranches",
  r."nb_facture",
  r."chiffre_affaire",
  r."montant_regle",
  r."impaye",
  r."taux_recouvrement",
  r."statut_facture",
  r."j",
  r."jp15",
  r."jp30",
  r."jp45",
  r."jp60",
  r."jp75",
  r."jp90",
  r."js90",
  -- ── Colonnes enrichies depuis API_CLIENT ──────────────────────────────
  a."REFERENCE_CLIENT",
  a."CODE_TOURNEE",
  a."ADRESSE_TECHNIQUE",
  -- Conversion coordonnées : texte → float (gestion virgule française)
  CASE
    WHEN a."COORD_X" ~ '^-?[0-9]+[.,][0-9]+$'
     AND REPLACE(a."COORD_X", ',', '.')::float BETWEEN 10 AND 17
    THEN ROUND(REPLACE(a."COORD_X", ',', '.')::numeric, 6)
  END AS lat,
  CASE
    WHEN a."COORD_Y" ~ '^-?[0-9]+[.,][0-9]+$'
     AND REPLACE(a."COORD_Y", ',', '.')::float BETWEEN -18 AND -10
    THEN ROUND(REPLACE(a."COORD_Y", ',', '.')::numeric, 6)
  END AS lng
FROM public.mv_recouvrement r
LEFT JOIN api_client_fdw a
  ON r."PDI_REFERENCE" = a."PDI_REFERENCE"
 AND a."STATUT" = 'actif'
WITH DATA;

-- ── 6. Index pour les requêtes courantes ────────────────────────────────────
-- Filtres analytiques
CREATE INDEX IF NOT EXISTS idx_mvgeo_dr       ON mv_recouvrement_geo ("DR");
CREATE INDEX IF NOT EXISTS idx_mvgeo_uo       ON mv_recouvrement_geo ("UO");
CREATE INDEX IF NOT EXISTS idx_mvgeo_periode  ON mv_recouvrement_geo ("PERIODE_FACTURATION");

-- Index pour les jointures/lookups par référence
CREATE INDEX IF NOT EXISTS idx_mvgeo_pdi      ON mv_recouvrement_geo ("PDI_REFERENCE");
CREATE INDEX IF NOT EXISTS idx_mvgeo_refcli   ON mv_recouvrement_geo ("REFERENCE_CLIENT");

-- Index partiel pour la carte (seulement les lignes géocodées)
CREATE INDEX IF NOT EXISTS idx_mvgeo_geo
  ON mv_recouvrement_geo (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ── 7. Statistiques ─────────────────────────────────────────────────────────
ANALYZE mv_recouvrement_geo;

-- ── Vérification ────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                           AS total_lignes,
  COUNT(*) FILTER (WHERE lat IS NOT NULL)            AS avec_gps,
  COUNT(*) FILTER (WHERE "REFERENCE_CLIENT" IS NOT NULL) AS avec_ref_client,
  ROUND(COUNT(*) FILTER (WHERE lat IS NOT NULL)::numeric
      / NULLIF(COUNT(*), 0) * 100, 1)               AS pct_gps
FROM mv_recouvrement_geo;

-- ── Refresh quotidien (à planifier) ─────────────────────────────────────────
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recouvrement_geo;
-- Note: CONCURRENTLY requiert un index UNIQUE — ajouter si besoin :
-- CREATE UNIQUE INDEX idx_mvgeo_unique ON mv_recouvrement_geo ("REFERENCE_FACTURE");
