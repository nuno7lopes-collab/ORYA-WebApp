-- CreateEnum
CREATE TYPE "app_v3"."CrmCustomerStatus" AS ENUM ('ACTIVE', 'SUPPRESSED', 'DELETED');

-- CreateEnum
CREATE TYPE "app_v3"."CrmInteractionType" AS ENUM ('EVENT_TICKET', 'EVENT_CHECKIN', 'PADEL_TOURNAMENT_ENTRY', 'PADEL_MATCH_PAYMENT', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'STORE_ORDER_PAID', 'STORE_ORDER_REFUNDED', 'MEMBERSHIP_STARTED', 'MEMBERSHIP_RENEWED', 'MEMBERSHIP_CANCELLED', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "app_v3"."CrmInteractionSource" AS ENUM ('EVENT', 'TICKET', 'CHECKIN', 'BOOKING', 'STORE_ORDER', 'TOURNAMENT_ENTRY', 'MEMBERSHIP', 'TRANSACTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "app_v3"."CrmSegmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "app_v3"."CrmCampaignChannel" AS ENUM ('IN_APP');

-- CreateEnum
CREATE TYPE "app_v3"."CrmCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app_v3"."CrmDeliveryStatus" AS ENUM ('SENT', 'OPENED', 'CLICKED', 'FAILED');

-- CreateEnum
CREATE TYPE "app_v3"."ConsentType" AS ENUM ('MARKETING', 'CONTACT_EMAIL', 'CONTACT_SMS', 'DATA_SHARING');

-- CreateEnum
CREATE TYPE "app_v3"."ConsentStatus" AS ENUM ('GRANTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "app_v3"."LoyaltyProgramStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "app_v3"."LoyaltyRuleTrigger" AS ENUM ('STORE_ORDER_PAID', 'BOOKING_COMPLETED', 'EVENT_CHECKIN', 'TOURNAMENT_PARTICIPATION', 'MEMBERSHIP_RENEWAL');

-- CreateEnum
CREATE TYPE "app_v3"."LoyaltyRewardType" AS ENUM ('DISCOUNT', 'FREE_CLASS', 'FREE_EVENT', 'STORE_CREDIT', 'PRODUCT', 'EARLY_ACCESS');

-- CreateEnum
CREATE TYPE "app_v3"."LoyaltyEntryType" AS ENUM ('EARN', 'SPEND', 'ADJUST', 'EXPIRE');

-- CreateEnum
CREATE TYPE "app_v3"."LoyaltySourceType" AS ENUM ('ORDER', 'BOOKING', 'CHECKIN', 'TOURNAMENT', 'MEMBERSHIP', 'REWARD', 'MANUAL');

-- AlterEnum
ALTER TYPE "app_v3"."NotificationType" ADD VALUE 'CRM_CAMPAIGN';

-- CreateTable
CREATE TABLE "app_v3"."crm_customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "app_v3"."CrmCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "display_name" TEXT,
    "contact_email" CITEXT,
    "contact_phone" TEXT,
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "marketing_opt_in_at" TIMESTAMPTZ(6),
    "first_interaction_at" TIMESTAMPTZ(6),
    "last_activity_at" TIMESTAMPTZ(6),
    "last_purchase_at" TIMESTAMPTZ(6),
    "total_spent_cents" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "total_attendances" INTEGER NOT NULL DEFAULT 0,
    "total_tournaments" INTEGER NOT NULL DEFAULT 0,
    "total_store_orders" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."crm_interactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "app_v3"."CrmInteractionType" NOT NULL,
    "source_type" "app_v3"."CrmInteractionSource" NOT NULL,
    "source_id" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "amount_cents" INTEGER,
    "currency" TEXT DEFAULT 'EUR',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."crm_customer_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "customer_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."crm_segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "status" "app_v3"."CrmSegmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "size_cache" INTEGER,
    "last_computed_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."crm_segment_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "segment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "crm_segment_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."crm_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "segment_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "app_v3"."CrmCampaignChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "app_v3"."CrmCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."crm_campaign_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_id" UUID,
    "status" "app_v3"."CrmDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "sent_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "error_code" TEXT,
    "error_message" TEXT,

    CONSTRAINT "crm_campaign_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."user_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "app_v3"."ConsentType" NOT NULL,
    "status" "app_v3"."ConsentStatus" NOT NULL,
    "source" TEXT,
    "granted_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."loyalty_programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "status" "app_v3"."LoyaltyProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL DEFAULT 'Pontos ORYA',
    "pointsName" TEXT NOT NULL DEFAULT 'Pontos',
    "points_expiry_days" INTEGER,
    "terms_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."loyalty_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "app_v3"."LoyaltyRuleTrigger" NOT NULL,
    "points" INTEGER NOT NULL,
    "max_points_per_day" INTEGER,
    "max_points_per_user" INTEGER,
    "conditions" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."loyalty_rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "app_v3"."LoyaltyRewardType" NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "stock" INTEGER,
    "payload" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."loyalty_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" INTEGER NOT NULL,
    "program_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rule_id" UUID,
    "entry_type" "app_v3"."LoyaltyEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER,
    "source_type" "app_v3"."LoyaltySourceType" NOT NULL,
    "source_id" TEXT,
    "reward_id" UUID,
    "dedupe_key" TEXT,
    "note" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_customers_org_last_activity_idx" ON "app_v3"."crm_customers"("organization_id", "last_activity_at");

-- CreateIndex
CREATE INDEX "crm_customers_org_spent_idx" ON "app_v3"."crm_customers"("organization_id", "total_spent_cents");

-- CreateIndex
CREATE UNIQUE INDEX "crm_customers_org_user_unique" ON "app_v3"."crm_customers"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "crm_interactions_org_user_time_idx" ON "app_v3"."crm_interactions"("organization_id", "user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "crm_interactions_org_type_time_idx" ON "app_v3"."crm_interactions"("organization_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "crm_interactions_source_idx" ON "app_v3"."crm_interactions"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_interactions_org_source_type_unique" ON "app_v3"."crm_interactions"("organization_id", "source_type", "source_id", "type");

-- CreateIndex
CREATE INDEX "crm_customer_notes_org_customer_idx" ON "app_v3"."crm_customer_notes"("organization_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_segments_org_status_idx" ON "app_v3"."crm_segments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "crm_segment_memberships_org_segment_idx" ON "app_v3"."crm_segment_memberships"("organization_id", "segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_segment_memberships_segment_customer_unique" ON "app_v3"."crm_segment_memberships"("segment_id", "customer_id");

-- CreateIndex
CREATE INDEX "crm_campaigns_org_status_idx" ON "app_v3"."crm_campaigns"("organization_id", "status");

-- CreateIndex
CREATE INDEX "crm_campaign_deliveries_org_campaign_idx" ON "app_v3"."crm_campaign_deliveries"("organization_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_campaign_deliveries_campaign_user_unique" ON "app_v3"."crm_campaign_deliveries"("campaign_id", "user_id");

-- CreateIndex
CREATE INDEX "user_consents_org_type_status_idx" ON "app_v3"."user_consents"("organization_id", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_org_user_type_unique" ON "app_v3"."user_consents"("organization_id", "user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_org_unique" ON "app_v3"."loyalty_programs"("organization_id");

-- CreateIndex
CREATE INDEX "loyalty_rules_program_trigger_idx" ON "app_v3"."loyalty_rules"("program_id", "trigger");

-- CreateIndex
CREATE INDEX "loyalty_rewards_program_active_idx" ON "app_v3"."loyalty_rewards"("program_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_ledger_dedupe_key_key" ON "app_v3"."loyalty_ledger"("dedupe_key");

-- CreateIndex
CREATE INDEX "loyalty_ledger_org_user_time_idx" ON "app_v3"."loyalty_ledger"("organization_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_ledger_program_time_idx" ON "app_v3"."loyalty_ledger"("program_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_ledger_program_rule_idx" ON "app_v3"."loyalty_ledger"("program_id", "rule_id");

-- CreateIndex
CREATE INDEX "loyalty_ledger_source_idx" ON "app_v3"."loyalty_ledger"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "app_v3"."crm_customers" ADD CONSTRAINT "crm_customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_customers" ADD CONSTRAINT "crm_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_interactions" ADD CONSTRAINT "crm_interactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_interactions" ADD CONSTRAINT "crm_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_customer_notes" ADD CONSTRAINT "crm_customer_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_customer_notes" ADD CONSTRAINT "crm_customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app_v3"."crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_customer_notes" ADD CONSTRAINT "crm_customer_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_segments" ADD CONSTRAINT "crm_segments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_segments" ADD CONSTRAINT "crm_segments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_segment_memberships" ADD CONSTRAINT "crm_segment_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_segment_memberships" ADD CONSTRAINT "crm_segment_memberships_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "app_v3"."crm_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_segment_memberships" ADD CONSTRAINT "crm_segment_memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app_v3"."crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_campaigns" ADD CONSTRAINT "crm_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_campaigns" ADD CONSTRAINT "crm_campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "app_v3"."crm_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_campaigns" ADD CONSTRAINT "crm_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_campaign_deliveries" ADD CONSTRAINT "crm_campaign_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_campaign_deliveries" ADD CONSTRAINT "crm_campaign_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "app_v3"."crm_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_campaign_deliveries" ADD CONSTRAINT "crm_campaign_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."crm_campaign_deliveries" ADD CONSTRAINT "crm_campaign_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "app_v3"."notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."user_consents" ADD CONSTRAINT "user_consents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_programs" ADD CONSTRAINT "loyalty_programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_rules" ADD CONSTRAINT "loyalty_rules_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "app_v3"."loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "app_v3"."loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "app_v3"."loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "app_v3"."loyalty_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "app_v3"."loyalty_rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
