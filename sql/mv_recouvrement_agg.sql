-- =============================================================================
-- mv_recouvrement_agg — Vue matérialisée agrégée (pré-calculée)
-- =============================================================================
-- Sources directes (évite de passer par mv_recouvrement) :
--   mv_ca              → facturation (chiffre d'affaires, dimensions)
--   mv_reglement_aging → règlements + tranches aging (plafonnés au CA)
--
-- Logique métier intégrée en CTE :
--   1. regl_plafonne  : plafonne chaque montant règlement/aging au CA de la
--                       facture (même logique que mv_recouvrement)
--   2. base           : jointureCAvsrèglements + calcul statut_facture
--   3. agrégation     : GROUP BY toutes les dimensions → ~5 000 lignes
--
-- Rapports alimentés :
--   - Recouvrement par Direction Territoriale
--   - Facturation & Recouvrement
--   - Aging Impayé
--
-- Gain estimé : x100 à x500 vs requête directe sur mv_recouvrement (7M, 2.27 GB)
--
-- Rafraîchissement (après import Talend) :
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_recouvrement_agg;
--
-- Auteur : Asta Niang Sarr — Data Engineer, DSI SEN'EAU
-- Date   : Avril 2026
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PARAMÈTRES SESSION — Limiter la RAM utilisée pendant la création
-- Serveur partagé : RAM disponible limitée (Metabase, Superset, Neo4j, Trino…)
-- -----------------------------------------------------------------------------
SET work_mem = '32MB';                       -- RAM par opération de tri/hash (défaut souvent 64MB+)
SET max_parallel_workers_per_gather = 0;     -- désactive le parallélisme (évite x8 workers en RAM)
SET enable_hashjoin = off;                   -- force Merge Join (moins gourmand en RAM que Hash Join)


-- -----------------------------------------------------------------------------
-- ÉTAPE 1 — Supprimer l'ancienne version si elle existe
-- -----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_recouvrement_agg;


-- -----------------------------------------------------------------------------
-- ÉTAPE 2 — Créer la vue agrégée avec la logique métier complète en CTE
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_recouvrement_agg AS

WITH

-- ── CTE 1 : Plafonnement des règlements et tranches aging au CA ──────────────
-- Reproduit exactement la logique de mv_recouvrement :
-- si montant_reglement > CA ou < 0 → on plafonne à CA
regl_plafonne AS (
    SELECT
        r."REFERENCE_FACTURE",
        r."PERIODE_FACTURATION",
        r."FAE_ID",

        CASE
            WHEN r.montant_reglement::numeric > ca."chiffre_affaire"
              OR r.montant_reglement < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.montant_reglement, 0::bigint)::numeric
        END AS montant_regle_net,

        CASE
            WHEN r.j::numeric > ca."chiffre_affaire" OR r.j < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.j, 0::bigint)::numeric
        END AS j_net,

        CASE
            WHEN r.jp15::numeric > ca."chiffre_affaire" OR r.jp15 < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.jp15, 0::bigint)::numeric
        END AS jp15_net,

        CASE
            WHEN r.jp30::numeric > ca."chiffre_affaire" OR r.jp30 < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.jp30, 0::bigint)::numeric
        END AS jp30_net,

        CASE
            WHEN r.jp45::numeric > ca."chiffre_affaire" OR r.jp45 < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.jp45, 0::bigint)::numeric
        END AS jp45_net,

        CASE
            WHEN r.jp60::numeric > ca."chiffre_affaire" OR r.jp60 < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.jp60, 0::bigint)::numeric
        END AS jp60_net,

        CASE
            WHEN r.jp75::numeric > ca."chiffre_affaire" OR r.jp75 < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.jp75, 0::bigint)::numeric
        END AS jp75_net,

        CASE
            WHEN r.jp90::numeric > ca."chiffre_affaire" OR r.jp90 < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.jp90, 0::bigint)::numeric
        END AS jp90_net,

        CASE
            WHEN r.js90::numeric > ca."chiffre_affaire" OR r.js90 < 0
            THEN ca."chiffre_affaire"
            ELSE COALESCE(r.js90, 0::bigint)::numeric
        END AS js90_net

    FROM mv_reglement_aging r
    JOIN mv_ca ca
        ON  r."REFERENCE_FACTURE"::text  = ca."REFERENCE_FACTURE"::text
        AND r."PERIODE_FACTURATION"::text = ca."PERIODE_FACTURATION"::text
),

