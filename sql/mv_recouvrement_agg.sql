-- =============================================================================
-- mv_recouvrement_agg — Vue matérialisée agrégée (pré-calculée)
-- =============================================================================
-- Source  : public.mv_recouvrement (7M lignes, 2.27 GB)
-- Cible   : ~5 000 lignes, < 2 MB
-- Gain    : x100 à x500 sur les requêtes des rapports BI
--
-- Rapports alimentés :
--   - Recouvrement par Direction Territoriale
--   - Facturation & Recouvrement
--   - Aging Impayé
--
-- Granularité : la plus fine possible — toutes les dimensions combinées.
--   Les rapports filtrent et re-agrègent sur ce dataset minuscule.
--
-- Rafraîchissement : après chaque import Talend
--   → REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_recouvrement_agg;
--
-- Auteur  : Asta Niang Sarr — Data Engineer, DSI SEN'EAU
-- Date    : Avril 2026
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ÉTAPE 1 — Supprimer l'ancienne version si elle existe
-- -----------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_recouvrement_agg;


-- -----------------------------------------------------------------------------
-- ÉTAPE 2 — Créer la vue agrégée
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_recouvrement_agg AS

SELECT
    -- ── Dimensions ────────────────────────────────────────────────────────────
    "DR"                                                        AS direction_territoriale,
    "UO"                                                        AS secteur,
    "GROUPE_FACTURATION"                                        AS groupe_facturation,
    "CAT_BRANCHEMENT"                                           AS cat_branchement,
    "TYPE_FACTURE"                                              AS type_facture,
    "CAT_COMPTABLE"                                             AS cat_comptable,
    "PRODUIT"                                                   AS produit,
    categorie_rgp,
    statut_facture,

    -- Année extraite de PERIODE_FACTURATION (format MM/YYYY)
    CAST(SPLIT_PART("PERIODE_FACTURATION", '/', 2) AS int)      AS annee,

    -- Bimestre calculé (1=Jan-Fév, 2=Mar-Avr, ..., 6=Nov-Déc)
    CASE
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (11,12) THEN 6
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (9,10)  THEN 5
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (7,8)   THEN 4
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (5,6)   THEN 3
        WHEN CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int) IN (3,4)   THEN 2
        ELSE 1
    END                                                         AS bimestre,

    -- Mois (1-12) conservé pour des analyses mensuelles futures
    CAST(SPLIT_PART("PERIODE_FACTURATION",'/',1) AS int)        AS mois,

    -- ── Mesures facturation ───────────────────────────────────────────────────
    COUNT(*)                                                    AS nb_factures,
    COALESCE(SUM(nb_facture), 0)                                AS nb_facture_src,
    COALESCE(SUM(chiffre_affaire), 0)::numeric(20,2)            AS ca_total,
    COALESCE(SUM(montant_regle),   0)::numeric(20,2)            AS encaissement,
    COALESCE(SUM(impaye),          0)::numeric(20,2)            AS impaye,
    COALESCE(SUM(volume),          0)::numeric(20,3)            AS volume_total,

    -- ── Aging impayé (tranches de retard en jours) ────────────────────────────
    -- Ces colonnes alimentent directement le rapport "Aging Impayé"
    COALESCE(SUM(j),    0)::numeric(20,2)                       AS aging_courant,  -- 0-15j
    COALESCE(SUM(jp15), 0)::numeric(20,2)                       AS aging_jp15,     -- 15-30j
    COALESCE(SUM(jp30), 0)::numeric(20,2)                       AS aging_jp30,     -- 30-45j
    COALESCE(SUM(jp45), 0)::numeric(20,2)                       AS aging_jp45,     -- 45-60j
    COALESCE(SUM(jp60), 0)::numeric(20,2)                       AS aging_jp60,     -- 60-75j
    COALESCE(SUM(jp75), 0)::numeric(20,2)                       AS aging_jp75,     -- 75-90j
    COALESCE(SUM(jp90), 0)::numeric(20,2)                       AS aging_jp90,     -- 90-?j
    COALESCE(SUM(js90), 0)::numeric(20,2)                       AS aging_js90,     -- très ancien

    -- ── Métriques dérivées pré-calculées ─────────────────────────────────────
    -- Évite de recalculer les taux à chaque requête API
    CASE
        WHEN COALESCE(SUM(chiffre_affaire), 0) > 0
        THEN ROUND(
            COALESCE(SUM(montant_regle), 0) * 100.0
            / COALESCE(SUM(chiffre_affaire), 0),
            2
        )
        ELSE 0
    END                                                         AS taux_recouvrement,

    CASE
        WHEN COALESCE(SUM(chiffre_affaire), 0) > 0
        THEN ROUND(
            COALESCE(SUM(impaye), 0) * 100.0
            / COALESCE(SUM(chiffre_affaire), 0),
            2
        )
        ELSE 0
    END                                                         AS taux_impaye

