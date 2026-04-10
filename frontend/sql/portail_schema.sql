-- ═══════════════════════════════════════════════════════════════════════════
-- PORTAIL_DATA — Schéma gestion des accès SEN'EAU BI Portal
-- Serveur : 10.106.99.138 · Base : Portail_DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Utilisateurs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portail_users (
  id            SERIAL PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL
                  CHECK (role IN ('super_admin','admin_metier','analyste','lecteur_dt','dt')),
  dt            VARCHAR(200),                     -- NULL = accès global
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ,
  created_by    INT REFERENCES portail_users(id)
);

-- ── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portail_sessions (
  token         CHAR(96)     PRIMARY KEY,         -- hex(48 bytes)
  user_id       INT          NOT NULL REFERENCES portail_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ip_address    VARCHAR(45),
  user_agent    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON portail_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON portail_sessions(expires_at);

-- ── Logs d'accès (audit) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portail_access_logs (
  id            SERIAL       PRIMARY KEY,
  user_id       INT          REFERENCES portail_users(id) ON DELETE SET NULL,
  email         VARCHAR(150) NOT NULL,
  action        VARCHAR(30)  NOT NULL
                  CHECK (action IN ('login','logout','login_failed','password_changed','user_created','user_updated','user_disabled')),
  ip_address    VARCHAR(45),
  detail        TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_user   ON portail_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON portail_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_date   ON portail_access_logs(created_at);

-- ── Trigger updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_users_updated ON portail_users;
CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON portail_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Nettoyage automatique des sessions expirées (optionnel via pg_cron) ───────
-- SELECT cron.schedule('cleanup-sessions','0 3 * * *',
--   $$DELETE FROM portail_sessions WHERE expires_at < NOW()$$);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONNÉES INITIALES — Migration des comptes mock
-- Mots de passe hachés avec bcrypt (salt=12)
-- Remplacez les hash ci-dessous après génération (voir README)
-- ═══════════════════════════════════════════════════════════════════════════

-- Commande Node.js pour générer un hash :
--   node -e "const b=require('bcryptjs');console.log(b.hashSync('admin2025',12))"

INSERT INTO portail_users (nom, prenom, email, password_hash, role, dt, is_active)
VALUES
  -- super_admin — a.niang@seneau.sn / admin2025
  ('Niang','Asta','asta.niang@seneau.sn',
   '$2a$12$PLACEHOLDER_HASH_admin2025_REPLACE_ME_xxxxxxxxxxxxxxxx',
   'super_admin', NULL, true),

  -- admin_metier — s.sane@seneau.sn / admin2025
  ('Sane','Syaka','syaka.sane@seneau.sn',
   '$2a$12$PLACEHOLDER_HASH_admin2025_REPLACE_ME_xxxxxxxxxxxxxxxx',
   'admin_metier', 'Direction Regionale DAKAR 2', true),

  -- analyste — y.hachami@seneau.sn / analyste2025
  ('Hachami','Younes','younes.hachami@seneau.sn',
   '$2a$12$PLACEHOLDER_HASH_analyste2025_REPLACE_ME_xxxxxxxxxxxx',
   'analyste', NULL, true),

  -- lecteur_dt — f.sarr@seneau.sn / lecteur2025
  ('Sarr','Fatou','f.sarr@seneau.sn',
   '$2a$12$PLACEHOLDER_HASH_lecteur2025_REPLACE_ME_xxxxxxxxxxxx',
   'lecteur_dt', 'Direction Regionale ZIGUINCHOR', true),

  -- lecteur_dt — o.diallo@seneau.sn / rufisque2025
  ('Diallo','Ousmane','o.diallo@seneau.sn',
   '$2a$12$PLACEHOLDER_HASH_rufisque2025_REPLACE_ME_xxxxxxxxxxx',
   'lecteur_dt', 'Direction Regionale RUFISQUE', true)
ON CONFLICT (email) DO NOTHING;