-- ── CTE 2 : Jointure CA + règlements plafonnés (même résultat que mv_recouvrement) ──
base AS (
    SELECT
        -- Dimensions
        ca."DR",
        ca."UO",
        ca."GROUPE_FACTURATION",
        ca."PRODUIT",
        ca."TYPE_FACTURE",
        ca."CAT_BRANCHEMENT",
        ca."CAT_COMPTABLE",
        ca."CODE_RGP",
        ca.categorie_rgp,
        ca."PERIODE_FACTURATION",

        -- Mesures CA
        ca.chiffre_affaire,
        ca.volume,
        ca.nb_facture,

        -- Mesures règlement (plafonnées)
        COALESCE(rp.montant_regle_net, 0::numeric)                              AS montant_regle,
        ca.chiffre_affaire - COALESCE(rp.montant_regle_net, 0::numeric)         AS impaye,

        -- Statut facture (logique mv_recouvrement)
        CASE
            WHEN COALESCE(rp.montant_regle_net, 0::numeric) = 0             THEN 'Non réglée'
            WHEN COALESCE(rp.montant_regle_net, 0::numeric) = ca.chiffre_affaire THEN 'Soldée'
            WHEN COALESCE(rp.montant_regle_net, 0::numeric) < ca.chiffre_affaire THEN 'Partiellement réglée'
            ELSE 'Soldée'
        END AS statut_facture,

        -- Aging (plafonnés)
        COALESCE(rp.j_net,    0::numeric) AS j,
        COALESCE(rp.jp15_net, 0::numeric) AS jp15,
        COALESCE(rp.jp30_net, 0::numeric) AS jp30,
        COALESCE(rp.jp45_net, 0::numeric) AS jp45,
        COALESCE(rp.jp60_net, 0::numeric) AS jp60,
        COALESCE(rp.jp75_net, 0::numeric) AS jp75,
        COALESCE(rp.jp90_net, 0::numeric) AS jp90,
        COALESCE(rp.js90_net, 0::numeric) AS js90

    FROM mv_ca ca
    LEFT JOIN regl_plafonne rp
        ON  ca."REFERENCE_FACTURE"::text  = rp."REFERENCE_FACTURE"::text
        AND ca."PERIODE_FACTURATION"::text = rp."PERIODE_FACTURATION"::text

    -- Filtre format période valide
    WHERE ca."PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
      AND CAST(SPLIT_PART(ca."PERIODE_FACTURATION", '/', 2) AS int) BETWEEN 2020 AND 2030
)

-- ── Agrégation finale : toutes les dimensions × toutes les mesures ────────────
SELECT
    -- Dimensions
    "DR"                                                            AS direction_territoriale,
    "UO"                                                            AS secteur,
    "GROUPE_FACTURATION"                                            AS groupe_facturation,
    "CAT_BRANCHEMENT"                                               AS cat_branchement,
    "TYPE_FACTURE"                                                  AS type_facture,
    "CAT_COMPTABLE"                                                 AS cat_comptable,
    "PRODUIT"                                                       AS produit,
    "CODE_RGP"                                                      AS code_rgp,
    categorie_rgp,
    statut_facture,

    -- Période décomposée
    CAST(SPLIT_PART("PERIODE_FACTURATION", '/', 2) AS int)          AS annee,
    CAST(SPLIT_PART("PERIODE_FACTURATION", '/', 1) AS int)          AS mois,
    CASE
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (11,12) THEN 6
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (9,10)  THEN 5
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (7,8)   THEN 4
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (5,6)   THEN 3
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (3,4)   THEN 2
        ELSE 1
    END                                                             AS bimestre,

    -- Mesures facturation
    COUNT(*)                                    AS nb_factures,
    COALESCE(SUM(nb_facture), 0)                AS nb_facture_src,
    COALESCE(SUM(volume),          0)::numeric(20,3) AS volume_total,
    COALESCE(SUM(chiffre_affaire), 0)::numeric(20,2) AS ca_total,
    COALESCE(SUM(montant_regle),   0)::numeric(20,2) AS encaissement,
    COALESCE(SUM(impaye),          0)::numeric(20,2) AS impaye,

    -- Taux pré-calculés
    CASE
        WHEN COALESCE(SUM(chiffre_affaire), 0) > 0
        THEN ROUND(COALESCE(SUM(montant_regle), 0) * 100.0
             / COALESCE(SUM(chiffre_affaire), 0), 2)
        ELSE 0
    END                                         AS taux_recouvrement,

    CASE
        WHEN COALESCE(SUM(chiffre_affaire), 0) > 0
        THEN ROUND(COALESCE(SUM(impaye), 0) * 100.0
             / COALESCE(SUM(chiffre_affaire), 0), 2)
        ELSE 0
    END                                         AS taux_impaye,

    -- Aging impayé (8 tranches)
    COALESCE(SUM(j),    0)::numeric(20,2)       AS aging_courant,
    COALESCE(SUM(jp15), 0)::numeric(20,2)       AS aging_jp15,
    COALESCE(SUM(jp30), 0)::numeric(20,2)       AS aging_jp30,
    COALESCE(SUM(jp45), 0)::numeric(20,2)       AS aging_jp45,
    COALESCE(SUM(jp60), 0)::numeric(20,2)       AS aging_jp60,
    COALESCE(SUM(jp75), 0)::numeric(20,2)       AS aging_jp75,
    COALESCE(SUM(jp90), 0)::numeric(20,2)       AS aging_jp90,
    COALESCE(SUM(js90), 0)::numeric(20,2)       AS aging_js90

