-- Padel Club OS: services kinds, courts on bookings, membership plans

CREATE TYPE app_v3."ServiceKind" AS ENUM ('GENERAL', 'COURT', 'CLASS');
CREATE TYPE app_v3."MembershipBillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE app_v3."MembershipStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED');

ALTER TABLE app_v3.services
  ADD COLUMN kind app_v3."ServiceKind" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN instructor_id UUID,
  ADD COLUMN required_membership_plan_ids INTEGER[] NOT NULL DEFAULT '{}';

ALTER TABLE app_v3.services
  ADD CONSTRAINT services_instructor_id_fkey
  FOREIGN KEY (instructor_id)
  REFERENCES app_v3.profiles(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

CREATE INDEX services_instructor_idx ON app_v3.services USING btree (instructor_id);

ALTER TABLE app_v3.availabilities
  ADD COLUMN court_id INTEGER;

ALTER TABLE app_v3.availabilities
  ADD CONSTRAINT availabilities_court_id_fkey
  FOREIGN KEY (court_id)
  REFERENCES app_v3.padel_club_courts(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

CREATE INDEX availabilities_court_idx ON app_v3.availabilities USING btree (court_id);

ALTER TABLE app_v3.bookings
  ADD COLUMN court_id INTEGER;

ALTER TABLE app_v3.bookings
  ADD CONSTRAINT bookings_court_id_fkey
  FOREIGN KEY (court_id)
  REFERENCES app_v3.padel_club_courts(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

CREATE INDEX bookings_court_idx ON app_v3.bookings USING btree (court_id);

CREATE TABLE app_v3.membership_plans (
  id SERIAL NOT NULL,
  organization_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR'::text,
  billing_interval app_v3."MembershipBillingInterval" NOT NULL DEFAULT 'MONTHLY'::app_v3."MembershipBillingInterval",
  trial_days INTEGER,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT membership_plans_pkey PRIMARY KEY (id)
);

CREATE INDEX membership_plans_org_idx ON app_v3.membership_plans USING btree (organization_id);
CREATE INDEX membership_plans_active_idx ON app_v3.membership_plans USING btree (is_active);

ALTER TABLE app_v3.membership_plans
  ADD CONSTRAINT membership_plans_org_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES app_v3.organizations(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

CREATE TABLE app_v3.membership_perks (
  id SERIAL NOT NULL,
  plan_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT membership_perks_pkey PRIMARY KEY (id)
);

CREATE INDEX membership_perks_plan_idx ON app_v3.membership_perks USING btree (plan_id);

ALTER TABLE app_v3.membership_perks
  ADD CONSTRAINT membership_perks_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES app_v3.membership_plans(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

CREATE TABLE app_v3.membership_subscriptions (
  id SERIAL NOT NULL,
  organization_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  user_id UUID NOT NULL,
  status app_v3."MembershipStatus" NOT NULL DEFAULT 'ACTIVE'::app_v3."MembershipStatus",
  current_period_end_at TIMESTAMPTZ(6),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT membership_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT membership_subscription_unique UNIQUE (organization_id, plan_id, user_id)
);

CREATE INDEX membership_subscriptions_org_idx ON app_v3.membership_subscriptions USING btree (organization_id);
CREATE INDEX membership_subscriptions_plan_idx ON app_v3.membership_subscriptions USING btree (plan_id);
CREATE INDEX membership_subscriptions_user_idx ON app_v3.membership_subscriptions USING btree (user_id);
CREATE INDEX membership_subscriptions_status_idx ON app_v3.membership_subscriptions USING btree (status);

ALTER TABLE app_v3.membership_subscriptions
  ADD CONSTRAINT membership_subscriptions_org_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES app_v3.organizations(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

ALTER TABLE app_v3.membership_subscriptions
  ADD CONSTRAINT membership_subscriptions_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES app_v3.membership_plans(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

ALTER TABLE app_v3.membership_subscriptions
  ADD CONSTRAINT membership_subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES app_v3.profiles(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
