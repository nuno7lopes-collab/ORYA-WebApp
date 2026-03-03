-- Academy canónica: fundação de domínio (classes, sessões, inscrições, pedagógico e chat)

CREATE TABLE IF NOT EXISTS app_v3.academy_classes (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  title_snapshot TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_class_series (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  academy_class_id INTEGER NOT NULL,
  class_series_id INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_class_sessions (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  academy_class_id INTEGER NOT NULL,
  academy_class_series_id INTEGER,
  class_session_id INTEGER NOT NULL,
  starts_at TIMESTAMPTZ(6) NOT NULL,
  ends_at TIMESTAMPTZ(6) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  is_drop_in BOOLEAN NOT NULL DEFAULT FALSE,
  checkout_mode TEXT NOT NULL DEFAULT 'CARD_ONLY',
  trainer_professional_id INTEGER,
  court_id INTEGER,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_enrollments (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  academy_class_id INTEGER,
  class_session_id INTEGER NOT NULL,
  booking_id INTEGER,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  source TEXT NOT NULL DEFAULT 'BACKOFFICE',
  hold_token TEXT,
  hold_expires_at TIMESTAMPTZ(6),
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_waitlist_entries (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  academy_class_id INTEGER,
  class_session_id INTEGER NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING',
  position INTEGER,
  acceptance_window_ends_at TIMESTAMPTZ(6),
  promoted_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_attendance (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  class_session_id INTEGER NOT NULL,
  enrollment_id INTEGER,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PRESENT',
  note TEXT,
  marked_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  marked_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_student_profiles (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  user_id UUID NOT NULL,
  display_name TEXT,
  level TEXT,
  risk_status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes_visibility TEXT NOT NULL DEFAULT 'COACH_LAYERED',
  last_session_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_student_goals (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  student_profile_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  target_date DATE,
  achieved_at TIMESTAMPTZ(6),
  created_by_user_id UUID,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_coach_notes (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  trainer_user_id UUID NOT NULL,
  student_profile_id INTEGER NOT NULL,
  class_session_id INTEGER,
  attendance_id INTEGER,
  visibility TEXT NOT NULL DEFAULT 'COACH_ONLY',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_v3.academy_chat_links (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INTEGER NOT NULL,
  academy_class_id INTEGER,
  class_session_id INTEGER,
  conversation_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'SESSION',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS academy_classes_org_service_uq
  ON app_v3.academy_classes (organization_id, service_id);
CREATE INDEX IF NOT EXISTS academy_classes_org_active_idx
  ON app_v3.academy_classes (organization_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS academy_class_series_series_uq
  ON app_v3.academy_class_series (class_series_id);
CREATE INDEX IF NOT EXISTS academy_class_series_org_class_idx
  ON app_v3.academy_class_series (organization_id, academy_class_id);

CREATE UNIQUE INDEX IF NOT EXISTS academy_class_sessions_class_session_uq
  ON app_v3.academy_class_sessions (class_session_id);
CREATE INDEX IF NOT EXISTS academy_class_sessions_org_class_start_idx
  ON app_v3.academy_class_sessions (organization_id, academy_class_id, starts_at);
CREATE INDEX IF NOT EXISTS academy_class_sessions_org_start_idx
  ON app_v3.academy_class_sessions (organization_id, starts_at);

CREATE UNIQUE INDEX IF NOT EXISTS academy_enrollments_booking_uq
  ON app_v3.academy_enrollments (booking_id);
CREATE INDEX IF NOT EXISTS academy_enrollments_org_session_idx
  ON app_v3.academy_enrollments (organization_id, class_session_id);
CREATE INDEX IF NOT EXISTS academy_enrollments_org_user_idx
  ON app_v3.academy_enrollments (organization_id, user_id);
CREATE INDEX IF NOT EXISTS academy_enrollments_org_status_idx
  ON app_v3.academy_enrollments (organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS academy_waitlist_session_user_uq
  ON app_v3.academy_waitlist_entries (class_session_id, user_id);
CREATE INDEX IF NOT EXISTS academy_waitlist_org_session_status_idx
  ON app_v3.academy_waitlist_entries (organization_id, class_session_id, status);
CREATE INDEX IF NOT EXISTS academy_waitlist_org_user_idx
  ON app_v3.academy_waitlist_entries (organization_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS academy_attendance_session_user_uq
  ON app_v3.academy_attendance (class_session_id, user_id);
CREATE INDEX IF NOT EXISTS academy_attendance_org_session_idx
  ON app_v3.academy_attendance (organization_id, class_session_id);
CREATE INDEX IF NOT EXISTS academy_attendance_org_marker_idx
  ON app_v3.academy_attendance (organization_id, marked_by_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS academy_student_profiles_org_user_uq
  ON app_v3.academy_student_profiles (organization_id, user_id);
CREATE INDEX IF NOT EXISTS academy_student_profiles_org_risk_idx
  ON app_v3.academy_student_profiles (organization_id, risk_status);

CREATE INDEX IF NOT EXISTS academy_student_goals_org_profile_idx
  ON app_v3.academy_student_goals (organization_id, student_profile_id);
CREATE INDEX IF NOT EXISTS academy_student_goals_org_status_idx
  ON app_v3.academy_student_goals (organization_id, status);

CREATE INDEX IF NOT EXISTS academy_coach_notes_org_trainer_idx
  ON app_v3.academy_coach_notes (organization_id, trainer_user_id);
CREATE INDEX IF NOT EXISTS academy_coach_notes_org_student_created_idx
  ON app_v3.academy_coach_notes (organization_id, student_profile_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS academy_chat_links_org_conversation_uq
  ON app_v3.academy_chat_links (organization_id, conversation_id);
CREATE INDEX IF NOT EXISTS academy_chat_links_org_class_idx
  ON app_v3.academy_chat_links (organization_id, academy_class_id);
CREATE INDEX IF NOT EXISTS academy_chat_links_org_session_idx
  ON app_v3.academy_chat_links (organization_id, class_session_id);