FROM base
GROUP BY
    "DR", "UO", "GROUPE_FACTURATION", "CAT_BRANCHEMENT",
    "TYPE_FACTURE", "CAT_COMPTABLE", "PRODUIT", "CODE_RGP",
    categorie_rgp, statut_facture,
    annee, mois, bimestre

WITH NO DATA;  -- ← structure créée sans données (évite le manque de RAM immédiat)


-- -----------------------------------------------------------------------------
-- ÉTAPE 2b — Index d'abord (possible sur MV vide), PUIS remplissage
-- L'ordre Index → REFRESH est plus efficace : pas de rebuild d'index après
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- ÉTAPE 3 — Index pour les filtres les plus fréquents (sur MV vide = rapide)
-- -----------------------------------------------------------------------------

-- Filtre principal (toutes les requêtes)
CREATE INDEX idx_recouvrement_agg_annee
    ON public.mv_recouvrement_agg (annee);

-- Rapport "Recouvrement par DT"
CREATE INDEX idx_recouvrement_agg_annee_dr
    ON public.mv_recouvrement_agg (annee, direction_territoriale);

-- Rapport "Facturation & Recouvrement"
CREATE INDEX idx_recouvrement_agg_annee_bimestre
    ON public.mv_recouvrement_agg (annee, bimestre);

-- Rapport "Aging Impayé"
CREATE INDEX idx_recouvrement_agg_annee_dr_secteur
    ON public.mv_recouvrement_agg (annee, direction_territoriale, secteur);

-- Filtre groupe facturation
CREATE INDEX idx_recouvrement_agg_groupe
    ON public.mv_recouvrement_agg (annee, groupe_facturation);

-- Filtre categorie_rgp
CREATE INDEX idx_recouvrement_agg_categorie
    ON public.mv_recouvrement_agg (annee, categorie_rgp);

-- Filtre statut facture
CREATE INDEX idx_recouvrement_agg_statut
    ON public.mv_recouvrement_agg (annee, statut_facture);


-- -----------------------------------------------------------------------------
-- ÉTAPE 4 — Index unique → active REFRESH CONCURRENTLY
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX idx_recouvrement_agg_unique
    ON public.mv_recouvrement_agg (
        annee, mois, bimestre,
        direction_territoriale,
        secteur,
        groupe_facturation,
        cat_branchement,
        type_facture,
        cat_comptable,
        produit,
        code_rgp,
        categorie_rgp,
        statut_facture
    );


-- -----------------------------------------------------------------------------
-- ÉTAPE 5 — Remplissage des données (avec RAM limitée)
-- À exécuter après les index — prendra quelques minutes sur le serveur partagé
-- -----------------------------------------------------------------------------
REFRESH MATERIALIZED VIEW public.mv_recouvrement_agg;

-- Remettre les paramètres par défaut pour les autres sessions
RESET work_mem;
RESET max_parallel_workers_per_gather;
RESET enable_hashjoin;


-- -----------------------------------------------------------------------------
-- ÉTAPE 6 — Vérifications
-- -----------------------------------------------------------------------------

SELECT COUNT(*) AS nb_lignes_agregees
FROM public.mv_recouvrement_agg;

SELECT pg_size_pretty(pg_relation_size('public.mv_recouvrement_agg')) AS taille;

SELECT
    annee,
    COUNT(*)                                    AS nb_combinaisons,
    COUNT(DISTINCT direction_territoriale)       AS nb_dr,
    COUNT(DISTINCT secteur)                     AS nb_secteurs,
    SUM(nb_factures)                            AS total_factures,
    ROUND(SUM(ca_total) / 1e9, 2)               AS ca_milliards,
    ROUND(AVG(taux_recouvrement), 1)            AS taux_moy_recouvrement
FROM public.mv_recouvrement_agg
GROUP BY annee
ORDER BY annee DESC;


-- =============================================================================
-- COMMANDES D'EXPLOITATION
-- =============================================================================
--
-- Rafraîchir après import Talend (sans bloquer les lectures) :
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_recouvrement_agg;
--
-- Rafraîchir en maintenance (plus rapide, bloque temporairement) :
--   REFRESH MATERIALIZED VIEW public.mv_recouvrement_agg;
--
-- Surveiller la fraîcheur :
--   SELECT schemaname, matviewname, last_refresh
--   FROM pg_matviews
--   WHERE matviewname = 'mv_recouvrement_agg';
--
-- =============================================================================
