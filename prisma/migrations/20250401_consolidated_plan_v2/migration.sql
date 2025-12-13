-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app_v3";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "app_v3"."NotificationType" AS ENUM ('ORGANIZER_INVITE', 'ORGANIZER_TRANSFER', 'STAFF_INVITE', 'STAFF_ROLE_CHANGE', 'EVENT_SALE', 'EVENT_PAYOUT_STATUS', 'STRIPE_STATUS', 'FRIEND_REQUEST', 'FRIEND_ACCEPT', 'EVENT_REMINDER', 'CHECKIN_READY', 'TICKET_SHARED', 'MARKETING_PROMO_ALERT', 'SYSTEM_ANNOUNCE');

-- CreateEnum
CREATE TYPE "app_v3"."NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "app_v3"."OrganizerMemberRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CHECKIN_ONLY');

-- CreateEnum
CREATE TYPE "app_v3"."PadelPreferredSide" AS ENUM ('ESQUERDA', 'DIREITA', 'QUALQUER');

-- CreateEnum
CREATE TYPE "app_v3"."OrganizerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "app_v3"."EventType" AS ENUM ('EXPERIENCE', 'ORGANIZER_EVENT');

-- CreateEnum
CREATE TYPE "app_v3"."Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "app_v3"."EventCategoryType" AS ENUM ('FESTA', 'DESPORTO', 'CONCERTO', 'PALESTRA', 'ARTE', 'COMIDA', 'DRINKS');

-- CreateEnum
CREATE TYPE "app_v3"."EventTemplateType" AS ENUM ('PARTY', 'SPORT', 'PADEL', 'VOLUNTEERING', 'TALK', 'OTHER');

-- CreateEnum
CREATE TYPE "app_v3"."OrganizationKind" AS ENUM ('CLUBE_PADEL', 'RESTAURANTE', 'EMPRESA_EVENTOS', 'ASSOCIACAO', 'PESSOA_SINGULAR');

-- CreateEnum
CREATE TYPE "app_v3"."EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED');

-- CreateEnum
CREATE TYPE "app_v3"."ResaleMode" AS ENUM ('ALWAYS', 'AFTER_SOLD_OUT', 'DISABLED');

-- CreateEnum
CREATE TYPE "app_v3"."PadelFormat" AS ENUM ('TODOS_CONTRA_TODOS', 'QUADRO_ELIMINATORIO', 'GRUPOS_ELIMINATORIAS', 'CAMPEONATO_LIGA', 'QUADRO_AB', 'NON_STOP');

