-- Create admin MFA table
CREATE TABLE IF NOT EXISTS app_v3.admin_mfa (
  env text NOT NULL DEFAULT 'prod',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  secret_enc text NOT NULL,
  secret_iv text NOT NULL,
  secret_tag text NOT NULL,
  recovery_codes jsonb,
  enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_mfa_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_mfa_user_uniq ON app_v3.admin_mfa(user_id);
