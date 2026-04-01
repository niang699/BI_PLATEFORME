-- =============================================================================
-- Migration : Contraintes de clé étrangère — schéma dwh_rh
-- Base      : sen_dwh
-- =============================================================================
-- Ajoute :
--   1. PK / UNIQUE sur dim_qualification.code_quali
--   2. PK / UNIQUE sur dim_formation.id_formation
--   3. FK dtm_drht_collaborateur.code_quali   → dim_qualification(code_quali)
--   4. FK dtm_drht_collaborateur.id_formation → dim_formation(id_formation)
--
-- Exécution recommandée dans une transaction :
--   psql -U <user> -d sen_dwh -f rh_fk_constraints.sql
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Clé primaire sur dim_qualification(code_quali)
--    Si une PK existe déjà, ce bloc est sans effet (DO $$ protège).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Ajoute PK uniquement si elle n'existe pas encore
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'dwh_rh'
      AND table_name      = 'dim_qualification'
      AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      AND constraint_name LIKE '%code_quali%'
  ) THEN
    ALTER TABLE dwh_rh.dim_qualification
      ADD CONSTRAINT pk_dim_qualification PRIMARY KEY (code_quali);
    RAISE NOTICE 'PK ajoutée sur dim_qualification(code_quali)';
  ELSE
    RAISE NOTICE 'Contrainte sur dim_qualification(code_quali) déjà présente — ignorée';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Clé primaire sur dim_formation(id_formation)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'dwh_rh'
      AND table_name      = 'dim_formation'
      AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      AND constraint_name LIKE '%id_formation%'
  ) THEN
    ALTER TABLE dwh_rh.dim_formation
      ADD CONSTRAINT pk_dim_formation PRIMARY KEY (id_formation);
    RAISE NOTICE 'PK ajoutée sur dim_formation(id_formation)';
  ELSE
    RAISE NOTICE 'Contrainte sur dim_formation(id_formation) déjà présente — ignorée';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Clé étrangère dtm_drht_collaborateur.code_quali → dim_qualification
--
--    NOT VALID  : valide uniquement les nouvelles lignes ; les lignes existantes
--                 non conformes ne bloquent pas la migration.
--    VALIDATE   : second ALTER pour valider les données existantes (optionnel,
--                 peut être long sur une grande table — commenter si besoin).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'dwh_rh'
      AND table_name      = 'dtm_drht_collaborateur'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_collab_qualification'
  ) THEN
    ALTER TABLE dwh_rh.dtm_drht_collaborateur
      ADD CONSTRAINT fk_collab_qualification
        FOREIGN KEY (code_quali)
        REFERENCES dwh_rh.dim_qualification (code_quali)
        ON UPDATE CASCADE
        ON DELETE SET NULL
        NOT VALID;
    RAISE NOTICE 'FK fk_collab_qualification ajoutée (NOT VALID)';
  ELSE
    RAISE NOTICE 'FK fk_collab_qualification déjà présente — ignorée';
  END IF;
END $$;

-- Validation des données existantes (décommenter si vous voulez vérifier l'intégrité)
-- ALTER TABLE dwh_rh.dtm_drht_collaborateur
--   VALIDATE CONSTRAINT fk_collab_qualification;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Clé étrangère dtm_drht_collaborateur.id_formation → dim_formation
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'dwh_rh'
      AND table_name      = 'dtm_drht_collaborateur'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_collab_formation'
  ) THEN
    ALTER TABLE dwh_rh.dtm_drht_collaborateur
      ADD CONSTRAINT fk_collab_formation
        FOREIGN KEY (id_formation)
        REFERENCES dwh_rh.dim_formation (id_formation)
        ON UPDATE CASCADE
        ON DELETE SET NULL
        NOT VALID;
    RAISE NOTICE 'FK fk_collab_formation ajoutée (NOT VALID)';
  ELSE
    RAISE NOTICE 'FK fk_collab_formation déjà présente — ignorée';
  END IF;
END $$;

-- Validation des données existantes (décommenter si vous voulez vérifier l'intégrité)
-- ALTER TABLE dwh_rh.dtm_drht_collaborateur
--   VALIDATE CONSTRAINT fk_collab_formation;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vérification finale
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tc.constraint_name,
  tc.constraint_type,
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints        tc
JOIN information_schema.key_column_usage         kcu ON tc.constraint_name = kcu.constraint_name
                                                    AND tc.table_schema    = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                                                         AND tc.table_schema    = ccu.table_schema
WHERE tc.table_schema = 'dwh_rh'
  AND tc.table_name  IN ('dtm_drht_collaborateur', 'dim_qualification', 'dim_formation')
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type;

COMMIT;
