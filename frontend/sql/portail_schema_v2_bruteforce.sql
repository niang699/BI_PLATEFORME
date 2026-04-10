-- ═══════════════════════════════════════════════════════════════════════════
-- PORTAIL_DATA — Migration v2 : Protection brute-force (fallback DB)
-- À exécuter sur Portail_DATA si Redis est indisponible
-- ═══════════════════════════════════════════════════════════════════════════

-- Colonnes de protection brute-force (utilisées uniquement si Redis est down)
ALTER TABLE portail_users
  ADD COLUMN IF NOT EXISTS failed_attempts INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until    TIMESTAMPTZ;

-- Index pour les requêtes de vérification
CREATE INDEX IF NOT EXISTS idx_users_email_active
  ON portail_users(email, is_active);

CREATE INDEX IF NOT EXISTS idx_users_locked
  ON portail_users(locked_until)
  WHERE locked_until IS NOT NULL;

-- Nettoyage des verrous expirés (à planifier via pg_cron ou appel périodique)
-- UPDATE portail_users SET failed_attempts = 0, locked_until = NULL
-- WHERE locked_until IS NOT NULL AND locked_until < NOW();