FROM public.mv_recouvrement
WHERE
    -- Exclure les lignes avec format PERIODE_FACTURATION invalide
    "PERIODE_FACTURATION" ~ '^[0-9]{2}/[0-9]{4}$'
    AND CAST(SPLIT_PART("PERIODE_FACTURATION",'/',2) AS int) BETWEEN 2020 AND 2030

GROUP BY
    "DR",
    "UO",
    "GROUPE_FACTURATION",
    "CAT_BRANCHEMENT",
    "TYPE_FACTURE",
    "CAT_COMPTABLE",
    "PRODUIT",
    categorie_rgp,
    statut_facture,
    annee,
    bimestre,
    mois

WITH DATA;


-- -----------------------------------------------------------------------------
-- ÉTAPE 3 — Index pour les filtres les plus fréquents des rapports
-- -----------------------------------------------------------------------------

-- Filtre principal : année (présent dans toutes les requêtes)
CREATE INDEX idx_recouvrement_agg_annee
    ON public.mv_recouvrement_agg (annee);

-- Rapport "Recouvrement par DT" : filtre annee + group by DR
CREATE INDEX idx_recouvrement_agg_annee_dr
    ON public.mv_recouvrement_agg (annee, direction_territoriale);

-- Rapport "Facturation & Recouvrement" : filtre annee + bimestre
CREATE INDEX idx_recouvrement_agg_annee_bimestre
    ON public.mv_recouvrement_agg (annee, bimestre);

-- Rapport "Aging impayé" : filtre annee + DR + secteur
CREATE INDEX idx_recouvrement_agg_annee_dr_secteur
    ON public.mv_recouvrement_agg (annee, direction_territoriale, secteur);

-- Filtre groupe facturation
CREATE INDEX idx_recouvrement_agg_groupe
    ON public.mv_recouvrement_agg (annee, groupe_facturation);

-- Filtre categorie_rgp
CREATE INDEX idx_recouvrement_agg_categorie
    ON public.mv_recouvrement_agg (annee, categorie_rgp);


-- -----------------------------------------------------------------------------
-- ÉTAPE 4 — Activer le REFRESH CONCURRENTLY (nécessite un index unique)
-- Un index unique sur toutes les colonnes de dimension permet le refresh
-- sans bloquer les lectures en cours.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX idx_recouvrement_agg_unique
    ON public.mv_recouvrement_agg (
        annee, bimestre, mois,
        direction_territoriale,
        secteur,
        groupe_facturation,
        cat_branchement,
        type_facture,
        cat_comptable,
        produit,
        categorie_rgp,
        statut_facture
    );


-- -----------------------------------------------------------------------------
-- ÉTAPE 5 — Vérification
-- -----------------------------------------------------------------------------

-- Nombre de lignes agrégées
SELECT COUNT(*) AS nb_lignes_agregees FROM public.mv_recouvrement_agg;

-- Taille de la vue
SELECT pg_size_pretty(pg_relation_size('public.mv_recouvrement_agg')) AS taille;

-- Aperçu par année
SELECT
    annee,
    COUNT(*)                        AS nb_combinaisons,
    COUNT(DISTINCT direction_territoriale) AS nb_dr,
    COUNT(DISTINCT secteur)         AS nb_secteurs,
    SUM(nb_factures)                AS total_factures,
    ROUND(SUM(ca_total)/1e9, 2)     AS ca_milliards,
    ROUND(AVG(taux_recouvrement),1) AS taux_moy
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
-- Surveiller la fraîcheur des données :
--   SELECT schemaname, matviewname, last_refresh
--   FROM pg_matviews
--   WHERE matviewname = 'mv_recouvrement_agg';
--
-- =============================================================================
