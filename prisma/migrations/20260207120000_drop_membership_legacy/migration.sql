-- Drop legacy org billing fields and membership/segment membership tables

-- Remove unused organization Stripe linkage + LiveHub premium flag
DROP INDEX IF EXISTS app_v3.organizations_stripe_customer_idx;
DROP INDEX IF EXISTS app_v3.organizations_stripe_subscription_idx;
ALTER TABLE app_v3.organizations
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS live_hub_premium_enabled;

-- Remove unused service membership requirement
ALTER TABLE app_v3.services
  DROP COLUMN IF EXISTS required_membership_plan_ids;

-- Drop unused CRM segment membership cache
DROP TABLE IF EXISTS app_v3.crm_segment_memberships;

-- Drop unused membership tables (order matters)
DROP TABLE IF EXISTS app_v3.membership_perks;
DROP TABLE IF EXISTS app_v3.membership_subscriptions;
DROP TABLE IF EXISTS app_v3.membership_plans;

-- Drop unused enums
DROP TYPE IF EXISTS "app_v3"."MembershipBillingInterval";
DROP TYPE IF EXISTS "app_v3"."MembershipStatus";
