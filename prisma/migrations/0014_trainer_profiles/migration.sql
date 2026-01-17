-- Add TRAINER role to organization member roles
ALTER TYPE app_v3."OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'TRAINER';

-- Trainer profiles
CREATE TABLE app_v3.trainer_profiles (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  user_id UUID NOT NULL,
  title TEXT,
  bio TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT,
  experience_years INTEGER,
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trainer_profiles_org_user_unique UNIQUE (organization_id, user_id),
  CONSTRAINT trainer_profiles_organization_id_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT trainer_profiles_user_id_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX trainer_profiles_org_published_idx ON app_v3.trainer_profiles (organization_id, is_published);
CREATE INDEX trainer_profiles_user_idx ON app_v3.trainer_profiles (user_id);
