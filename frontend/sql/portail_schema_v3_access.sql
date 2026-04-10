-- ═══════════════════════════════════════════════════════════════════════════
-- PORTAIL_DATA — Migration v3 : Matrice d'accès rapports × rôles
-- À exécuter sur : 10.106.99.138 · Base : Portail_DATA
-- Prérequis : portail_schema.sql + portail_schema_v2_bruteforce.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Table : Accès rapports par rôle ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portail_report_access (
  report_id   VARCHAR(100) NOT NULL,                  -- id du rapport (ex: 'facturation', 'rh-dashboard')
  role        VARCHAR(50)  NOT NULL
                CHECK (role IN ('super_admin','admin_metier','analyste','lecteur_dt','dt')),
  granted     BOOLEAN      NOT NULL DEFAULT true,      -- true = accès accordé
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  INT          REFERENCES portail_users(id) ON DELETE SET NULL,
  PRIMARY KEY (report_id, role)
);

CREATE INDEX IF NOT EXISTS idx_access_report ON portail_report_access(report_id);
CREATE INDEX IF NOT EXISTS idx_access_role   ON portail_report_access(role);

-- Trigger updated_at (réutilise la fonction créée en v1)
DROP TRIGGER IF EXISTS trg_access_updated ON portail_report_access;
CREATE TRIGGER trg_access_updated
  BEFORE UPDATE ON portail_report_access
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Table : Accès rapports par utilisateur (overrides individuels) ───────────
-- Permet de surcharger la règle par rôle pour un utilisateur spécifique
CREATE TABLE IF NOT EXISTS portail_user_report_access (
  user_id     INT          NOT NULL REFERENCES portail_users(id) ON DELETE CASCADE,
  report_id   VARCHAR(100) NOT NULL,
  granted     BOOLEAN      NOT NULL,                   -- true = forcer accès, false = forcer refus
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  INT          REFERENCES portail_users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_user_access_user   ON portail_user_report_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_report ON portail_user_report_access(report_id);

DROP TRIGGER IF EXISTS trg_user_access_updated ON portail_user_report_access;
CREATE TRIGGER trg_user_access_updated
  BEFORE UPDATE ON portail_user_report_access
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Table : Audit log des changements d'accès ────────────────────────────────
CREATE TABLE IF NOT EXISTS portail_access_change_log (
  id          SERIAL       PRIMARY KEY,
  changed_by  INT          REFERENCES portail_users(id) ON DELETE SET NULL,
  change_type VARCHAR(30)  NOT NULL
                CHECK (change_type IN ('role_access','user_override','user_override_removed')),
  report_id   VARCHAR(100),
  role        VARCHAR(50),
  user_id     INT          REFERENCES portail_users(id) ON DELETE SET NULL,
  old_value   BOOLEAN,
  new_value   BOOLEAN,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_log_date ON portail_access_change_log(created_at);
CREATE INDEX IF NOT EXISTS idx_change_log_by   ON portail_access_change_log(changed_by);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONNÉES INITIALES — Matrice d'accès par défaut (reflète mockData.ts)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Rapport : facturation ────────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('facturation', 'super_admin',  true),
  ('facturation', 'admin_metier', true),
  ('facturation', 'analyste',     true),
  ('facturation', 'lecteur_dt',   true),
  ('facturation', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapport : recouvrement-dt ────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('recouvrement-dt', 'super_admin',  true),
  ('recouvrement-dt', 'admin_metier', true),
  ('recouvrement-dt', 'analyste',     true),
  ('recouvrement-dt', 'lecteur_dt',   true),
  ('recouvrement-dt', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapport : score360 ───────────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('score360', 'super_admin',  true),
  ('score360', 'admin_metier', true),
  ('score360', 'analyste',     true),
  ('score360', 'lecteur_dt',   false),
  ('score360', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapport : suivi-releveur ─────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('suivi-releveur', 'super_admin',  true),
  ('suivi-releveur', 'admin_metier', true),
  ('suivi-releveur', 'analyste',     true),
  ('suivi-releveur', 'lecteur_dt',   true),
  ('suivi-releveur', 'dt',           true)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapport : carte-clients ──────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('carte-clients', 'super_admin',  true),
  ('carte-clients', 'admin_metier', true),
  ('carte-clients', 'analyste',     true),
  ('carte-clients', 'lecteur_dt',   false),
  ('carte-clients', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapport : prises-facturation ─────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('prises-facturation', 'super_admin',  true),
  ('prises-facturation', 'admin_metier', true),
  ('prises-facturation', 'analyste',     true),
  ('prises-facturation', 'lecteur_dt',   false),
  ('prises-facturation', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapport : production-eau ─────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('production-eau', 'super_admin',  true),
  ('production-eau', 'admin_metier', true),
  ('production-eau', 'analyste',     true),
  ('production-eau', 'lecteur_dt',   false),
  ('production-eau', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapport : maintenance ────────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('maintenance', 'super_admin',  true),
  ('maintenance', 'admin_metier', true),
  ('maintenance', 'analyste',     true),
  ('maintenance', 'lecteur_dt',   false),
  ('maintenance', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ── Rapports RH ──────────────────────────────────────────────────────────────
INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('rh-dashboard', 'super_admin',  true),
  ('rh-dashboard', 'admin_metier', true),
  ('rh-dashboard', 'analyste',     true),
  ('rh-dashboard', 'lecteur_dt',   false),
  ('rh-dashboard', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('rh-effectif', 'super_admin',  true),
  ('rh-effectif', 'admin_metier', true),
  ('rh-effectif', 'analyste',     true),
  ('rh-effectif', 'lecteur_dt',   false),
  ('rh-effectif', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('rh-salaire', 'super_admin',  true),
  ('rh-salaire', 'admin_metier', true),
  ('rh-salaire', 'analyste',     false),
  ('rh-salaire', 'lecteur_dt',   false),
  ('rh-salaire', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('rh-hs', 'super_admin',  true),
  ('rh-hs', 'admin_metier', true),
  ('rh-hs', 'analyste',     true),
  ('rh-hs', 'lecteur_dt',   false),
  ('rh-hs', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

INSERT INTO portail_report_access (report_id, role, granted) VALUES
  ('rh-formation', 'super_admin',  true),
  ('rh-formation', 'admin_metier', true),
  ('rh-formation', 'analyste',     true),
  ('rh-formation', 'lecteur_dt',   false),
  ('rh-formation', 'dt',           false)
ON CONFLICT (report_id, role) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- VUE : accès effectif par utilisateur (rôle + overrides individuels)
-- Usage : SELECT * FROM v_user_report_access WHERE user_id = 3;
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_user_report_access AS
SELECT
  u.id                           AS user_id,
  u.email,
  u.role,
  ra.report_id,
  -- Override individuel prime sur la règle de rôle
  COALESCE(ura.granted, ra.granted)  AS has_access,
  CASE WHEN ura.user_id IS NOT NULL THEN 'override' ELSE 'role' END AS access_source
FROM portail_users u
JOIN portail_report_access ra ON ra.role = u.role
LEFT JOIN portail_user_report_access ura
  ON ura.user_id = u.id AND ura.report_id = ra.report_id
WHERE u.is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification
-- ═══════════════════════════════════════════════════════════════════════════
SELECT report_id, role, granted
FROM portail_report_access
ORDER BY report_id, role;