-- CreateEnum
CREATE TYPE "app_v3"."RefundFeePayer" AS ENUM ('ORGANIZER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "app_v3"."PadelPaymentMode" AS ENUM ('FULL', 'SPLIT');

-- CreateEnum
CREATE TYPE "app_v3"."PadelPairingStatus" AS ENUM ('INCOMPLETE', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app_v3"."PadelPairingSlotStatus" AS ENUM ('PENDING', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app_v3"."PadelPairingPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "app_v3"."PadelPairingSlotRole" AS ENUM ('CAPTAIN', 'PARTNER');

-- CreateEnum
CREATE TYPE "app_v3"."PadelMatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app_v3"."FeeMode" AS ENUM ('INCLUDED', 'ADDED', 'ON_TOP');

-- CreateEnum
CREATE TYPE "app_v3"."PayoutMode" AS ENUM ('ORGANIZER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "app_v3"."PromoType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "app_v3"."TicketTypeStatus" AS ENUM ('ON_SALE', 'UPCOMING', 'CLOSED', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "app_v3"."TicketStatus" AS ENUM ('ACTIVE', 'USED', 'REFUNDED', 'TRANSFERRED', 'RESALE_LISTED');

-- CreateEnum
CREATE TYPE "app_v3"."ReservationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "app_v3"."StaffScope" AS ENUM ('GLOBAL', 'EVENT');

-- CreateEnum
CREATE TYPE "app_v3"."StaffRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CHECKIN');

-- CreateEnum
CREATE TYPE "app_v3"."StaffStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "app_v3"."TransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app_v3"."ResaleStatus" AS ENUM ('LISTED', 'SOLD', 'CANCELLED');

-- CreateTable
CREATE TABLE "app_v3"."profiles" (
    "id" UUID NOT NULL,
    "username" CITEXT,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "city" TEXT,
    "favourite_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboarding_done" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT[] DEFAULT ARRAY['user']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allow_email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "allow_event_reminders" BOOLEAN NOT NULL DEFAULT true,
    "allow_friend_requests" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(6),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "app_v3"."Visibility" NOT NULL DEFAULT 'PUBLIC',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "contact_phone" TEXT,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."organizers" (
    "id" SERIAL NOT NULL,
    "display_name" TEXT NOT NULL,
    "username" CITEXT,
    "stripe_account_id" TEXT,
    "status" "app_v3"."OrganizerStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID,
    "fee_mode" "app_v3"."FeeMode" NOT NULL DEFAULT 'ADDED',
    "platform_fee_bps" INTEGER NOT NULL DEFAULT 200,
    "platform_fee_fixed_cents" INTEGER NOT NULL DEFAULT 0,
    "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "entity_type" TEXT,
    "business_name" TEXT,
    "public_name" TEXT,
    "city" TEXT,
    "address" TEXT,
    "show_address_publicly" BOOLEAN NOT NULL DEFAULT false,
    "payout_iban" TEXT,
    "language" TEXT DEFAULT 'pt',
    "public_listing_enabled" BOOLEAN NOT NULL DEFAULT true,
    "alerts_email" TEXT,
    "alerts_sales_enabled" BOOLEAN NOT NULL DEFAULT true,
    "alerts_payout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "refund_fee_payer" "app_v3"."RefundFeePayer" NOT NULL DEFAULT 'CUSTOMER',
    "branding_avatar_url" TEXT,
    "branding_primary_color" TEXT,
    "branding_secondary_color" TEXT,
    "organization_kind" "app_v3"."OrganizationKind" NOT NULL DEFAULT 'PESSOA_SINGULAR',
    "padel_default_short_name" TEXT,
    "padel_default_city" TEXT,
    "padel_default_address" TEXT,
    "padel_default_courts" INTEGER NOT NULL DEFAULT 0,
    "padel_default_hours" TEXT,
    "padel_default_rule_set_id" INTEGER,
    "padel_favorite_categories" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "organizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."global_usernames" (
    "username" CITEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_usernames_pkey" PRIMARY KEY ("username")
);

-- CreateTable
CREATE TABLE "app_v3"."notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "app_v3"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "cta_url" TEXT,
    "cta_label" TEXT,
    "priority" "app_v3"."NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "read_at" TIMESTAMP(3),
    "seen_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."notification_preferences" (
    "userId" UUID NOT NULL,
    "allow_email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "allow_event_reminders" BOOLEAN NOT NULL DEFAULT true,
    "allow_friend_requests" BOOLEAN NOT NULL DEFAULT true,
    "allow_sales_alerts" BOOLEAN NOT NULL DEFAULT true,
    "allow_system_announcements" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "app_v3"."organizer_members" (
    "id" UUID NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "app_v3"."OrganizerMemberRole" NOT NULL,
    "invited_by_user_id" UUID,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizer_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."organizer_member_invites" (
    "id" UUID NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "target_identifier" CITEXT NOT NULL,
    "target_user_id" UUID,
    "role" "app_v3"."OrganizerMemberRole" NOT NULL,
    "token" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizer_member_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."events" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "app_v3"."EventType" NOT NULL DEFAULT 'EXPERIENCE',
    "template_type" "app_v3"."EventTemplateType",
    "organizer_id" INTEGER,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "location_name" TEXT NOT NULL,
    "location_city" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "status" "app_v3"."EventStatus" NOT NULL DEFAULT 'DRAFT',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Lisbon',
    "cover_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "resale_mode" "app_v3"."ResaleMode" NOT NULL DEFAULT 'ALWAYS',
    "fee_mode_override" "app_v3"."FeeMode",
    "platform_fee_bps_override" INTEGER,
    "platform_fee_fixed_cents_override" INTEGER,
    "fee_mode" "app_v3"."FeeMode" NOT NULL DEFAULT 'INCLUDED',
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "payout_mode" "app_v3"."PayoutMode" NOT NULL DEFAULT 'ORGANIZER',

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."event_categories" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "category" "app_v3"."EventCategoryType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."ticket_types" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "total_quantity" INTEGER,
    "sold_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "app_v3"."TicketTypeStatus" NOT NULL DEFAULT 'ON_SALE',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."tickets" (
    "id" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "ticket_type_id" INTEGER NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "app_v3"."TicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "qr_secret" TEXT NOT NULL,
    "rotating_seed" UUID,
    "price_paid" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "stripe_payment_intent_id" TEXT,
    "used_at" TIMESTAMP(3),
    "user_id" UUID,
    "platform_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "total_paid_cents" INTEGER NOT NULL DEFAULT 0,
    "pairing_id" INTEGER,
    "padel_split_share_cents" INTEGER,
    "padel_pairing_version" INTEGER,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."guest_ticket_links" (
    "ticket_id" TEXT NOT NULL,
    "guest_email" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT,
    "migrated_to_user_id" UUID,
    "migrated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_ticket_links_pkey" PRIMARY KEY ("ticket_id")
);

-- CreateTable
CREATE TABLE "app_v3"."ticket_reservations" (
    "id" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "ticket_type_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "app_v3"."ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID,

    CONSTRAINT "ticket_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."experience_participants" (
    "id" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "volunteer_minutes" INTEGER,

    CONSTRAINT "experience_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."event_interests" (
    "id" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,

    CONSTRAINT "event_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."staff_assignments" (
    "id" SERIAL NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "scope" "app_v3"."StaffScope" NOT NULL,
    "event_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "user_id" UUID NOT NULL,
    "accepted_at" TIMESTAMP(6),
    "status" "app_v3"."StaffStatus" NOT NULL DEFAULT 'PENDING',
    "role" "app_v3"."StaffRole" NOT NULL DEFAULT 'STAFF',

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."ticket_transfers" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "status" "app_v3"."TransferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,

    CONSTRAINT "ticket_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."ticket_resales" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "app_v3"."ResaleStatus" NOT NULL DEFAULT 'LISTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "seller_user_id" UUID NOT NULL,

    CONSTRAINT "ticket_resales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."event_views" (
    "id" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,

    CONSTRAINT "event_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."event_sales_agg" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tickets_sold" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_sales_agg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."payment_events" (
    "id" SERIAL NOT NULL,
    "stripe_payment_intent_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "event_id" INTEGER,
    "user_id" UUID,
    "amount_cents" INTEGER,
    "platform_fee_cents" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."platform_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."promo_codes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "app_v3"."PromoType" NOT NULL,
    "value" INTEGER NOT NULL,
    "max_uses" INTEGER,
    "per_user_limit" INTEGER,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "event_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_apply" BOOLEAN DEFAULT false,
    "min_quantity" INTEGER,
    "min_total_cents" INTEGER,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."promo_redemptions" (
    "id" SERIAL NOT NULL,
    "promo_code_id" INTEGER NOT NULL,
    "user_id" UUID,
    "guest_email" TEXT,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_player_profiles" (
    "id" SERIAL NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "user_id" UUID,
    "display_name" TEXT,
    "full_name" TEXT NOT NULL,
    "email" CITEXT,
    "phone" TEXT,
    "gender" TEXT,
    "level" TEXT,
    "preferred_side" "app_v3"."PadelPreferredSide",
    "club_name" TEXT,
    "birth_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_clubs" (
    "id" SERIAL NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "city" TEXT,
    "address" TEXT,
    "courts_count" INTEGER NOT NULL DEFAULT 1,
    "hours" TEXT,
    "favorite_category_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "slug" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_club_courts" (
    "id" SERIAL NOT NULL,
    "padel_club_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "surface" TEXT,
    "indoor" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_club_courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_club_staff" (
    "id" SERIAL NOT NULL,
    "padel_club_id" INTEGER NOT NULL,
    "user_id" UUID,
    "email" CITEXT,
    "role" TEXT NOT NULL,
    "inherit_to_events" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_club_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_categories" (
    "id" SERIAL NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "gender_restriction" TEXT,
    "min_level" TEXT,
    "max_level" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "season" TEXT,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_rule_sets" (
    "id" SERIAL NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tie_break_rules" JSONB NOT NULL DEFAULT '{}',
    "points_table" JSONB NOT NULL DEFAULT '{}',
    "enabled_formats" TEXT[] DEFAULT ARRAY['TODOS_CONTRA_TODOS', 'QUADRO_ELIMINATORIO']::TEXT[],
    "season" TEXT,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_tournament_configs" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "padel_club_id" INTEGER,
    "partner_club_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "format" "app_v3"."PadelFormat" NOT NULL,
    "number_of_courts" INTEGER NOT NULL DEFAULT 1,
    "club_hours" TEXT,
    "rule_set_id" INTEGER,
    "default_category_id" INTEGER,
    "enabled_formats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "padel_v2_enabled" BOOLEAN NOT NULL DEFAULT false,
    "advanced_settings" JSONB,
    "split_deadline_hours" INTEGER,
    "auto_cancel_unpaid" BOOLEAN NOT NULL DEFAULT true,
    "allow_captain_assume" BOOLEAN NOT NULL DEFAULT true,
    "default_payment_mode" "app_v3"."PadelPaymentMode",
    "refund_fee_payer" "app_v3"."RefundFeePayer",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_tournament_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_pairings" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "paymentMode" "app_v3"."PadelPaymentMode" NOT NULL,
    "pairing_status" "app_v3"."PadelPairingStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "created_by_user_id" UUID,
    "created_by_ticket_id" TEXT,
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "is_public_open" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_pairing_slots" (
    "id" SERIAL NOT NULL,
    "pairing_id" INTEGER NOT NULL,
    "ticket_id" TEXT,
    "profile_id" UUID,
    "player_profile_id" INTEGER,
    "slotRole" "app_v3"."PadelPairingSlotRole" NOT NULL,
    "slot_status" "app_v3"."PadelPairingSlotStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "app_v3"."PadelPairingPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "invited_contact" TEXT,
    "is_public_open" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_pairing_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_teams" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "player1_id" INTEGER,
    "player2_id" INTEGER,
    "is_from_matchmaking" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_matches" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "court_number" INTEGER,
    "court_name" TEXT,
    "start_time" TIMESTAMP(3),
    "round_label" TEXT,
    "team_a_id" INTEGER,
    "team_b_id" INTEGER,
    "score" JSONB NOT NULL DEFAULT '{}',
    "score_sets" JSONB,
    "pairing_a_id" INTEGER,
    "pairing_b_id" INTEGER,
    "winner_pairing_id" INTEGER,
    "group_label" TEXT,
    "round_type" TEXT,
    "status" "app_v3"."PadelMatchStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."padel_ranking_entries" (
    "id" SERIAL NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "player_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER,
    "level" TEXT,
    "season" TEXT,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "padel_ranking_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_v3"."follows" (
    "id" SERIAL NOT NULL,
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "app_v3"."profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "organizers_username_key" ON "app_v3"."organizers"("username");

-- CreateIndex
CREATE INDEX "organizers_user_id_idx" ON "app_v3"."organizers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_usernames_owner_type_owner_id_key" ON "app_v3"."global_usernames"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "notifications_userId_created_at_idx" ON "app_v3"."notifications"("userId", "created_at");

-- CreateIndex
CREATE INDEX "notifications_userId_read_at_idx" ON "app_v3"."notifications"("userId", "read_at");

-- CreateIndex
CREATE INDEX "organizer_members_user_id_idx" ON "app_v3"."organizer_members"("user_id");

-- CreateIndex
CREATE INDEX "organizer_members_organizer_id_role_idx" ON "app_v3"."organizer_members"("organizer_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_members_organizer_id_user_id_key" ON "app_v3"."organizer_members"("organizer_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_member_invites_token_key" ON "app_v3"."organizer_member_invites"("token");

-- CreateIndex
CREATE INDEX "organizer_member_invites_organizer_id_idx" ON "app_v3"."organizer_member_invites"("organizer_id");

-- CreateIndex
CREATE INDEX "organizer_member_invites_target_user_id_idx" ON "app_v3"."organizer_member_invites"("target_user_id");

-- CreateIndex
CREATE INDEX "organizer_member_invites_target_identifier_idx" ON "app_v3"."organizer_member_invites"("target_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "app_v3"."events"("slug");

-- CreateIndex
CREATE INDEX "events_type_status_idx" ON "app_v3"."events"("type", "status");

-- CreateIndex
CREATE INDEX "events_owner_user_id_idx" ON "app_v3"."events"("owner_user_id");

-- CreateIndex
CREATE INDEX "events_owner_user_id_starts_at_idx" ON "app_v3"."events"("owner_user_id", "starts_at");

-- CreateIndex
CREATE INDEX "events_organizer_id_idx" ON "app_v3"."events"("organizer_id");

-- CreateIndex
CREATE INDEX "event_categories_category_idx" ON "app_v3"."event_categories"("category");

-- CreateIndex
CREATE UNIQUE INDEX "event_categories_unique" ON "app_v3"."event_categories"("event_id", "category");

-- CreateIndex
CREATE INDEX "ticket_types_eventId_idx" ON "app_v3"."ticket_types"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qr_secret_key" ON "app_v3"."tickets"("qr_secret");

-- CreateIndex
CREATE INDEX "tickets_eventId_idx" ON "app_v3"."tickets"("eventId");

-- CreateIndex
CREATE INDEX "tickets_user_id_idx" ON "app_v3"."tickets"("user_id");

-- CreateIndex
CREATE INDEX "tickets_ticket_type_id_idx" ON "app_v3"."tickets"("ticket_type_id");

-- CreateIndex
CREATE INDEX "tickets_stripe_payment_intent_id_idx" ON "app_v3"."tickets"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "tickets_pairing_id_idx" ON "app_v3"."tickets"("pairing_id");

-- CreateIndex
CREATE INDEX "guest_ticket_links_migrated_idx" ON "app_v3"."guest_ticket_links"("migrated_to_user_id");

-- CreateIndex
CREATE INDEX "ticket_reservations_eventId_idx" ON "app_v3"."ticket_reservations"("eventId");

-- CreateIndex
CREATE INDEX "ticket_reservations_ticket_type_id_idx" ON "app_v3"."ticket_reservations"("ticket_type_id");

-- CreateIndex
CREATE INDEX "ticket_reservations_user_id_idx" ON "app_v3"."ticket_reservations"("user_id");

-- CreateIndex
CREATE INDEX "ticket_reservations_status_expires_at_idx" ON "app_v3"."ticket_reservations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "experience_participants_userId_idx" ON "app_v3"."experience_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "experience_participants_eventId_userId_key" ON "app_v3"."experience_participants"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_interests_userId_idx" ON "app_v3"."event_interests"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_interests_eventId_userId_key" ON "app_v3"."event_interests"("eventId", "userId");

-- CreateIndex
CREATE INDEX "staff_assignments_organizer_id_idx" ON "app_v3"."staff_assignments"("organizer_id");

-- CreateIndex
CREATE INDEX "staff_assignments_user_id_idx" ON "app_v3"."staff_assignments"("user_id");

-- CreateIndex
CREATE INDEX "staff_assignments_event_id_idx" ON "app_v3"."staff_assignments"("event_id");

-- CreateIndex
CREATE INDEX "ticket_transfers_ticket_id_idx" ON "app_v3"."ticket_transfers"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_transfers_from_user_id_idx" ON "app_v3"."ticket_transfers"("from_user_id");

-- CreateIndex
CREATE INDEX "ticket_transfers_to_user_id_idx" ON "app_v3"."ticket_transfers"("to_user_id");

-- CreateIndex
CREATE INDEX "ticket_resales_ticket_id_idx" ON "app_v3"."ticket_resales"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_resales_seller_user_id_idx" ON "app_v3"."ticket_resales"("seller_user_id");

-- CreateIndex
CREATE INDEX "event_views_eventId_idx" ON "app_v3"."event_views"("eventId");

-- CreateIndex
CREATE INDEX "event_views_userId_idx" ON "app_v3"."event_views"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_sales_agg_eventId_key" ON "app_v3"."event_sales_agg"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_stripe_payment_intent_id_key" ON "app_v3"."payment_events"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payment_events_stripe_payment_intent_id_idx" ON "app_v3"."payment_events"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payment_events_event_id_idx" ON "app_v3"."payment_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_idx" ON "app_v3"."platform_settings"("key");

-- CreateIndex
CREATE INDEX "promo_codes_event_id_idx" ON "app_v3"."promo_codes"("event_id");

-- CreateIndex
CREATE INDEX "promo_codes_event_active_idx" ON "app_v3"."promo_codes"("event_id", "active");

-- CreateIndex
CREATE INDEX "promo_codes_valid_idx" ON "app_v3"."promo_codes"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "promo_redemptions_code_idx" ON "app_v3"."promo_redemptions"("promo_code_id");

-- CreateIndex
CREATE INDEX "promo_redemptions_promo_idx" ON "app_v3"."promo_redemptions"("promo_code_id");

-- CreateIndex
CREATE INDEX "promo_redemptions_user_idx" ON "app_v3"."promo_redemptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "padel_player_profiles_uniq_email" ON "app_v3"."padel_player_profiles"("organizer_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "padel_clubs_slug_key" ON "app_v3"."padel_clubs"("slug");

-- CreateIndex
CREATE INDEX "padel_clubs_organizer_id_idx" ON "app_v3"."padel_clubs"("organizer_id");

-- CreateIndex
CREATE INDEX "padel_club_courts_padel_club_id_idx" ON "app_v3"."padel_club_courts"("padel_club_id");

-- CreateIndex
CREATE INDEX "padel_club_staff_padel_club_id_idx" ON "app_v3"."padel_club_staff"("padel_club_id");

-- CreateIndex
CREATE INDEX "padel_tournament_configs_padel_club_id_idx" ON "app_v3"."padel_tournament_configs"("padel_club_id");

-- CreateIndex
CREATE UNIQUE INDEX "padel_tournament_configs_event_id_key" ON "app_v3"."padel_tournament_configs"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "padel_pairings_invite_token_key" ON "app_v3"."padel_pairings"("invite_token");

-- CreateIndex
CREATE INDEX "padel_pairings_event_id_idx" ON "app_v3"."padel_pairings"("event_id");

-- CreateIndex
CREATE INDEX "padel_pairings_organizer_id_idx" ON "app_v3"."padel_pairings"("organizer_id");

-- CreateIndex
CREATE INDEX "padel_pairings_category_id_idx" ON "app_v3"."padel_pairings"("category_id");

-- CreateIndex
CREATE INDEX "padel_pairing_slots_pairing_id_idx" ON "app_v3"."padel_pairing_slots"("pairing_id");

-- CreateIndex
CREATE INDEX "padel_pairing_slots_profile_id_idx" ON "app_v3"."padel_pairing_slots"("profile_id");

-- CreateIndex
CREATE INDEX "padel_pairing_slots_player_profile_id_idx" ON "app_v3"."padel_pairing_slots"("player_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "padel_pairing_slots_ticket_id_key" ON "app_v3"."padel_pairing_slots"("ticket_id");

-- CreateIndex
CREATE INDEX "idx_follows_follower" ON "app_v3"."follows"("follower_id");

-- CreateIndex
CREATE INDEX "idx_follows_following" ON "app_v3"."follows"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_unique" ON "app_v3"."follows"("follower_id", "following_id");

-- AddForeignKey
ALTER TABLE "app_v3"."organizers" ADD CONSTRAINT "organizers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_v3"."organizers" ADD CONSTRAINT "organizers_padel_default_rule_set_id_fkey" FOREIGN KEY ("padel_default_rule_set_id") REFERENCES "app_v3"."padel_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."organizer_members" ADD CONSTRAINT "organizer_members_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."organizer_members" ADD CONSTRAINT "organizer_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."organizer_member_invites" ADD CONSTRAINT "organizer_member_invites_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."organizer_member_invites" ADD CONSTRAINT "organizer_member_invites_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."organizer_member_invites" ADD CONSTRAINT "organizer_member_invites_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."events" ADD CONSTRAINT "events_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."event_categories" ADD CONSTRAINT "event_categories_event_fk" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_v3"."ticket_types" ADD CONSTRAINT "ticket_types_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."tickets" ADD CONSTRAINT "tickets_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "app_v3"."padel_pairings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."tickets" ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "app_v3"."ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."guest_ticket_links" ADD CONSTRAINT "guest_ticket_links_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "app_v3"."tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_v3"."ticket_reservations" ADD CONSTRAINT "ticket_reservations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."ticket_reservations" ADD CONSTRAINT "ticket_reservations_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "app_v3"."ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."experience_participants" ADD CONSTRAINT "experience_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."event_interests" ADD CONSTRAINT "event_interests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."staff_assignments" ADD CONSTRAINT "staff_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."staff_assignments" ADD CONSTRAINT "staff_assignments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."ticket_transfers" ADD CONSTRAINT "ticket_transfers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "app_v3"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."ticket_resales" ADD CONSTRAINT "ticket_resales_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "app_v3"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."event_views" ADD CONSTRAINT "event_views_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."event_sales_agg" ADD CONSTRAINT "event_sales_agg_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."promo_codes" ADD CONSTRAINT "promo_codes_event_fk" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_v3"."promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "app_v3"."promo_codes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_player_profiles" ADD CONSTRAINT "padel_player_profiles_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_clubs" ADD CONSTRAINT "padel_clubs_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_club_courts" ADD CONSTRAINT "padel_club_courts_padel_club_id_fkey" FOREIGN KEY ("padel_club_id") REFERENCES "app_v3"."padel_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_club_staff" ADD CONSTRAINT "padel_club_staff_padel_club_id_fkey" FOREIGN KEY ("padel_club_id") REFERENCES "app_v3"."padel_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_categories" ADD CONSTRAINT "padel_categories_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_rule_sets" ADD CONSTRAINT "padel_rule_sets_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_tournament_configs" ADD CONSTRAINT "padel_tournament_configs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_tournament_configs" ADD CONSTRAINT "padel_tournament_configs_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_tournament_configs" ADD CONSTRAINT "padel_tournament_configs_padel_club_id_fkey" FOREIGN KEY ("padel_club_id") REFERENCES "app_v3"."padel_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_tournament_configs" ADD CONSTRAINT "padel_tournament_configs_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "app_v3"."padel_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_tournament_configs" ADD CONSTRAINT "padel_tournament_configs_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "app_v3"."padel_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairings" ADD CONSTRAINT "padel_pairings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairings" ADD CONSTRAINT "padel_pairings_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairings" ADD CONSTRAINT "padel_pairings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "app_v3"."padel_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairings" ADD CONSTRAINT "padel_pairings_created_by_ticket_id_fkey" FOREIGN KEY ("created_by_ticket_id") REFERENCES "app_v3"."tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairing_slots" ADD CONSTRAINT "padel_pairing_slots_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "app_v3"."padel_pairings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairing_slots" ADD CONSTRAINT "padel_pairing_slots_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "app_v3"."tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairing_slots" ADD CONSTRAINT "padel_pairing_slots_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_pairing_slots" ADD CONSTRAINT "padel_pairing_slots_player_profile_id_fkey" FOREIGN KEY ("player_profile_id") REFERENCES "app_v3"."padel_player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_teams" ADD CONSTRAINT "padel_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_teams" ADD CONSTRAINT "padel_teams_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "app_v3"."padel_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_teams" ADD CONSTRAINT "padel_teams_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "app_v3"."padel_player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_teams" ADD CONSTRAINT "padel_teams_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "app_v3"."padel_player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_matches" ADD CONSTRAINT "padel_matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_matches" ADD CONSTRAINT "padel_matches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "app_v3"."padel_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_matches" ADD CONSTRAINT "padel_matches_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "app_v3"."padel_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_matches" ADD CONSTRAINT "padel_matches_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "app_v3"."padel_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_matches" ADD CONSTRAINT "padel_matches_pairing_a_id_fkey" FOREIGN KEY ("pairing_a_id") REFERENCES "app_v3"."padel_pairings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_matches" ADD CONSTRAINT "padel_matches_pairing_b_id_fkey" FOREIGN KEY ("pairing_b_id") REFERENCES "app_v3"."padel_pairings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_matches" ADD CONSTRAINT "padel_matches_winner_pairing_id_fkey" FOREIGN KEY ("winner_pairing_id") REFERENCES "app_v3"."padel_pairings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_ranking_entries" ADD CONSTRAINT "padel_ranking_entries_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_ranking_entries" ADD CONSTRAINT "padel_ranking_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "app_v3"."padel_player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."padel_ranking_entries" ADD CONSTRAINT "padel_ranking_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_v3"."follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_v3"."follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

