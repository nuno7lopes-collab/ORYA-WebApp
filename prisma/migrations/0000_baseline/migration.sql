-- Baseline schema for app_v3 (generated from production).
CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE SCHEMA IF NOT EXISTS "auth";
-- Ensure Supabase roles exist in shadow DB for RLS policies.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END
$$;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "extensions";
-- Minimal auth.users for shadow DB + foreign key targets.
CREATE TABLE IF NOT EXISTS "auth"."users" (
    id uuid NOT NULL,
    email character varying(255),
    CONSTRAINT users_pkey PRIMARY KEY (id)
);
-- Stub auth.uid() for shadow DB policy checks.
CREATE OR REPLACE FUNCTION "auth"."uid"()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid;
$$;
-- Stub auth.jwt() for shadow DB policy checks.
CREATE OR REPLACE FUNCTION "auth"."jwt"()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT '{}'::jsonb;
$$;
CREATE SCHEMA IF NOT EXISTS "app_v3";
CREATE TYPE app_v3."AccountStatus" AS ENUM (
    'ACTIVE',
    'PENDING_DELETE',
    'DELETED'
);
CREATE TYPE app_v3."AvailabilityStatus" AS ENUM (
    'OPEN',
    'FULL',
    'CANCELLED'
);
CREATE TYPE app_v3."BookingStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED'
);
CREATE TYPE app_v3."EventInviteScope" AS ENUM (
    'PUBLIC',
    'PARTICIPANT'
);
CREATE TYPE app_v3."EventParticipantAccessMode" AS ENUM (
    'NONE',
    'TICKET',
    'INSCRIPTION',
    'INVITE'
);
CREATE TYPE app_v3."EventPublicAccessMode" AS ENUM (
    'OPEN',
    'TICKET',
    'INVITE'
);
CREATE TYPE app_v3."EventStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'CANCELLED',
    'FINISHED',
    'DATE_CHANGED'
);
CREATE TYPE app_v3."EventTemplateType" AS ENUM (
    'PARTY',
    'PADEL',
    'VOLUNTEERING',
    'TALK',
    'OTHER'
);
CREATE TYPE app_v3."EventType" AS ENUM (
    'ORGANIZATION_EVENT'
);
CREATE TYPE app_v3."FeeMode" AS ENUM (
    'INCLUDED',
    'ADDED',
    'ON_TOP'
);
CREATE TYPE app_v3."Gender" AS ENUM (
    'MALE',
    'FEMALE'
);
CREATE TYPE app_v3."LiveHubVisibility" AS ENUM (
    'PUBLIC',
    'PRIVATE',
    'DISABLED'
);
CREATE TYPE app_v3."NotificationPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH'
);
CREATE TYPE app_v3."NotificationType" AS ENUM (
    'ORGANIZATION_INVITE',
    'ORGANIZATION_TRANSFER',
    'STAFF_INVITE',
    'STAFF_ROLE_CHANGE',
    'EVENT_SALE',
    'EVENT_PAYOUT_STATUS',
    'STRIPE_STATUS',
    'FRIEND_REQUEST',
    'FRIEND_ACCEPT',
    'EVENT_REMINDER',
    'CHECKIN_READY',
    'TICKET_SHARED',
    'MARKETING_PROMO_ALERT',
    'SYSTEM_ANNOUNCE',
    'FOLLOWED_YOU',
    'TICKET_TRANSFER_RECEIVED',
    'TICKET_TRANSFER_ACCEPTED',
    'TICKET_TRANSFER_DECLINED',
    'CLUB_INVITE',
    'NEW_EVENT_FROM_FOLLOWED_ORGANIZATION'
);
CREATE TYPE app_v3."OperationStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'DEAD_LETTER'
);
CREATE TYPE app_v3."OrgType" AS ENUM (
    'PLATFORM',
    'EXTERNAL'
);
CREATE TYPE app_v3."OrganizationCategory" AS ENUM (
    'EVENTOS',
    'PADEL',
    'RESERVAS',
    'CLUBS'
);
CREATE TYPE app_v3."OrganizationFormFieldType" AS ENUM (
    'TEXT',
    'TEXTAREA',
    'EMAIL',
    'PHONE',
    'NUMBER',
    'DATE',
    'SELECT',
    'CHECKBOX'
);
CREATE TYPE app_v3."OrganizationFormStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);
CREATE TYPE app_v3."OrganizationFormSubmissionStatus" AS ENUM (
    'SUBMITTED',
    'IN_REVIEW',
    'ACCEPTED',
    'WAITLISTED',
    'INVITED',
    'REJECTED'
);
CREATE TYPE app_v3."OrganizationKind" AS ENUM (
    'CLUBE_PADEL',
    'RESTAURANTE',
    'EMPRESA_EVENTOS',
    'ASSOCIACAO',
    'PESSOA_SINGULAR'
);
CREATE TYPE app_v3."OrganizationModule" AS ENUM (
    'INSCRICOES'
);
CREATE TYPE app_v3."OrganizationPolicyType" AS ENUM (
    'FLEXIBLE',
    'MODERATE',
    'RIGID',
    'CUSTOM'
);
CREATE TYPE app_v3."OrganizationReviewStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);
CREATE TYPE app_v3."OrganizationEmailRequestStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED'
);
CREATE TYPE app_v3."OrganizationMemberRole" AS ENUM (
    'OWNER',
    'CO_OWNER',
    'ADMIN',
    'STAFF',
    'VIEWER',
    'PROMOTER'
);
CREATE TYPE app_v3."OrganizationOwnerTransferStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED'
);
CREATE TYPE app_v3."OrganizationStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED'
);
CREATE TYPE app_v3."PadelEligibilityType" AS ENUM (
    'OPEN',
    'MALE_ONLY',
    'FEMALE_ONLY',
    'MIXED'
);
CREATE TYPE app_v3."PadelPairingGuaranteeStatus" AS ENUM (
    'NONE',
    'ARMED',
    'SCHEDULED',
    'SUCCEEDED',
    'REQUIRES_ACTION',
    'FAILED',
    'EXPIRED'
);
CREATE TYPE app_v3."PadelPairingHoldStatus" AS ENUM (
    'ACTIVE',
    'CANCELLED',
    'EXPIRED'
);
CREATE TYPE app_v3."PadelPairingJoinMode" AS ENUM (
    'INVITE_PARTNER',
    'LOOKING_FOR_PARTNER'
);
CREATE TYPE app_v3."PadelPairingLifecycleStatus" AS ENUM (
    'PENDING_ONE_PAID',
    'PENDING_PARTNER_PAYMENT',
    'CONFIRMED_BOTH_PAID',
    'CONFIRMED_CAPTAIN_FULL',
    'CANCELLED_INCOMPLETE'
);
CREATE TYPE app_v3."PadelPairingPaymentStatus" AS ENUM (
    'UNPAID',
    'PAID'
);
CREATE TYPE app_v3."PadelPairingSlotRole" AS ENUM (
    'CAPTAIN',
    'PARTNER'
);
CREATE TYPE app_v3."PadelPairingSlotStatus" AS ENUM (
    'PENDING',
    'FILLED',
    'CANCELLED'
);
CREATE TYPE app_v3."PadelPairingStatus" AS ENUM (
    'INCOMPLETE',
    'COMPLETE',
    'CANCELLED'
);
CREATE TYPE app_v3."PadelPaymentMode" AS ENUM (
    'FULL',
    'SPLIT'
);
CREATE TYPE app_v3."PadelPreferredSide" AS ENUM (
    'ESQUERDA',
    'DIREITA',
    'QUALQUER'
);
CREATE TYPE app_v3."PaymentEventSource" AS ENUM (
    'WEBHOOK',
    'JOB',
    'API'
);
CREATE TYPE app_v3."PaymentMode" AS ENUM (
    'LIVE',
    'TEST'
);
CREATE TYPE app_v3."PayoutMode" AS ENUM (
    'ORGANIZATION',
    'PLATFORM'
);
CREATE TYPE app_v3."PayoutRecordStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED'
);
CREATE TYPE app_v3."PromoType" AS ENUM (
    'PERCENTAGE',
    'FIXED'
);
CREATE TYPE app_v3."RefundFeePayer" AS ENUM (
    'ORGANIZATION',
    'CUSTOMER'
);
CREATE TYPE app_v3."RefundReason" AS ENUM (
    'CANCELLED',
    'DELETED',
    'DATE_CHANGED'
);
CREATE TYPE app_v3."ResaleMode" AS ENUM (
    'ALWAYS',
    'AFTER_SOLD_OUT',
    'DISABLED'
);
CREATE TYPE app_v3."ResaleStatus" AS ENUM (
    'LISTED',
    'SOLD',
    'CANCELLED'
);
CREATE TYPE app_v3."ReservationStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'EXPIRED',
    'CANCELED'
);
CREATE TYPE app_v3."SaleSummaryStatus" AS ENUM (
    'PAID',
    'REFUNDED',
    'DISPUTED',
    'FAILED',
    'PROCESSING'
);
CREATE TYPE app_v3."SplitPaymentParticipantStatus" AS ENUM (
    'PENDING',
    'PAID'
);
CREATE TYPE app_v3."SplitPaymentStatus" AS ENUM (
    'PENDING',
    'PARTIALLY_PAID',
    'PAID'
);
CREATE TYPE app_v3."StaffRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'STAFF',
    'CHECKIN'
);
CREATE TYPE app_v3."StaffScope" AS ENUM (
    'GLOBAL',
    'EVENT'
);
CREATE TYPE app_v3."StaffStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED'
);
CREATE TYPE app_v3."TicketStatus" AS ENUM (
    'ACTIVE',
    'USED',
    'REFUNDED',
    'TRANSFERRED',
    'RESALE_LISTED'
);
CREATE TYPE app_v3."TicketTypeStatus" AS ENUM (
    'ON_SALE',
    'UPCOMING',
    'CLOSED',
    'SOLD_OUT'
);
CREATE TYPE app_v3."TournamentEntryRole" AS ENUM (
    'CAPTAIN',
    'PARTNER'
);
CREATE TYPE app_v3."TournamentEntryStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED'
);
CREATE TYPE app_v3."TournamentFormat" AS ENUM (
    'GROUPS_PLUS_PLAYOFF',
    'DRAW_A_B',
    'GROUPS_PLUS_FINALS_ALL_PLACES',
    'CHAMPIONSHIP_ROUND_ROBIN',
    'NONSTOP_ROUND_ROBIN',
    'MANUAL'
);
CREATE TYPE app_v3."TournamentMatchStatus" AS ENUM (
    'PENDING',
    'SCHEDULED',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED'
);
CREATE TYPE app_v3."TournamentStageType" AS ENUM (
    'GROUPS',
    'PLAYOFF',
    'CONSOLATION',
    'NONSTOP'
);
CREATE TYPE app_v3."TransactionPayoutStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED'
);
CREATE TYPE app_v3."TransferStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'CANCELLED'
);
CREATE TYPE app_v3."UserActivityType" AS ENUM (
    'RSVP',
    'TICKET_PURCHASE',
    'PADEL_ACHIEVEMENT',
    'BOOKING_CREATED'
);
CREATE TYPE app_v3."Visibility" AS ENUM (
    'PUBLIC',
    'PRIVATE',
    'FRIENDS'
);
CREATE TYPE app_v3.checkin_result_code AS ENUM (
    'OK',
    'ALREADY_USED',
    'INVALID',
    'REFUNDED',
    'REVOKED',
    'SUSPENDED',
    'NOT_ALLOWED',
    'OUTSIDE_WINDOW'
);
CREATE TYPE app_v3.entitlement_status AS ENUM (
    'ACTIVE',
    'USED',
    'REFUNDED',
    'REVOKED',
    'SUSPENDED'
);
CREATE TYPE app_v3.entitlement_type AS ENUM (
    'EVENT_TICKET',
    'PADEL_ENTRY',
    'PASS',
    'SUBSCRIPTION_ACCESS',
    'FUTURE_TYPE'
);
CREATE TYPE app_v3.padel_format AS ENUM (
    'TODOS_CONTRA_TODOS',
    'QUADRO_ELIMINATORIO',
    'GRUPOS_ELIMINATORIAS',
    'CAMPEONATO_LIGA',
    'QUADRO_AB',
    'NON_STOP'
);
CREATE TYPE app_v3.padel_match_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED'
);
CREATE TABLE app_v3.availabilities (
    id integer NOT NULL,
    service_id integer NOT NULL,
    starts_at timestamp(6) with time zone NOT NULL,
    duration_minutes integer NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    status app_v3."AvailabilityStatus" DEFAULT 'OPEN'::app_v3."AvailabilityStatus" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.availabilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.availabilities_id_seq OWNED BY app_v3.availabilities.id;
CREATE TABLE app_v3.booking_policy_refs (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    policy_id integer NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.booking_policy_refs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.booking_policy_refs_id_seq OWNED BY app_v3.booking_policy_refs.id;
CREATE TABLE app_v3.bookings (
    id integer NOT NULL,
    service_id integer NOT NULL,
    organization_id integer NOT NULL,
    user_id uuid NOT NULL,
    availability_id integer,
    payment_intent_id text,
    starts_at timestamp(6) with time zone NOT NULL,
    duration_minutes integer NOT NULL,
    price integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status app_v3."BookingStatus" DEFAULT 'PENDING'::app_v3."BookingStatus" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.bookings_id_seq OWNED BY app_v3.bookings.id;
CREATE TABLE app_v3.connect_accounts (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    stripe_account_id text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.connect_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.connect_accounts_id_seq OWNED BY app_v3.connect_accounts.id;
CREATE TABLE app_v3.email_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_normalized extensions.citext NOT NULL,
    email_verified_at timestamp with time zone,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE app_v3.email_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_key text NOT NULL,
    recipient extensions.citext NOT NULL,
    purchase_id text NOT NULL,
    entitlement_id uuid,
    dedupe_key text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_code text
);
CREATE TABLE app_v3.entitlement_checkins (
    id bigint NOT NULL,
    entitlement_id uuid NOT NULL,
    event_id integer NOT NULL,
    device_id text NOT NULL,
    result_code app_v3.checkin_result_code NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_in_by uuid,
    purchase_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.entitlement_checkins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.entitlement_checkins_id_seq OWNED BY app_v3.entitlement_checkins.id;
CREATE TABLE app_v3.entitlement_qr_tokens (
    id bigint NOT NULL,
    token_hash text NOT NULL,
    entitlement_id uuid NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.entitlement_qr_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.entitlement_qr_tokens_id_seq OWNED BY app_v3.entitlement_qr_tokens.id;
CREATE TABLE app_v3.entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type app_v3.entitlement_type NOT NULL,
    status app_v3.entitlement_status DEFAULT 'ACTIVE'::app_v3.entitlement_status NOT NULL,
    owner_user_id uuid,
    owner_identity_id uuid,
    owner_key text NOT NULL,
    purchase_id text NOT NULL,
    sale_line_id integer NOT NULL,
    event_id integer,
    tournament_id integer,
    season_id integer,
    snapshot_title text NOT NULL,
    snapshot_cover_url text,
    snapshot_venue_name text,
    snapshot_start_at timestamp with time zone NOT NULL,
    snapshot_timezone text NOT NULL,
    snapshot_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    line_item_index integer DEFAULT 0 NOT NULL,
    CONSTRAINT entitlements_owner_key_not_empty CHECK ((char_length(owner_key) > 0)),
    CONSTRAINT entitlements_owner_xor CHECK (((((owner_user_id IS NOT NULL))::integer + ((owner_identity_id IS NOT NULL))::integer) = 1))
);
CREATE TABLE app_v3.event_invites (
    id integer NOT NULL,
    event_id integer NOT NULL,
    invited_by_user_id uuid NOT NULL,
    target_identifier extensions.citext NOT NULL,
    target_user_id uuid,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    scope app_v3."EventInviteScope" DEFAULT 'PUBLIC'::app_v3."EventInviteScope" NOT NULL
);
CREATE SEQUENCE app_v3.event_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.event_invites_id_seq OWNED BY app_v3.event_invites.id;
CREATE TABLE app_v3.events (
    id integer NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type app_v3."EventType" DEFAULT 'ORGANIZATION_EVENT'::app_v3."EventType" NOT NULL,
    template_type app_v3."EventTemplateType",
    organization_id integer,
    starts_at timestamp(3) without time zone NOT NULL,
    ends_at timestamp(3) without time zone NOT NULL,
    location_name text NOT NULL,
    location_city text,
    address text,
    lat double precision,
    lng double precision,
    is_free boolean DEFAULT false NOT NULL,
    status app_v3."EventStatus" DEFAULT 'DRAFT'::app_v3."EventStatus" NOT NULL,
    timezone text DEFAULT 'Europe/Lisbon'::text NOT NULL,
    cover_image_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    owner_user_id uuid NOT NULL,
    deleted_at timestamp without time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    resale_mode app_v3."ResaleMode" DEFAULT 'ALWAYS'::app_v3."ResaleMode" NOT NULL,
    fee_mode_override app_v3."FeeMode",
    platform_fee_bps_override integer,
    platform_fee_fixed_cents_override integer,
    fee_mode app_v3."FeeMode" DEFAULT 'INCLUDED'::app_v3."FeeMode" NOT NULL,
    payout_mode app_v3."PayoutMode" DEFAULT 'ORGANIZATION'::app_v3."PayoutMode" NOT NULL,
    invite_only boolean DEFAULT false NOT NULL,
    live_stream_url text,
    public_access_mode app_v3."EventPublicAccessMode" DEFAULT 'OPEN'::app_v3."EventPublicAccessMode" NOT NULL,
    participant_access_mode app_v3."EventParticipantAccessMode" DEFAULT 'NONE'::app_v3."EventParticipantAccessMode" NOT NULL,
    public_ticket_type_ids integer[] DEFAULT '{}'::integer[] NOT NULL,
    participant_ticket_type_ids integer[] DEFAULT '{}'::integer[] NOT NULL,
    live_hub_visibility app_v3."LiveHubVisibility" DEFAULT 'PUBLIC'::app_v3."LiveHubVisibility" NOT NULL
);
CREATE SEQUENCE app_v3.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.events_id_seq OWNED BY app_v3.events.id;
CREATE TABLE app_v3.follows (
    id integer NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.follows_id_seq OWNED BY app_v3.follows.id;
CREATE TABLE app_v3.global_usernames (
    username extensions.citext NOT NULL,
    owner_type text NOT NULL,
    owner_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE app_v3.guest_ticket_links (
    ticket_id text NOT NULL,
    guest_email text NOT NULL,
    guest_name text NOT NULL,
    guest_phone text,
    migrated_to_user_id uuid,
    migrated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE app_v3.locks (
    key text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);
CREATE TABLE app_v3.match_notifications (
    id integer NOT NULL,
    match_id integer NOT NULL,
    dedupe_key text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now(),
    payload jsonb
);
CREATE SEQUENCE app_v3.match_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.match_notifications_id_seq OWNED BY app_v3.match_notifications.id;
CREATE TABLE app_v3.notification_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    notification_type text NOT NULL,
    template_version text,
    dedupe_key text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    retries integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    sent_at timestamp(6) with time zone
);
CREATE TABLE app_v3.notification_preferences (
    "userId" uuid NOT NULL,
    allow_email_notifications boolean DEFAULT true NOT NULL,
    allow_event_reminders boolean DEFAULT true NOT NULL,
    allow_friend_requests boolean DEFAULT true NOT NULL,
    allow_sales_alerts boolean DEFAULT true NOT NULL,
    allow_system_announcements boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE app_v3.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type app_v3."NotificationType" NOT NULL,
    title text,
    body text,
    payload jsonb DEFAULT '{}'::jsonb,
    cta_url text,
    cta_label text,
    priority app_v3."NotificationPriority" DEFAULT 'NORMAL'::app_v3."NotificationPriority" NOT NULL,
    from_user_id uuid,
    organization_id integer,
    event_id integer,
    ticket_id text,
    invite_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    seen_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE app_v3.operations (
    id integer NOT NULL,
    operation_type text NOT NULL,
    dedupe_key text NOT NULL,
    status app_v3."OperationStatus" DEFAULT 'PENDING'::app_v3."OperationStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    locked_at timestamp with time zone,
    next_retry_at timestamp with time zone,
    payload jsonb DEFAULT '{}'::jsonb,
    purchase_id text,
    payment_intent_id text,
    stripe_event_id text,
    event_id integer,
    organization_id integer,
    pairing_id integer,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.operations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.operations_id_seq OWNED BY app_v3.operations.id;
CREATE TABLE app_v3.organization_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id integer NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    from_user_id uuid,
    to_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE app_v3.organization_form_fields (
    id integer NOT NULL,
    form_id integer NOT NULL,
    label text NOT NULL,
    field_type app_v3."OrganizationFormFieldType" NOT NULL,
    required boolean DEFAULT false NOT NULL,
    help_text text,
    placeholder text,
    options jsonb,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.organization_form_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organization_form_fields_id_seq OWNED BY app_v3.organization_form_fields.id;
CREATE TABLE app_v3.organization_form_submissions (
    id integer NOT NULL,
    form_id integer NOT NULL,
    user_id uuid,
    guest_email text,
    status app_v3."OrganizationFormSubmissionStatus" DEFAULT 'SUBMITTED'::app_v3."OrganizationFormSubmissionStatus" NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.organization_form_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organization_form_submissions_id_seq OWNED BY app_v3.organization_form_submissions.id;
CREATE TABLE app_v3.organization_forms (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    title text NOT NULL,
    description text,
    status app_v3."OrganizationFormStatus" DEFAULT 'DRAFT'::app_v3."OrganizationFormStatus" NOT NULL,
    capacity integer,
    waitlist_enabled boolean DEFAULT true NOT NULL,
    start_at timestamp(6) with time zone,
    end_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.organization_forms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organization_forms_id_seq OWNED BY app_v3.organization_forms.id;
CREATE TABLE app_v3.organization_modules (
    organization_id integer NOT NULL,
    module_key app_v3."OrganizationModule" NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);
CREATE TABLE app_v3.organization_owner_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id integer NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    status app_v3."OrganizationOwnerTransferStatus" DEFAULT 'PENDING'::app_v3."OrganizationOwnerTransferStatus" NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone
);
CREATE TABLE app_v3.organization_policies (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    name text NOT NULL,
    policy_type app_v3."OrganizationPolicyType" NOT NULL,
    cancellation_window_minutes integer,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.organization_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organization_policies_id_seq OWNED BY app_v3.organization_policies.id;
CREATE TABLE app_v3.organization_reviews (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    body text,
    status app_v3."OrganizationReviewStatus" DEFAULT 'PENDING'::app_v3."OrganizationReviewStatus" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.organization_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organization_reviews_id_seq OWNED BY app_v3.organization_reviews.id;
CREATE TABLE app_v3.organization_follows (
    id integer NOT NULL,
    follower_id uuid NOT NULL,
    organization_id integer NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.organization_follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organization_follows_id_seq OWNED BY app_v3.organization_follows.id;
CREATE TABLE app_v3.organization_member_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id integer NOT NULL,
    invited_by_user_id uuid NOT NULL,
    target_identifier extensions.citext NOT NULL,
    target_user_id uuid,
    role app_v3."OrganizationMemberRole" NOT NULL,
    token uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    declined_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE app_v3.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id integer NOT NULL,
    user_id uuid NOT NULL,
    role app_v3."OrganizationMemberRole" NOT NULL,
    invited_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone
);
CREATE TABLE app_v3.organization_official_email_requests (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    requested_by_user_id uuid,
    new_email text NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone
);
CREATE SEQUENCE app_v3.organization_official_email_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organization_official_email_requests_id_seq OWNED BY app_v3.organization_official_email_requests.id;
CREATE TABLE app_v3.organizations (
    id integer NOT NULL,
    stripe_account_id text,
    status app_v3."OrganizationStatus" DEFAULT 'PENDING'::app_v3."OrganizationStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT now() NOT NULL,
    fee_mode app_v3."FeeMode" DEFAULT 'ADDED'::app_v3."FeeMode" NOT NULL,
    platform_fee_bps integer DEFAULT 200 NOT NULL,
    platform_fee_fixed_cents integer DEFAULT 0 NOT NULL,
    stripe_charges_enabled boolean DEFAULT false NOT NULL,
    stripe_payouts_enabled boolean DEFAULT false NOT NULL,
    entity_type text,
    business_name text,
    city text,
    payout_iban text,
    username extensions.citext,
    language text DEFAULT 'pt'::text,
    alerts_email text,
    alerts_sales_enabled boolean DEFAULT true,
    alerts_payout_enabled boolean DEFAULT false,
    branding_avatar_url text,
    branding_primary_color text,
    branding_secondary_color text,
    refund_fee_payer app_v3."RefundFeePayer" DEFAULT 'CUSTOMER'::app_v3."RefundFeePayer" NOT NULL,
    organization_kind app_v3."OrganizationKind" DEFAULT 'PESSOA_SINGULAR'::app_v3."OrganizationKind" NOT NULL,
    padel_default_short_name text,
    padel_default_city text,
    padel_default_address text,
    padel_default_courts integer DEFAULT 0 NOT NULL,
    padel_default_hours text,
    padel_default_rule_set_id integer,
    padel_favorite_categories integer[] DEFAULT '{}'::integer[] NOT NULL,
    public_name text NOT NULL,
    address text,
    show_address_publicly boolean DEFAULT false NOT NULL,
    is_platform_owned boolean DEFAULT false NOT NULL,
    org_type app_v3."OrgType" DEFAULT 'EXTERNAL'::app_v3."OrgType" NOT NULL,
    official_email text,
    official_email_verified_at timestamp with time zone,
    organization_category app_v3."OrganizationCategory" DEFAULT 'EVENTOS'::app_v3."OrganizationCategory" NOT NULL,
    public_website text,
    public_description text,
    public_hours text,
    info_rules text,
    info_faq text,
    info_requirements text,
    info_policies text,
    info_location_notes text,
    live_hub_premium_enabled boolean DEFAULT false NOT NULL,
    public_instagram text,
    public_youtube text,
    branding_cover_url text,
    stripe_customer_id text,
    stripe_subscription_id text
);
CREATE SEQUENCE app_v3.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.organizations_id_seq OWNED BY app_v3.organizations.id;
CREATE TABLE app_v3.padel_availabilities (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    event_id integer NOT NULL,
    player_profile_id integer,
    player_name text,
    player_email text,
    start_at timestamp(6) with time zone NOT NULL,
    end_at timestamp(6) with time zone NOT NULL,
    note text,
    created_at timestamp(6) with time zone DEFAULT now(),
    updated_at timestamp(6) with time zone DEFAULT now()
);
CREATE SEQUENCE app_v3.padel_availabilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_availabilities_id_seq OWNED BY app_v3.padel_availabilities.id;
CREATE TABLE app_v3.padel_categories (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    label text NOT NULL,
    gender_restriction text,
    min_level text,
    max_level text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    season text,
    year integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.padel_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_categories_id_seq OWNED BY app_v3.padel_categories.id;
CREATE TABLE app_v3.padel_club_courts (
    id integer NOT NULL,
    padel_club_id integer NOT NULL,
    name text NOT NULL,
    description text,
    surface text,
    indoor boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.padel_club_courts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_club_courts_id_seq OWNED BY app_v3.padel_club_courts.id;
CREATE TABLE app_v3.padel_club_staff (
    id integer NOT NULL,
    padel_club_id integer NOT NULL,
    user_id uuid,
    email extensions.citext,
    role text NOT NULL,
    inherit_to_events boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone
);
CREATE SEQUENCE app_v3.padel_club_staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_club_staff_id_seq OWNED BY app_v3.padel_club_staff.id;
CREATE TABLE app_v3.padel_clubs (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    name text NOT NULL,
    short_name text,
    city text,
    address text,
    courts_count integer DEFAULT 1 NOT NULL,
    hours text,
    favorite_category_ids integer[] DEFAULT '{}'::integer[] NOT NULL,
    slug text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);
CREATE SEQUENCE app_v3.padel_clubs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_clubs_id_seq OWNED BY app_v3.padel_clubs.id;
CREATE TABLE app_v3.padel_court_blocks (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    event_id integer NOT NULL,
    padel_club_id integer,
    court_id integer,
    start_at timestamp(6) with time zone NOT NULL,
    end_at timestamp(6) with time zone NOT NULL,
    label text,
    kind text DEFAULT 'BLOCK'::text,
    note text,
    created_at timestamp(6) with time zone DEFAULT now(),
    updated_at timestamp(6) with time zone DEFAULT now()
);
CREATE SEQUENCE app_v3.padel_court_blocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_court_blocks_id_seq OWNED BY app_v3.padel_court_blocks.id;
CREATE TABLE app_v3.padel_event_category_links (
    id integer NOT NULL,
    event_id integer NOT NULL,
    padel_category_id integer NOT NULL,
    format app_v3.padel_format,
    capacity_teams integer,
    capacity_players integer,
    live_stream_url text,
    is_enabled boolean DEFAULT true NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.padel_event_category_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_event_category_links_id_seq OWNED BY app_v3.padel_event_category_links.id;
CREATE TABLE app_v3.padel_matches (
    id integer NOT NULL,
    event_id integer NOT NULL,
    category_id integer,
    court_number integer,
    start_time timestamp with time zone,
    round_label text,
    team_a_id integer,
    team_b_id integer,
    score jsonb DEFAULT '{}'::jsonb NOT NULL,
    status app_v3.padel_match_status DEFAULT 'PENDING'::app_v3.padel_match_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pairing_a_id integer,
    pairing_b_id integer,
    group_label text,
    round_type text,
    winner_pairing_id integer,
    score_sets jsonb,
    court_name text,
    court_id integer,
    planned_start_at timestamp(6) with time zone,
    planned_end_at timestamp(6) with time zone,
    planned_duration_minutes integer,
    actual_start_at timestamp(6) with time zone,
    actual_end_at timestamp(6) with time zone
);
CREATE SEQUENCE app_v3.padel_matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_matches_id_seq OWNED BY app_v3.padel_matches.id;
CREATE TABLE app_v3.padel_pairing_holds (
    id integer NOT NULL,
    pairing_id integer NOT NULL,
    event_id integer NOT NULL,
    holds integer DEFAULT 2 NOT NULL,
    status app_v3."PadelPairingHoldStatus" DEFAULT 'ACTIVE'::app_v3."PadelPairingHoldStatus" NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.padel_pairing_holds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_pairing_holds_id_seq OWNED BY app_v3.padel_pairing_holds.id;
CREATE TABLE app_v3.padel_pairing_slots (
    id integer NOT NULL,
    pairing_id integer NOT NULL,
    ticket_id text,
    profile_id uuid,
    slot_role app_v3."PadelPairingSlotRole" NOT NULL,
    slot_status app_v3."PadelPairingSlotStatus" DEFAULT 'PENDING'::app_v3."PadelPairingSlotStatus" NOT NULL,
    payment_status app_v3."PadelPairingPaymentStatus" DEFAULT 'UNPAID'::app_v3."PadelPairingPaymentStatus" NOT NULL,
    invited_contact text,
    is_public_open boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    player_profile_id integer
);
CREATE SEQUENCE app_v3.padel_pairing_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_pairing_slots_id_seq OWNED BY app_v3.padel_pairing_slots.id;
CREATE TABLE app_v3.padel_pairings (
    id integer NOT NULL,
    event_id integer NOT NULL,
    organization_id integer NOT NULL,
    category_id integer,
    payment_mode app_v3."PadelPaymentMode" NOT NULL,
    pairing_status app_v3."PadelPairingStatus" DEFAULT 'INCOMPLETE'::app_v3."PadelPairingStatus" NOT NULL,
    created_by_user_id uuid,
    created_by_ticket_id text,
    invite_token text,
    invite_expires_at timestamp with time zone,
    locked_until timestamp with time zone,
    is_public_open boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    player1_user_id uuid,
    player2_user_id uuid,
    lifecycle_status app_v3."PadelPairingLifecycleStatus" DEFAULT 'PENDING_ONE_PAID'::app_v3."PadelPairingLifecycleStatus" NOT NULL,
    pairing_join_mode app_v3."PadelPairingJoinMode" DEFAULT 'INVITE_PARTNER'::app_v3."PadelPairingJoinMode" NOT NULL,
    player2_identity_id uuid,
    partner_invite_used_at timestamp with time zone,
    partner_link_token text,
    deadline_at timestamp with time zone,
    partner_swap_allowed_until_at timestamp with time zone,
    grace_until_at timestamp with time zone,
    partner_invited_at timestamp with time zone,
    partner_accepted_at timestamp with time zone,
    partner_paid_at timestamp with time zone,
    captain_second_charged_at timestamp with time zone,
    guarantee_status app_v3."PadelPairingGuaranteeStatus" DEFAULT 'NONE'::app_v3."PadelPairingGuaranteeStatus" NOT NULL,
    setup_intent_id text,
    payment_method_id text,
    second_charge_payment_intent_id text,
    captain_consent_at timestamp with time zone,
    captain_first_sale_id integer,
    partner_sale_id integer,
    captain_second_sale_id integer
);
CREATE SEQUENCE app_v3.padel_pairings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_pairings_id_seq OWNED BY app_v3.padel_pairings.id;
CREATE TABLE app_v3.padel_player_profiles (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    email extensions.citext,
    phone text,
    gender text,
    level text,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    display_name text,
    preferred_side app_v3."PadelPreferredSide",
    club_name text,
    birth_date timestamp(6) without time zone
);
CREATE SEQUENCE app_v3.padel_player_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_player_profiles_id_seq OWNED BY app_v3.padel_player_profiles.id;
CREATE TABLE app_v3.padel_ranking_entries (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    player_id integer NOT NULL,
    event_id integer NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    "position" integer,
    level text,
    season text,
    year integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.padel_ranking_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_ranking_entries_id_seq OWNED BY app_v3.padel_ranking_entries.id;
CREATE TABLE app_v3.padel_rule_sets (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    name text NOT NULL,
    tie_break_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    points_table jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled_formats text[] DEFAULT ARRAY['TODOS_CONTRA_TODOS'::text, 'QUADRO_ELIMINATORIO'::text] NOT NULL,
    season text,
    year integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.padel_rule_sets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_rule_sets_id_seq OWNED BY app_v3.padel_rule_sets.id;
CREATE TABLE app_v3.padel_teams (
    id integer NOT NULL,
    event_id integer NOT NULL,
    category_id integer,
    player1_id integer,
    player2_id integer,
    is_from_matchmaking boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.padel_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_teams_id_seq OWNED BY app_v3.padel_teams.id;
CREATE TABLE app_v3.padel_tournament_configs (
    id integer NOT NULL,
    event_id integer NOT NULL,
    organization_id integer NOT NULL,
    format app_v3.padel_format NOT NULL,
    number_of_courts integer DEFAULT 1 NOT NULL,
    rule_set_id integer,
    default_category_id integer,
    enabled_formats text[] DEFAULT ARRAY[]::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    padel_v2_enabled boolean DEFAULT false NOT NULL,
    split_deadline_hours integer,
    auto_cancel_unpaid boolean DEFAULT true NOT NULL,
    allow_captain_assume boolean DEFAULT true NOT NULL,
    default_payment_mode app_v3."PadelPaymentMode",
    refund_fee_payer app_v3."RefundFeePayer",
    padel_club_id integer,
    club_hours text,
    partner_club_ids integer[] DEFAULT '{}'::integer[] NOT NULL,
    advanced_settings jsonb,
    eligibility_type app_v3."PadelEligibilityType" DEFAULT 'OPEN'::app_v3."PadelEligibilityType" NOT NULL
);
CREATE SEQUENCE app_v3.padel_tournament_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.padel_tournament_configs_id_seq OWNED BY app_v3.padel_tournament_configs.id;
CREATE TABLE app_v3.payment_customers (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.payment_customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.payment_customers_id_seq OWNED BY app_v3.payment_customers.id;
CREATE TABLE app_v3.payment_events (
    id integer NOT NULL,
    stripe_payment_intent_id text NOT NULL,
    status text DEFAULT 'PROCESSING'::text NOT NULL,
    event_id integer,
    user_id uuid,
    amount_cents integer,
    platform_fee_cents integer,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    mode app_v3."PaymentMode" DEFAULT 'LIVE'::app_v3."PaymentMode" NOT NULL,
    is_test boolean DEFAULT false NOT NULL,
    stripe_fee_cents integer,
    stripe_event_id text,
    purchase_id text,
    source app_v3."PaymentEventSource" DEFAULT 'WEBHOOK'::app_v3."PaymentEventSource" NOT NULL,
    dedupe_key text,
    attempt integer DEFAULT 1 NOT NULL
);
CREATE SEQUENCE app_v3.payment_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.payment_events_id_seq OWNED BY app_v3.payment_events.id;
CREATE TABLE app_v3.payout_records (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    stripe_payout_id text,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status app_v3."PayoutRecordStatus" DEFAULT 'PENDING'::app_v3."PayoutRecordStatus" NOT NULL,
    arrival_date timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.payout_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.payout_records_id_seq OWNED BY app_v3.payout_records.id;
CREATE TABLE app_v3.platform_settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
CREATE SEQUENCE app_v3.platform_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.platform_settings_id_seq OWNED BY app_v3.platform_settings.id;
CREATE TABLE app_v3.profiles (
    id uuid NOT NULL,
    username extensions.citext,
    full_name text,
    avatar_url text,
    bio text,
    city text,
    favourite_categories text[] DEFAULT ARRAY[]::text[],
    onboarding_done boolean DEFAULT false NOT NULL,
    roles text[] DEFAULT ARRAY['user'::text],
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    visibility app_v3."Visibility" DEFAULT 'PUBLIC'::app_v3."Visibility" NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    contact_phone text,
    status app_v3."AccountStatus" DEFAULT 'ACTIVE'::app_v3."AccountStatus",
    deletion_requested_at timestamp(6) with time zone,
    deletion_scheduled_for timestamp(6) with time zone,
    deleted_at_final timestamp(6) with time zone,
    gender app_v3."Gender",
    cover_url text,
    padel_level text,
    padel_dominant_hand text,
    padel_position text
);
CREATE TABLE app_v3.promo_codes (
    id integer NOT NULL,
    code text NOT NULL,
    type app_v3."PromoType" NOT NULL,
    value integer NOT NULL,
    max_uses integer,
    per_user_limit integer,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    event_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_apply boolean DEFAULT false,
    min_quantity integer,
    min_total_cents integer
);
ALTER TABLE app_v3.promo_codes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME app_v3.promo_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
CREATE TABLE app_v3.promo_redemptions (
    id integer NOT NULL,
    promo_code_id integer NOT NULL,
    user_id uuid,
    guest_email text,
    used_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_id text,
    CONSTRAINT promo_redemptions_user_or_guest CHECK (((user_id IS NOT NULL) OR ((guest_email IS NOT NULL) AND (length(guest_email) > 0))))
);
ALTER TABLE app_v3.promo_redemptions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME app_v3.promo_redemptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
CREATE TABLE app_v3.refunds (
    id integer NOT NULL,
    dedupe_key text NOT NULL,
    purchase_id text,
    payment_intent_id text,
    event_id integer NOT NULL,
    base_amount_cents integer DEFAULT 0 NOT NULL,
    fees_excluded_cents integer DEFAULT 0 NOT NULL,
    reason app_v3."RefundReason" NOT NULL,
    refunded_by text,
    refunded_at timestamp(6) with time zone DEFAULT now(),
    stripe_refund_id text,
    audit_payload jsonb,
    created_at timestamp(6) with time zone DEFAULT now(),
    updated_at timestamp(6) with time zone DEFAULT now()
);
CREATE SEQUENCE app_v3.refunds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.refunds_id_seq OWNED BY app_v3.refunds.id;
CREATE TABLE app_v3.sale_lines (
    id integer NOT NULL,
    sale_summary_id integer NOT NULL,
    event_id integer NOT NULL,
    ticket_type_id integer NOT NULL,
    promo_code_id integer,
    quantity integer NOT NULL,
    unit_price_cents integer NOT NULL,
    discount_per_unit_cents integer DEFAULT 0 NOT NULL,
    gross_cents integer NOT NULL,
    net_cents integer NOT NULL,
    platform_fee_cents integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    promo_code_snapshot text,
    promo_label_snapshot text,
    promo_type_snapshot app_v3."PromoType",
    promo_value_snapshot integer
);
CREATE SEQUENCE app_v3.sale_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.sale_lines_id_seq OWNED BY app_v3.sale_lines.id;
CREATE TABLE app_v3.sale_summaries (
    id integer NOT NULL,
    payment_intent_id text NOT NULL,
    event_id integer NOT NULL,
    user_id uuid,
    promo_code_id integer,
    subtotal_cents integer NOT NULL,
    discount_cents integer NOT NULL,
    platform_fee_cents integer NOT NULL,
    total_cents integer NOT NULL,
    net_cents integer NOT NULL,
    fee_mode app_v3."FeeMode",
    currency text DEFAULT 'EUR'::text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    promo_code_snapshot text,
    promo_label_snapshot text,
    promo_type_snapshot app_v3."PromoType",
    promo_value_snapshot integer,
    stripe_fee_cents integer DEFAULT 0 NOT NULL,
    purchase_id text,
    owner_user_id uuid,
    owner_identity_id uuid,
    status app_v3."SaleSummaryStatus" DEFAULT 'PAID'::app_v3."SaleSummaryStatus",
    CONSTRAINT sale_summaries_owner_exclusive_chk CHECK ((NOT ((owner_user_id IS NOT NULL) AND (owner_identity_id IS NOT NULL))))
);
CREATE SEQUENCE app_v3.sale_summaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.sale_summaries_id_seq OWNED BY app_v3.sale_summaries.id;
CREATE TABLE app_v3.service_staff (
    id integer NOT NULL,
    service_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.service_staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.service_staff_id_seq OWNED BY app_v3.service_staff.id;
CREATE TABLE app_v3.services (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    policy_id integer,
    name text NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    price integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.services_id_seq OWNED BY app_v3.services.id;
CREATE TABLE app_v3.split_payment_participants (
    id integer NOT NULL,
    split_payment_id integer NOT NULL,
    user_id uuid,
    email extensions.citext,
    share_cents integer NOT NULL,
    status app_v3."SplitPaymentParticipantStatus" DEFAULT 'PENDING'::app_v3."SplitPaymentParticipantStatus" NOT NULL,
    paid_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.split_payment_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.split_payment_participants_id_seq OWNED BY app_v3.split_payment_participants.id;
CREATE TABLE app_v3.split_payments (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    captain_user_id uuid,
    total_amount_cents integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status app_v3."SplitPaymentStatus" DEFAULT 'PENDING'::app_v3."SplitPaymentStatus" NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.split_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.split_payments_id_seq OWNED BY app_v3.split_payments.id;
CREATE TABLE app_v3.staff_assignments (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    scope app_v3."StaffScope" NOT NULL,
    event_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_at timestamp(3) without time zone,
    user_id uuid NOT NULL,
    accepted_at timestamp without time zone,
    status app_v3."StaffStatus" DEFAULT 'PENDING'::app_v3."StaffStatus" NOT NULL,
    role app_v3."StaffRole" DEFAULT 'STAFF'::app_v3."StaffRole" NOT NULL
);
CREATE SEQUENCE app_v3.staff_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.staff_assignments_id_seq OWNED BY app_v3.staff_assignments.id;
CREATE TABLE app_v3.ticket_resales (
    id text NOT NULL,
    ticket_id text NOT NULL,
    price integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status app_v3."ResaleStatus" DEFAULT 'LISTED'::app_v3."ResaleStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone,
    seller_user_id uuid NOT NULL
);
CREATE TABLE app_v3.ticket_transfers (
    id text NOT NULL,
    ticket_id text NOT NULL,
    status app_v3."TransferStatus" DEFAULT 'PENDING'::app_v3."TransferStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL
);
CREATE VIEW app_v3.ticket_history AS
 SELECT 'TRANSFER'::text AS kind,
    tt.ticket_id,
    tt.from_user_id,
    tt.to_user_id,
    NULL::uuid AS seller_user_id,
    NULL::integer AS resale_price_cents,
    (tt.status)::text AS status,
    tt.created_at,
    tt.completed_at
   FROM app_v3.ticket_transfers tt
UNION ALL
 SELECT 'RESALE'::text AS kind,
    tr.ticket_id,
    NULL::uuid AS from_user_id,
    NULL::uuid AS to_user_id,
    tr.seller_user_id,
    tr.price AS resale_price_cents,
    (tr.status)::text AS status,
    tr.created_at,
    tr.completed_at
   FROM app_v3.ticket_resales tr;
CREATE TABLE app_v3.ticket_reservations (
    id text NOT NULL,
    event_id integer NOT NULL,
    ticket_type_id integer NOT NULL,
    quantity integer NOT NULL,
    status app_v3."ReservationStatus" DEFAULT 'ACTIVE'::app_v3."ReservationStatus" NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id uuid
);
CREATE TABLE app_v3.ticket_types (
    id integer NOT NULL,
    event_id integer NOT NULL,
    name text NOT NULL,
    description text,
    price integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    total_quantity integer,
    sold_quantity integer DEFAULT 0 NOT NULL,
    status app_v3."TicketTypeStatus" DEFAULT 'ON_SALE'::app_v3."TicketTypeStatus" NOT NULL,
    starts_at timestamp(3) without time zone,
    ends_at timestamp(3) without time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    padel_event_category_link_id integer
);
CREATE SEQUENCE app_v3.ticket_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.ticket_types_id_seq OWNED BY app_v3.ticket_types.id;
CREATE TABLE app_v3.tickets (
    id text NOT NULL,
    event_id integer NOT NULL,
    ticket_type_id integer NOT NULL,
    purchased_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status app_v3."TicketStatus" DEFAULT 'ACTIVE'::app_v3."TicketStatus" NOT NULL,
    qr_secret text NOT NULL,
    rotating_seed uuid,
    price_paid integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    used_at timestamp(3) without time zone,
    user_id uuid,
    platform_fee_cents integer DEFAULT 0 NOT NULL,
    total_paid_cents integer DEFAULT 0 NOT NULL,
    pairing_id integer,
    padel_split_share_cents integer,
    padel_pairing_version integer,
    owner_user_id uuid,
    owner_identity_id uuid,
    tournament_entry_id integer,
    purchase_id text,
    sale_summary_id integer,
    emission_index integer DEFAULT 0 NOT NULL,
    stripe_payment_intent_id text,
    CONSTRAINT tickets_owner_exclusive_chk CHECK ((NOT ((owner_user_id IS NOT NULL) AND (owner_identity_id IS NOT NULL))))
);
CREATE TABLE app_v3.tournament_audit_logs (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    user_id uuid,
    action text NOT NULL,
    payload_before jsonb,
    payload_after jsonb,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE app_v3.tournament_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.tournament_audit_logs_id_seq OWNED BY app_v3.tournament_audit_logs.id;
CREATE TABLE app_v3.tournament_entries (
    id integer NOT NULL,
    event_id integer NOT NULL,
    user_id uuid NOT NULL,
    pairing_id integer,
    role app_v3."TournamentEntryRole" DEFAULT 'PARTNER'::app_v3."TournamentEntryRole" NOT NULL,
    status app_v3."TournamentEntryStatus" DEFAULT 'PENDING'::app_v3."TournamentEntryStatus" NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid,
    owner_identity_id uuid,
    purchase_id text,
    sale_summary_id integer,
    emission_index integer DEFAULT 0 NOT NULL,
    category_id integer,
    CONSTRAINT tournament_entries_owner_exclusive_chk CHECK ((NOT ((owner_user_id IS NOT NULL) AND (owner_identity_id IS NOT NULL))))
);
CREATE SEQUENCE app_v3.tournament_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.tournament_entries_id_seq OWNED BY app_v3.tournament_entries.id;
CREATE TABLE app_v3.tournament_groups (
    id integer NOT NULL,
    stage_id integer NOT NULL,
    name text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.tournament_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.tournament_groups_id_seq OWNED BY app_v3.tournament_groups.id;
CREATE TABLE app_v3.tournament_matches (
    id integer NOT NULL,
    stage_id integer NOT NULL,
    group_id integer,
    pairing1_id integer,
    pairing2_id integer,
    round_number integer,
    round_label text,
    next_match_id integer,
    next_slot integer,
    court_id integer,
    start_at timestamp(6) with time zone,
    score jsonb DEFAULT '{}'::jsonb NOT NULL,
    status app_v3."TournamentMatchStatus" DEFAULT 'PENDING'::app_v3."TournamentMatchStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.tournament_matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.tournament_matches_id_seq OWNED BY app_v3.tournament_matches.id;
CREATE TABLE app_v3.tournament_stages (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    name text,
    stage_type app_v3."TournamentStageType" DEFAULT 'GROUPS'::app_v3."TournamentStageType" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.tournament_stages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.tournament_stages_id_seq OWNED BY app_v3.tournament_stages.id;
CREATE TABLE app_v3.tournaments (
    id integer NOT NULL,
    event_id integer NOT NULL,
    format app_v3."TournamentFormat" NOT NULL,
    generation_seed text,
    inscription_deadline_at timestamp(6) with time zone,
    tie_break_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    generated_at timestamp(6) with time zone,
    generated_by_user_id uuid
);
CREATE SEQUENCE app_v3.tournaments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.tournaments_id_seq OWNED BY app_v3.tournaments.id;
CREATE TABLE app_v3.transactions (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    user_id uuid,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    stripe_charge_id text,
    stripe_payment_intent_id text,
    platform_fee_cents integer DEFAULT 0 NOT NULL,
    stripe_fee_cents integer DEFAULT 0 NOT NULL,
    payout_status app_v3."TransactionPayoutStatus" DEFAULT 'PENDING'::app_v3."TransactionPayoutStatus" NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.transactions_id_seq OWNED BY app_v3.transactions.id;
CREATE TABLE app_v3.user_activities (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    type app_v3."UserActivityType" NOT NULL,
    visibility app_v3."Visibility" DEFAULT 'PUBLIC'::app_v3."Visibility" NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE app_v3.user_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE app_v3.user_activities_id_seq OWNED BY app_v3.user_activities.id;
ALTER TABLE ONLY app_v3.availabilities ALTER COLUMN id SET DEFAULT nextval('app_v3.availabilities_id_seq'::regclass);
ALTER TABLE ONLY app_v3.booking_policy_refs ALTER COLUMN id SET DEFAULT nextval('app_v3.booking_policy_refs_id_seq'::regclass);
ALTER TABLE ONLY app_v3.bookings ALTER COLUMN id SET DEFAULT nextval('app_v3.bookings_id_seq'::regclass);
ALTER TABLE ONLY app_v3.connect_accounts ALTER COLUMN id SET DEFAULT nextval('app_v3.connect_accounts_id_seq'::regclass);
ALTER TABLE ONLY app_v3.entitlement_checkins ALTER COLUMN id SET DEFAULT nextval('app_v3.entitlement_checkins_id_seq'::regclass);
ALTER TABLE ONLY app_v3.entitlement_qr_tokens ALTER COLUMN id SET DEFAULT nextval('app_v3.entitlement_qr_tokens_id_seq'::regclass);
ALTER TABLE ONLY app_v3.event_invites ALTER COLUMN id SET DEFAULT nextval('app_v3.event_invites_id_seq'::regclass);
ALTER TABLE ONLY app_v3.events ALTER COLUMN id SET DEFAULT nextval('app_v3.events_id_seq'::regclass);
ALTER TABLE ONLY app_v3.follows ALTER COLUMN id SET DEFAULT nextval('app_v3.follows_id_seq'::regclass);
ALTER TABLE ONLY app_v3.match_notifications ALTER COLUMN id SET DEFAULT nextval('app_v3.match_notifications_id_seq'::regclass);
ALTER TABLE ONLY app_v3.operations ALTER COLUMN id SET DEFAULT nextval('app_v3.operations_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organization_form_fields ALTER COLUMN id SET DEFAULT nextval('app_v3.organization_form_fields_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organization_form_submissions ALTER COLUMN id SET DEFAULT nextval('app_v3.organization_form_submissions_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organization_forms ALTER COLUMN id SET DEFAULT nextval('app_v3.organization_forms_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organization_policies ALTER COLUMN id SET DEFAULT nextval('app_v3.organization_policies_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organization_reviews ALTER COLUMN id SET DEFAULT nextval('app_v3.organization_reviews_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organization_follows ALTER COLUMN id SET DEFAULT nextval('app_v3.organization_follows_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organization_official_email_requests ALTER COLUMN id SET DEFAULT nextval('app_v3.organization_official_email_requests_id_seq'::regclass);
ALTER TABLE ONLY app_v3.organizations ALTER COLUMN id SET DEFAULT nextval('app_v3.organizations_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_availabilities ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_availabilities_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_categories ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_categories_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_club_courts ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_club_courts_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_club_staff ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_club_staff_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_clubs ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_clubs_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_court_blocks ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_court_blocks_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_event_category_links ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_event_category_links_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_matches ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_matches_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_pairing_holds ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_pairing_holds_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_pairing_slots ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_pairing_slots_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_pairings ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_pairings_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_player_profiles ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_player_profiles_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_ranking_entries ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_ranking_entries_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_rule_sets ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_rule_sets_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_teams ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_teams_id_seq'::regclass);
ALTER TABLE ONLY app_v3.padel_tournament_configs ALTER COLUMN id SET DEFAULT nextval('app_v3.padel_tournament_configs_id_seq'::regclass);
ALTER TABLE ONLY app_v3.payment_customers ALTER COLUMN id SET DEFAULT nextval('app_v3.payment_customers_id_seq'::regclass);
ALTER TABLE ONLY app_v3.payment_events ALTER COLUMN id SET DEFAULT nextval('app_v3.payment_events_id_seq'::regclass);
ALTER TABLE ONLY app_v3.payout_records ALTER COLUMN id SET DEFAULT nextval('app_v3.payout_records_id_seq'::regclass);
ALTER TABLE ONLY app_v3.platform_settings ALTER COLUMN id SET DEFAULT nextval('app_v3.platform_settings_id_seq'::regclass);
ALTER TABLE ONLY app_v3.refunds ALTER COLUMN id SET DEFAULT nextval('app_v3.refunds_id_seq'::regclass);
ALTER TABLE ONLY app_v3.sale_lines ALTER COLUMN id SET DEFAULT nextval('app_v3.sale_lines_id_seq'::regclass);
ALTER TABLE ONLY app_v3.sale_summaries ALTER COLUMN id SET DEFAULT nextval('app_v3.sale_summaries_id_seq'::regclass);
ALTER TABLE ONLY app_v3.service_staff ALTER COLUMN id SET DEFAULT nextval('app_v3.service_staff_id_seq'::regclass);
ALTER TABLE ONLY app_v3.services ALTER COLUMN id SET DEFAULT nextval('app_v3.services_id_seq'::regclass);
ALTER TABLE ONLY app_v3.split_payment_participants ALTER COLUMN id SET DEFAULT nextval('app_v3.split_payment_participants_id_seq'::regclass);
ALTER TABLE ONLY app_v3.split_payments ALTER COLUMN id SET DEFAULT nextval('app_v3.split_payments_id_seq'::regclass);
ALTER TABLE ONLY app_v3.staff_assignments ALTER COLUMN id SET DEFAULT nextval('app_v3.staff_assignments_id_seq'::regclass);
ALTER TABLE ONLY app_v3.ticket_types ALTER COLUMN id SET DEFAULT nextval('app_v3.ticket_types_id_seq'::regclass);
ALTER TABLE ONLY app_v3.tournament_audit_logs ALTER COLUMN id SET DEFAULT nextval('app_v3.tournament_audit_logs_id_seq'::regclass);
ALTER TABLE ONLY app_v3.tournament_entries ALTER COLUMN id SET DEFAULT nextval('app_v3.tournament_entries_id_seq'::regclass);
ALTER TABLE ONLY app_v3.tournament_groups ALTER COLUMN id SET DEFAULT nextval('app_v3.tournament_groups_id_seq'::regclass);
ALTER TABLE ONLY app_v3.tournament_matches ALTER COLUMN id SET DEFAULT nextval('app_v3.tournament_matches_id_seq'::regclass);
ALTER TABLE ONLY app_v3.tournament_stages ALTER COLUMN id SET DEFAULT nextval('app_v3.tournament_stages_id_seq'::regclass);
ALTER TABLE ONLY app_v3.tournaments ALTER COLUMN id SET DEFAULT nextval('app_v3.tournaments_id_seq'::regclass);
ALTER TABLE ONLY app_v3.transactions ALTER COLUMN id SET DEFAULT nextval('app_v3.transactions_id_seq'::regclass);
ALTER TABLE ONLY app_v3.user_activities ALTER COLUMN id SET DEFAULT nextval('app_v3.user_activities_id_seq'::regclass);
ALTER TABLE ONLY app_v3.availabilities
    ADD CONSTRAINT availabilities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.booking_policy_refs
    ADD CONSTRAINT booking_policy_refs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.connect_accounts
    ADD CONSTRAINT connect_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.email_identities
    ADD CONSTRAINT email_identities_email_normalized_key UNIQUE (email_normalized);
ALTER TABLE ONLY app_v3.email_identities
    ADD CONSTRAINT email_identities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.email_outbox
    ADD CONSTRAINT email_outbox_dedupe_key_key UNIQUE (dedupe_key);
ALTER TABLE ONLY app_v3.email_outbox
    ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.entitlement_checkins
    ADD CONSTRAINT entitlement_checkins_event_entitlement_key UNIQUE (event_id, entitlement_id);
ALTER TABLE ONLY app_v3.entitlement_checkins
    ADD CONSTRAINT entitlement_checkins_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.entitlement_qr_tokens
    ADD CONSTRAINT entitlement_qr_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.entitlement_qr_tokens
    ADD CONSTRAINT entitlement_qr_tokens_token_unique UNIQUE (token_hash);
ALTER TABLE ONLY app_v3.entitlements
    ADD CONSTRAINT entitlements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.entitlements
    ADD CONSTRAINT entitlements_purchase_sale_owner_type_idx UNIQUE (purchase_id, sale_line_id, line_item_index, owner_key, type);
ALTER TABLE ONLY app_v3.event_invites
    ADD CONSTRAINT event_invites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_unique UNIQUE (follower_id, following_id);
ALTER TABLE ONLY app_v3.global_usernames
    ADD CONSTRAINT global_usernames_pkey PRIMARY KEY (username);
ALTER TABLE ONLY app_v3.guest_ticket_links
    ADD CONSTRAINT guest_ticket_links_pkey PRIMARY KEY (ticket_id);
ALTER TABLE ONLY app_v3.locks
    ADD CONSTRAINT locks_pkey PRIMARY KEY (key);
ALTER TABLE ONLY app_v3.match_notifications
    ADD CONSTRAINT match_notifications_dedupe_key_key UNIQUE (dedupe_key);
ALTER TABLE ONLY app_v3.match_notifications
    ADD CONSTRAINT match_notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY ("userId");
ALTER TABLE ONLY app_v3.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.operations
    ADD CONSTRAINT operations_dedupe_key_unique UNIQUE (dedupe_key);
ALTER TABLE ONLY app_v3.operations
    ADD CONSTRAINT operations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_audit_logs
    ADD CONSTRAINT organization_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_form_fields
    ADD CONSTRAINT organization_form_fields_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_form_submissions
    ADD CONSTRAINT organization_form_submissions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_forms
    ADD CONSTRAINT organization_forms_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_modules
    ADD CONSTRAINT organization_modules_pkey PRIMARY KEY (organization_id, module_key);
ALTER TABLE ONLY app_v3.organization_owner_transfers
    ADD CONSTRAINT organization_owner_transfers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_owner_transfers
    ADD CONSTRAINT organization_owner_transfers_token_key UNIQUE (token);
ALTER TABLE ONLY app_v3.organization_policies
    ADD CONSTRAINT organization_policies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_reviews
    ADD CONSTRAINT organization_reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_follows
    ADD CONSTRAINT organization_follows_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_member_invites
    ADD CONSTRAINT organization_member_invites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_member_invites
    ADD CONSTRAINT organization_member_invites_token_key UNIQUE (token);
ALTER TABLE ONLY app_v3.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_official_email_requests
    ADD CONSTRAINT organization_official_email_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.organization_official_email_requests
    ADD CONSTRAINT organization_official_email_requests_token_key UNIQUE (token);
ALTER TABLE ONLY app_v3.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_availabilities
    ADD CONSTRAINT padel_availabilities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_categories
    ADD CONSTRAINT padel_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_club_courts
    ADD CONSTRAINT padel_club_courts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_club_staff
    ADD CONSTRAINT padel_club_staff_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_clubs
    ADD CONSTRAINT padel_clubs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_clubs
    ADD CONSTRAINT padel_clubs_slug_key UNIQUE (slug);
ALTER TABLE ONLY app_v3.padel_court_blocks
    ADD CONSTRAINT padel_court_blocks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_event_category_links
    ADD CONSTRAINT padel_event_category_links_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_pairing_holds
    ADD CONSTRAINT padel_pairing_holds_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_pairing_slots
    ADD CONSTRAINT padel_pairing_slots_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_pairing_slots
    ADD CONSTRAINT padel_pairing_slots_ticket_id_key UNIQUE (ticket_id);
ALTER TABLE ONLY app_v3.padel_pairings
    ADD CONSTRAINT padel_pairings_invite_token_key UNIQUE (invite_token);
ALTER TABLE ONLY app_v3.padel_pairings
    ADD CONSTRAINT padel_pairings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_player_profiles
    ADD CONSTRAINT padel_player_profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_ranking_entries
    ADD CONSTRAINT padel_ranking_entries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_rule_sets
    ADD CONSTRAINT padel_rule_sets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_teams
    ADD CONSTRAINT padel_teams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.padel_tournament_configs
    ADD CONSTRAINT padel_tournament_configs_event_unique UNIQUE (event_id);
ALTER TABLE ONLY app_v3.padel_tournament_configs
    ADD CONSTRAINT padel_tournament_configs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.payment_customers
    ADD CONSTRAINT payment_customers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.payout_records
    ADD CONSTRAINT payout_records_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.platform_settings
    ADD CONSTRAINT platform_settings_key_key UNIQUE (key);
ALTER TABLE ONLY app_v3.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.promo_redemptions
    ADD CONSTRAINT promo_redemptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.promo_redemptions
    ADD CONSTRAINT promo_redemptions_purchase_code_unique UNIQUE (purchase_id, promo_code_id);
ALTER TABLE ONLY app_v3.refunds
    ADD CONSTRAINT refunds_dedupe_key_key UNIQUE (dedupe_key);
ALTER TABLE ONLY app_v3.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.sale_lines
    ADD CONSTRAINT sale_lines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_payment_intent_id_key UNIQUE (payment_intent_id);
ALTER TABLE ONLY app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.service_staff
    ADD CONSTRAINT service_staff_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.split_payment_participants
    ADD CONSTRAINT split_payment_participants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.split_payments
    ADD CONSTRAINT split_payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.staff_assignments
    ADD CONSTRAINT staff_assignments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.ticket_resales
    ADD CONSTRAINT ticket_resales_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.ticket_reservations
    ADD CONSTRAINT ticket_reservations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.ticket_transfers
    ADD CONSTRAINT ticket_transfers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.ticket_types
    ADD CONSTRAINT ticket_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT tickets_purchase_ticket_idx UNIQUE (purchase_id, ticket_type_id, emission_index);
ALTER TABLE ONLY app_v3.tournament_audit_logs
    ADD CONSTRAINT tournament_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.tournament_entries
    ADD CONSTRAINT tournament_entries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.tournament_entries
    ADD CONSTRAINT tournament_entries_purchase_idx UNIQUE (purchase_id, emission_index);
ALTER TABLE ONLY app_v3.tournament_groups
    ADD CONSTRAINT tournament_groups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.tournament_matches
    ADD CONSTRAINT tournament_matches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.tournament_stages
    ADD CONSTRAINT tournament_stages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.tournaments
    ADD CONSTRAINT tournaments_event_id_key UNIQUE (event_id);
ALTER TABLE ONLY app_v3.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY app_v3.user_activities
    ADD CONSTRAINT user_activities_pkey PRIMARY KEY (id);
CREATE INDEX availabilities_service_id_idx ON app_v3.availabilities USING btree (service_id);
CREATE INDEX availabilities_starts_at_idx ON app_v3.availabilities USING btree (starts_at);
CREATE INDEX availabilities_status_idx ON app_v3.availabilities USING btree (status);
CREATE UNIQUE INDEX booking_policy_refs_booking_id_key ON app_v3.booking_policy_refs USING btree (booking_id);
CREATE INDEX booking_policy_refs_policy_id_idx ON app_v3.booking_policy_refs USING btree (policy_id);
CREATE INDEX bookings_availability_id_idx ON app_v3.bookings USING btree (availability_id);
CREATE INDEX bookings_organization_id_idx ON app_v3.bookings USING btree (organization_id);
CREATE UNIQUE INDEX bookings_payment_intent_id_key ON app_v3.bookings USING btree (payment_intent_id);
CREATE INDEX bookings_service_id_idx ON app_v3.bookings USING btree (service_id);
CREATE INDEX bookings_status_idx ON app_v3.bookings USING btree (status);
CREATE INDEX bookings_user_id_idx ON app_v3.bookings USING btree (user_id);
CREATE UNIQUE INDEX connect_accounts_organization_id_key ON app_v3.connect_accounts USING btree (organization_id);
CREATE UNIQUE INDEX connect_accounts_stripe_account_id_key ON app_v3.connect_accounts USING btree (stripe_account_id);
CREATE INDEX email_outbox_purchase_idx ON app_v3.email_outbox USING btree (purchase_id);
CREATE INDEX email_outbox_recipient_idx ON app_v3.email_outbox USING btree (recipient);
CREATE INDEX entitlement_checkins_event_idx ON app_v3.entitlement_checkins USING btree (event_id);
CREATE INDEX entitlement_checkins_purchase_idx ON app_v3.entitlement_checkins USING btree (purchase_id);
CREATE INDEX entitlement_qr_tokens_entitlement_idx ON app_v3.entitlement_qr_tokens USING btree (entitlement_id);
CREATE INDEX entitlements_event_idx ON app_v3.entitlements USING btree (event_id);
CREATE INDEX entitlements_season_idx ON app_v3.entitlements USING btree (season_id);
CREATE INDEX entitlements_status_idx ON app_v3.entitlements USING btree (status);
CREATE INDEX entitlements_tournament_idx ON app_v3.entitlements USING btree (tournament_id);
CREATE UNIQUE INDEX event_invites_event_identifier_uq ON app_v3.event_invites USING btree (event_id, target_identifier, scope);
CREATE INDEX event_invites_event_idx ON app_v3.event_invites USING btree (event_id);
CREATE INDEX event_invites_event_scope_idx ON app_v3.event_invites USING btree (event_id, scope);
CREATE INDEX event_invites_target_idx ON app_v3.event_invites USING btree (target_user_id);
CREATE INDEX events_organization_id_idx ON app_v3.events USING btree (organization_id);
CREATE INDEX events_owner_user_id_idx ON app_v3.events USING btree (owner_user_id);
CREATE UNIQUE INDEX events_slug_key ON app_v3.events USING btree (slug);
CREATE INDEX events_type_status_idx ON app_v3.events USING btree (type, status);
CREATE UNIQUE INDEX global_usernames_owner_unique ON app_v3.global_usernames USING btree (owner_type, owner_id);
CREATE INDEX guest_ticket_links_email_idx ON app_v3.guest_ticket_links USING btree (lower(guest_email));
CREATE INDEX guest_ticket_links_migrated_idx ON app_v3.guest_ticket_links USING btree (migrated_to_user_id);
CREATE INDEX idx_follows_follower ON app_v3.follows USING btree (follower_id);
CREATE INDEX idx_follows_following ON app_v3.follows USING btree (following_id);
CREATE INDEX idx_organization_follows_follower ON app_v3.organization_follows USING btree (follower_id);
CREATE INDEX idx_organization_follows_organization ON app_v3.organization_follows USING btree (organization_id);
CREATE INDEX match_notifications_match_idx ON app_v3.match_notifications USING btree (match_id);
CREATE UNIQUE INDEX notification_outbox_dedupe_idx ON app_v3.notification_outbox USING btree (dedupe_key);
CREATE INDEX notification_outbox_status_idx ON app_v3.notification_outbox USING btree (status);
CREATE INDEX notification_outbox_user_idx ON app_v3.notification_outbox USING btree (user_id);
CREATE INDEX notifications_event_id_idx ON app_v3.notifications USING btree (event_id);
CREATE INDEX notifications_from_user_id_idx ON app_v3.notifications USING btree (from_user_id);
CREATE INDEX notifications_invite_id_idx ON app_v3.notifications USING btree (invite_id);
CREATE INDEX notifications_organization_id_idx ON app_v3.notifications USING btree (organization_id);
CREATE INDEX notifications_ticket_id_idx ON app_v3.notifications USING btree (ticket_id);
CREATE INDEX notifications_user_id_created_at_idx ON app_v3.notifications USING btree (user_id, created_at);
CREATE INDEX notifications_user_id_read_at_idx ON app_v3.notifications USING btree (user_id, read_at);
CREATE INDEX operations_pi_idx ON app_v3.operations USING btree (payment_intent_id);
CREATE INDEX operations_purchase_idx ON app_v3.operations USING btree (purchase_id);
CREATE INDEX operations_status_idx ON app_v3.operations USING btree (status);
CREATE INDEX operations_stripe_event_idx ON app_v3.operations USING btree (stripe_event_id);
CREATE INDEX organization_audit_logs_actor_idx ON app_v3.organization_audit_logs USING btree (actor_user_id);
CREATE INDEX organization_audit_logs_org_idx ON app_v3.organization_audit_logs USING btree (organization_id);
CREATE INDEX organization_form_fields_form_id_idx ON app_v3.organization_form_fields USING btree (form_id);
CREATE INDEX organization_form_submissions_form_id_idx ON app_v3.organization_form_submissions USING btree (form_id);
CREATE INDEX organization_form_submissions_user_id_idx ON app_v3.organization_form_submissions USING btree (user_id);
CREATE INDEX organization_forms_organization_id_idx ON app_v3.organization_forms USING btree (organization_id);
CREATE INDEX organization_owner_transfers_from_idx ON app_v3.organization_owner_transfers USING btree (from_user_id);
CREATE INDEX organization_owner_transfers_org_idx ON app_v3.organization_owner_transfers USING btree (organization_id);
CREATE INDEX organization_owner_transfers_to_idx ON app_v3.organization_owner_transfers USING btree (to_user_id);
CREATE INDEX organization_policies_organization_id_idx ON app_v3.organization_policies USING btree (organization_id);
CREATE INDEX organization_policies_policy_type_idx ON app_v3.organization_policies USING btree (policy_type);
CREATE INDEX organization_reviews_organization_id_idx ON app_v3.organization_reviews USING btree (organization_id);
CREATE INDEX organization_reviews_user_id_idx ON app_v3.organization_reviews USING btree (user_id);
CREATE UNIQUE INDEX organization_follows_unique ON app_v3.organization_follows USING btree (follower_id, organization_id);
CREATE INDEX organization_member_invites_identifier_idx ON app_v3.organization_member_invites USING btree (target_identifier);
CREATE INDEX organization_member_invites_org_idx ON app_v3.organization_member_invites USING btree (organization_id);
CREATE INDEX organization_member_invites_target_idx ON app_v3.organization_member_invites USING btree (target_user_id);
CREATE INDEX organization_members_org_role_idx ON app_v3.organization_members USING btree (organization_id, role);
CREATE UNIQUE INDEX organization_members_org_user_uniq ON app_v3.organization_members USING btree (organization_id, user_id);
CREATE INDEX organization_members_user_idx ON app_v3.organization_members USING btree (user_id);
CREATE INDEX organization_members_user_last_used_idx ON app_v3.organization_members USING btree (user_id, last_used_at DESC, created_at);
CREATE INDEX organization_official_email_requests_org_idx ON app_v3.organization_official_email_requests USING btree (organization_id);
CREATE INDEX organizations_stripe_customer_idx ON app_v3.organizations USING btree (stripe_customer_id);
CREATE INDEX organizations_stripe_subscription_idx ON app_v3.organizations USING btree (stripe_subscription_id);
CREATE UNIQUE INDEX organizations_username_key ON app_v3.organizations USING btree (username) WHERE (username IS NOT NULL);
CREATE INDEX padel_availabilities_event_idx ON app_v3.padel_availabilities USING btree (event_id);
CREATE INDEX padel_availabilities_org_idx ON app_v3.padel_availabilities USING btree (organization_id);
CREATE INDEX padel_availabilities_profile_idx ON app_v3.padel_availabilities USING btree (player_profile_id);
CREATE INDEX padel_club_courts_club_idx ON app_v3.padel_club_courts USING btree (padel_club_id);
CREATE INDEX padel_club_staff_club_idx ON app_v3.padel_club_staff USING btree (padel_club_id);
CREATE INDEX padel_clubs_organization_idx ON app_v3.padel_clubs USING btree (organization_id);
CREATE INDEX padel_court_blocks_club_idx ON app_v3.padel_court_blocks USING btree (padel_club_id);
CREATE INDEX padel_court_blocks_court_idx ON app_v3.padel_court_blocks USING btree (court_id);
CREATE INDEX padel_court_blocks_event_idx ON app_v3.padel_court_blocks USING btree (event_id);
CREATE INDEX padel_court_blocks_org_idx ON app_v3.padel_court_blocks USING btree (organization_id);
CREATE INDEX padel_event_category_links_category_idx ON app_v3.padel_event_category_links USING btree (padel_category_id);
CREATE INDEX padel_event_category_links_event_idx ON app_v3.padel_event_category_links USING btree (event_id);
CREATE UNIQUE INDEX padel_event_category_links_unique ON app_v3.padel_event_category_links USING btree (event_id, padel_category_id);
CREATE INDEX padel_matches_court_idx ON app_v3.padel_matches USING btree (court_id);
CREATE INDEX padel_matches_pairings_idx ON app_v3.padel_matches USING btree (pairing_a_id, pairing_b_id);
CREATE UNIQUE INDEX padel_pairing_holds_active_unique ON app_v3.padel_pairing_holds USING btree (pairing_id) WHERE (status = 'ACTIVE'::app_v3."PadelPairingHoldStatus");
CREATE INDEX padel_pairing_holds_event_idx ON app_v3.padel_pairing_holds USING btree (event_id);
CREATE INDEX padel_pairing_holds_pairing_idx ON app_v3.padel_pairing_holds USING btree (pairing_id);
CREATE INDEX padel_pairing_slots_pairing_id_idx ON app_v3.padel_pairing_slots USING btree (pairing_id);
CREATE INDEX padel_pairing_slots_player_profile_idx ON app_v3.padel_pairing_slots USING btree (player_profile_id);
CREATE INDEX padel_pairing_slots_profile_id_idx ON app_v3.padel_pairing_slots USING btree (profile_id);
CREATE INDEX padel_pairings_category_id_idx ON app_v3.padel_pairings USING btree (category_id);
CREATE INDEX padel_pairings_event_id_idx ON app_v3.padel_pairings USING btree (event_id);
CREATE UNIQUE INDEX padel_pairings_event_player1_active_idx ON app_v3.padel_pairings USING btree (event_id, category_id, player1_user_id) WHERE ((lifecycle_status <> 'CANCELLED_INCOMPLETE'::app_v3."PadelPairingLifecycleStatus") AND (player1_user_id IS NOT NULL));
CREATE UNIQUE INDEX padel_pairings_event_player2_active_idx ON app_v3.padel_pairings USING btree (event_id, category_id, player2_user_id) WHERE ((lifecycle_status <> 'CANCELLED_INCOMPLETE'::app_v3."PadelPairingLifecycleStatus") AND (player2_user_id IS NOT NULL));
CREATE INDEX padel_pairings_organization_id_idx ON app_v3.padel_pairings USING btree (organization_id);
CREATE INDEX padel_pairings_player1_idx ON app_v3.padel_pairings USING btree (player1_user_id);
CREATE INDEX padel_pairings_player2_idx ON app_v3.padel_pairings USING btree (player2_user_id);
CREATE UNIQUE INDEX padel_player_profiles_uniq_email ON app_v3.padel_player_profiles USING btree (organization_id, email) WHERE (email IS NOT NULL);
CREATE INDEX padel_tournament_configs_padel_club_idx ON app_v3.padel_tournament_configs USING btree (padel_club_id);
CREATE UNIQUE INDEX payment_customers_stripe_customer_id_key ON app_v3.payment_customers USING btree (stripe_customer_id);
CREATE UNIQUE INDEX payment_customers_user_id_key ON app_v3.payment_customers USING btree (user_id);
CREATE INDEX payment_events_event_id_idx ON app_v3.payment_events USING btree (event_id);
CREATE UNIQUE INDEX payment_events_purchase_id_key ON app_v3.payment_events USING btree (purchase_id) WHERE (purchase_id IS NOT NULL);
CREATE UNIQUE INDEX payment_events_stripe_event_id_key ON app_v3.payment_events USING btree (stripe_event_id) WHERE (stripe_event_id IS NOT NULL);
CREATE UNIQUE INDEX payment_events_stripe_payment_intent_id_key ON app_v3.payment_events USING btree (stripe_payment_intent_id);
CREATE INDEX payout_records_organization_id_idx ON app_v3.payout_records USING btree (organization_id);
CREATE INDEX payout_records_stripe_payout_id_idx ON app_v3.payout_records USING btree (stripe_payout_id);
CREATE UNIQUE INDEX profiles_username_key ON app_v3.profiles USING btree (username);
CREATE UNIQUE INDEX promo_codes_code_ci_unique ON app_v3.promo_codes USING btree (lower(code));
CREATE INDEX promo_codes_event_active_idx ON app_v3.promo_codes USING btree (event_id, active);
CREATE INDEX promo_codes_event_id_idx ON app_v3.promo_codes USING btree (event_id);
CREATE INDEX promo_codes_valid_idx ON app_v3.promo_codes USING btree (valid_from, valid_until);
CREATE INDEX promo_redemptions_guest_email_idx ON app_v3.promo_redemptions USING btree (lower(guest_email));
CREATE UNIQUE INDEX promo_redemptions_guest_unique ON app_v3.promo_redemptions USING btree (promo_code_id, lower(guest_email)) WHERE (guest_email IS NOT NULL);
CREATE INDEX promo_redemptions_promo_idx ON app_v3.promo_redemptions USING btree (promo_code_id);
CREATE INDEX promo_redemptions_purchase_idx ON app_v3.promo_redemptions USING btree (purchase_id);
CREATE INDEX promo_redemptions_user_idx ON app_v3.promo_redemptions USING btree (user_id);
CREATE UNIQUE INDEX promo_redemptions_user_unique ON app_v3.promo_redemptions USING btree (promo_code_id, user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX refunds_event_idx ON app_v3.refunds USING btree (event_id);
CREATE INDEX refunds_payment_intent_idx ON app_v3.refunds USING btree (payment_intent_id);
CREATE INDEX refunds_purchase_idx ON app_v3.refunds USING btree (purchase_id);
CREATE INDEX sale_lines_event_idx ON app_v3.sale_lines USING btree (event_id);
CREATE INDEX sale_lines_promo_code_idx ON app_v3.sale_lines USING btree (promo_code_id);
CREATE INDEX sale_lines_summary_idx ON app_v3.sale_lines USING btree (sale_summary_id);
CREATE INDEX sale_lines_ticket_type_idx ON app_v3.sale_lines USING btree (ticket_type_id);
CREATE INDEX sale_summaries_event_idx ON app_v3.sale_summaries USING btree (event_id);
CREATE INDEX sale_summaries_promo_idx ON app_v3.sale_summaries USING btree (promo_code_id);
CREATE UNIQUE INDEX sale_summaries_purchase_id_key ON app_v3.sale_summaries USING btree (purchase_id) WHERE (purchase_id IS NOT NULL);
CREATE INDEX sale_summaries_user_idx ON app_v3.sale_summaries USING btree (user_id);
CREATE INDEX service_staff_service_id_idx ON app_v3.service_staff USING btree (service_id);
CREATE UNIQUE INDEX service_staff_service_id_user_id_key ON app_v3.service_staff USING btree (service_id, user_id);
CREATE INDEX service_staff_user_id_idx ON app_v3.service_staff USING btree (user_id);
CREATE INDEX services_is_active_idx ON app_v3.services USING btree (is_active);
CREATE INDEX services_organization_id_idx ON app_v3.services USING btree (organization_id);
CREATE INDEX services_policy_id_idx ON app_v3.services USING btree (policy_id);
CREATE INDEX split_payment_participants_split_payment_id_idx ON app_v3.split_payment_participants USING btree (split_payment_id);
CREATE INDEX split_payment_participants_status_idx ON app_v3.split_payment_participants USING btree (status);
CREATE INDEX split_payment_participants_user_id_idx ON app_v3.split_payment_participants USING btree (user_id);
CREATE INDEX split_payments_captain_user_id_idx ON app_v3.split_payments USING btree (captain_user_id);
CREATE INDEX split_payments_organization_id_idx ON app_v3.split_payments USING btree (organization_id);
CREATE INDEX staff_assignments_event_id_idx ON app_v3.staff_assignments USING btree (event_id);
CREATE INDEX staff_assignments_organization_id_idx ON app_v3.staff_assignments USING btree (organization_id);
CREATE INDEX staff_assignments_user_id_idx ON app_v3.staff_assignments USING btree (user_id);
CREATE INDEX ticket_resales_seller_user_id_idx ON app_v3.ticket_resales USING btree (seller_user_id);
CREATE INDEX ticket_resales_ticket_id_idx ON app_v3.ticket_resales USING btree (ticket_id);
CREATE INDEX ticket_reservations_status_expires_at_idx ON app_v3.ticket_reservations USING btree (status, expires_at);
CREATE INDEX ticket_reservations_ticket_type_id_idx ON app_v3.ticket_reservations USING btree (ticket_type_id);
CREATE INDEX ticket_reservations_user_id_idx ON app_v3.ticket_reservations USING btree (user_id);
CREATE INDEX ticket_transfers_from_user_id_idx ON app_v3.ticket_transfers USING btree (from_user_id);
CREATE INDEX ticket_transfers_ticket_id_idx ON app_v3.ticket_transfers USING btree (ticket_id);
CREATE INDEX ticket_transfers_to_user_id_idx ON app_v3.ticket_transfers USING btree (to_user_id);
CREATE INDEX "ticket_types_eventId_idx" ON app_v3.ticket_types USING btree (event_id);
CREATE INDEX ticket_types_padel_category_link_idx ON app_v3.ticket_types USING btree (padel_event_category_link_id);
CREATE INDEX "tickets_eventId_idx" ON app_v3.tickets USING btree (event_id);
CREATE INDEX tickets_pairing_id_idx ON app_v3.tickets USING btree (pairing_id);
CREATE UNIQUE INDEX tickets_qr_secret_key ON app_v3.tickets USING btree (qr_secret);
CREATE INDEX tickets_sale_summary_idx ON app_v3.tickets USING btree (sale_summary_id);
CREATE INDEX tickets_ticket_type_id_idx ON app_v3.tickets USING btree (ticket_type_id);
CREATE INDEX tickets_user_id_idx ON app_v3.tickets USING btree (user_id);
CREATE INDEX tournament_audit_logs_tournament_idx ON app_v3.tournament_audit_logs USING btree (tournament_id);
CREATE INDEX tournament_audit_logs_user_idx ON app_v3.tournament_audit_logs USING btree (user_id);
CREATE INDEX tournament_entries_category_idx ON app_v3.tournament_entries USING btree (category_id);
CREATE UNIQUE INDEX tournament_entries_event_category_user_unique ON app_v3.tournament_entries USING btree (event_id, category_id, user_id);
CREATE INDEX tournament_entries_pairing_idx ON app_v3.tournament_entries USING btree (pairing_id);
CREATE INDEX tournament_groups_stage_id_idx ON app_v3.tournament_groups USING btree (stage_id);
CREATE INDEX tournament_matches_group_id_idx ON app_v3.tournament_matches USING btree (group_id);
CREATE INDEX tournament_matches_stage_id_idx ON app_v3.tournament_matches USING btree (stage_id);
CREATE INDEX tournament_stages_tournament_id_idx ON app_v3.tournament_stages USING btree (tournament_id);
CREATE INDEX transactions_organization_id_idx ON app_v3.transactions USING btree (organization_id);
CREATE INDEX transactions_stripe_charge_id_idx ON app_v3.transactions USING btree (stripe_charge_id);
CREATE INDEX transactions_stripe_payment_intent_id_idx ON app_v3.transactions USING btree (stripe_payment_intent_id);
CREATE INDEX transactions_user_id_idx ON app_v3.transactions USING btree (user_id);
CREATE INDEX user_activities_type_idx ON app_v3.user_activities USING btree (type);
CREATE INDEX user_activities_user_id_idx ON app_v3.user_activities USING btree (user_id);
ALTER TABLE ONLY app_v3.availabilities
    ADD CONSTRAINT availabilities_service_id_fkey FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.booking_policy_refs
    ADD CONSTRAINT booking_policy_refs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES app_v3.bookings(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.booking_policy_refs
    ADD CONSTRAINT booking_policy_refs_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES app_v3.organization_policies(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.bookings
    ADD CONSTRAINT bookings_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES app_v3.availabilities(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.bookings
    ADD CONSTRAINT bookings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.bookings
    ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.connect_accounts
    ADD CONSTRAINT connect_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.email_identities
    ADD CONSTRAINT email_identities_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.email_outbox
    ADD CONSTRAINT email_outbox_entitlement_fk FOREIGN KEY (entitlement_id) REFERENCES app_v3.entitlements(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.entitlement_checkins
    ADD CONSTRAINT entitlement_checkins_entitlement_fkey FOREIGN KEY (entitlement_id) REFERENCES app_v3.entitlements(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.entitlement_qr_tokens
    ADD CONSTRAINT entitlement_qr_tokens_entitlement_fkey FOREIGN KEY (entitlement_id) REFERENCES app_v3.entitlements(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.guest_ticket_links
    ADD CONSTRAINT guest_ticket_links_migrated_to_user_id_fkey FOREIGN KEY (migrated_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.guest_ticket_links
    ADD CONSTRAINT guest_ticket_links_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.notifications
    ADD CONSTRAINT notifications_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.notifications
    ADD CONSTRAINT notifications_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES app_v3.organization_member_invites(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.notifications
    ADD CONSTRAINT notifications_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_form_fields
    ADD CONSTRAINT organization_form_fields_form_fk FOREIGN KEY (form_id) REFERENCES app_v3.organization_forms(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_form_submissions
    ADD CONSTRAINT organization_form_submissions_form_fk FOREIGN KEY (form_id) REFERENCES app_v3.organization_forms(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_form_submissions
    ADD CONSTRAINT organization_form_submissions_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.organization_forms
    ADD CONSTRAINT organization_forms_organization_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_modules
    ADD CONSTRAINT organization_modules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_policies
    ADD CONSTRAINT organization_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_reviews
    ADD CONSTRAINT organization_reviews_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_reviews
    ADD CONSTRAINT organization_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_follows
    ADD CONSTRAINT organization_follows_follower_fk FOREIGN KEY (follower_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_follows
    ADD CONSTRAINT organization_follows_organization_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_member_invites
    ADD CONSTRAINT organization_member_invites_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_member_invites
    ADD CONSTRAINT organization_member_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_members
    ADD CONSTRAINT organization_members_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES app_v3.profiles(id);
ALTER TABLE ONLY app_v3.organization_members
    ADD CONSTRAINT organization_members_org_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_members
    ADD CONSTRAINT organization_members_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organization_official_email_requests
    ADD CONSTRAINT organization_official_email_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.organizations
    ADD CONSTRAINT organizations_padel_default_rule_set_fk FOREIGN KEY (padel_default_rule_set_id) REFERENCES app_v3.padel_rule_sets(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_availabilities
    ADD CONSTRAINT padel_availabilities_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_availabilities
    ADD CONSTRAINT padel_availabilities_organization_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_availabilities
    ADD CONSTRAINT padel_availabilities_profile_fk FOREIGN KEY (player_profile_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_categories
    ADD CONSTRAINT padel_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_club_courts
    ADD CONSTRAINT padel_club_courts_padel_club_id_fkey FOREIGN KEY (padel_club_id) REFERENCES app_v3.padel_clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_club_staff
    ADD CONSTRAINT padel_club_staff_padel_club_id_fkey FOREIGN KEY (padel_club_id) REFERENCES app_v3.padel_clubs(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_clubs
    ADD CONSTRAINT padel_clubs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_court_blocks
    ADD CONSTRAINT padel_court_blocks_club_fk FOREIGN KEY (padel_club_id) REFERENCES app_v3.padel_clubs(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_court_blocks
    ADD CONSTRAINT padel_court_blocks_court_fk FOREIGN KEY (court_id) REFERENCES app_v3.padel_club_courts(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_court_blocks
    ADD CONSTRAINT padel_court_blocks_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_court_blocks
    ADD CONSTRAINT padel_court_blocks_organization_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_event_category_links
    ADD CONSTRAINT padel_event_category_links_category_fk FOREIGN KEY (padel_category_id) REFERENCES app_v3.padel_categories(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_event_category_links
    ADD CONSTRAINT padel_event_category_links_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_category_id_fkey FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_court_fk FOREIGN KEY (court_id) REFERENCES app_v3.padel_club_courts(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_pairing_a_fk FOREIGN KEY (pairing_a_id) REFERENCES app_v3.padel_pairings(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_pairing_b_fk FOREIGN KEY (pairing_b_id) REFERENCES app_v3.padel_pairings(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_team_a_id_fkey FOREIGN KEY (team_a_id) REFERENCES app_v3.padel_teams(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_team_b_id_fkey FOREIGN KEY (team_b_id) REFERENCES app_v3.padel_teams(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_matches
    ADD CONSTRAINT padel_matches_winner_fk FOREIGN KEY (winner_pairing_id) REFERENCES app_v3.padel_pairings(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_pairing_slots
    ADD CONSTRAINT padel_pairing_slots_pairing_id_fkey FOREIGN KEY (pairing_id) REFERENCES app_v3.padel_pairings(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_pairing_slots
    ADD CONSTRAINT padel_pairing_slots_player_profile_fk FOREIGN KEY (player_profile_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_pairing_slots
    ADD CONSTRAINT padel_pairing_slots_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_pairing_slots
    ADD CONSTRAINT padel_pairing_slots_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_pairings
    ADD CONSTRAINT padel_pairings_category_id_fkey FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_pairings
    ADD CONSTRAINT padel_pairings_created_ticket_fkey FOREIGN KEY (created_by_ticket_id) REFERENCES app_v3.tickets(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_pairings
    ADD CONSTRAINT padel_pairings_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_pairings
    ADD CONSTRAINT padel_pairings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_player_profiles
    ADD CONSTRAINT padel_player_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_player_profiles
    ADD CONSTRAINT padel_player_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_ranking_entries
    ADD CONSTRAINT padel_ranking_entries_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_ranking_entries
    ADD CONSTRAINT padel_ranking_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_ranking_entries
    ADD CONSTRAINT padel_ranking_entries_player_id_fkey FOREIGN KEY (player_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_rule_sets
    ADD CONSTRAINT padel_rule_sets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_teams
    ADD CONSTRAINT padel_teams_category_id_fkey FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_teams
    ADD CONSTRAINT padel_teams_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_teams
    ADD CONSTRAINT padel_teams_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_teams
    ADD CONSTRAINT padel_teams_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_tournament_configs
    ADD CONSTRAINT padel_tournament_configs_default_category_id_fkey FOREIGN KEY (default_category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_tournament_configs
    ADD CONSTRAINT padel_tournament_configs_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_tournament_configs
    ADD CONSTRAINT padel_tournament_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_tournament_configs
    ADD CONSTRAINT padel_tournament_configs_padel_club_id_fkey FOREIGN KEY (padel_club_id) REFERENCES app_v3.padel_clubs(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_tournament_configs
    ADD CONSTRAINT padel_tournament_configs_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES app_v3.padel_rule_sets(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.payment_customers
    ADD CONSTRAINT payment_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.payout_records
    ADD CONSTRAINT payout_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.promo_codes
    ADD CONSTRAINT promo_codes_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.promo_redemptions
    ADD CONSTRAINT promo_redemptions_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES app_v3.promo_codes(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.sale_lines
    ADD CONSTRAINT sale_lines_event_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.sale_lines
    ADD CONSTRAINT sale_lines_promo_code_fkey FOREIGN KEY (promo_code_id) REFERENCES app_v3.promo_codes(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.sale_lines
    ADD CONSTRAINT sale_lines_summary_fkey FOREIGN KEY (sale_summary_id) REFERENCES app_v3.sale_summaries(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.sale_lines
    ADD CONSTRAINT sale_lines_ticket_type_fkey FOREIGN KEY (ticket_type_id) REFERENCES app_v3.ticket_types(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES app_v3.promo_codes(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.service_staff
    ADD CONSTRAINT service_staff_service_id_fkey FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.service_staff
    ADD CONSTRAINT service_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.services
    ADD CONSTRAINT services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.services
    ADD CONSTRAINT services_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES app_v3.organization_policies(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.split_payment_participants
    ADD CONSTRAINT split_payment_participants_split_payment_id_fkey FOREIGN KEY (split_payment_id) REFERENCES app_v3.split_payments(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.split_payment_participants
    ADD CONSTRAINT split_payment_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.split_payments
    ADD CONSTRAINT split_payments_captain_user_id_fkey FOREIGN KEY (captain_user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.split_payments
    ADD CONSTRAINT split_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.ticket_resales
    ADD CONSTRAINT ticket_resales_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.ticket_reservations
    ADD CONSTRAINT ticket_reservations_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES app_v3.ticket_types(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.ticket_transfers
    ADD CONSTRAINT ticket_transfers_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.ticket_types
    ADD CONSTRAINT "ticket_types_eventId_fkey" FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.ticket_types
    ADD CONSTRAINT ticket_types_padel_category_link_fk FOREIGN KEY (padel_event_category_link_id) REFERENCES app_v3.padel_event_category_links(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT tickets_pairing_id_fkey FOREIGN KEY (pairing_id) REFERENCES app_v3.padel_pairings(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT tickets_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES app_v3.ticket_types(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.tournament_audit_logs
    ADD CONSTRAINT tournament_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.tournament_entries
    ADD CONSTRAINT tournament_entries_category_fk FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.tournament_groups
    ADD CONSTRAINT tournament_groups_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES app_v3.tournament_stages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.tournament_matches
    ADD CONSTRAINT tournament_matches_group_id_fkey FOREIGN KEY (group_id) REFERENCES app_v3.tournament_groups(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.tournament_matches
    ADD CONSTRAINT tournament_matches_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES app_v3.tournament_stages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.tournament_stages
    ADD CONSTRAINT tournament_stages_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES app_v3.tournaments(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.tournaments
    ADD CONSTRAINT tournaments_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.tournaments
    ADD CONSTRAINT tournaments_generated_by_user_fk FOREIGN KEY (generated_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.transactions
    ADD CONSTRAINT transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.user_activities
    ADD CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE app_v3.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_member_select ON app_v3.events FOR SELECT TO authenticated USING (((owner_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = events.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY events_member_update ON app_v3.events FOR UPDATE TO authenticated USING (((owner_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = events.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((owner_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = events.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY events_public_select ON app_v3.events FOR SELECT TO anon USING ((status = 'PUBLISHED'::app_v3."EventStatus"));
ALTER TABLE app_v3.guest_ticket_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY guest_ticket_links_owner_only ON app_v3.guest_ticket_links FOR SELECT TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = guest_email));
CREATE POLICY guest_ticket_links_service_role ON app_v3.guest_ticket_links TO service_role USING (true) WITH CHECK (true);
CREATE POLICY insert_own_resale ON app_v3.ticket_resales FOR INSERT TO authenticated WITH CHECK ((seller_user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY insert_own_transfer ON app_v3.ticket_transfers FOR INSERT TO authenticated WITH CHECK ((from_user_id = ( SELECT auth.uid() AS uid)));
ALTER TABLE app_v3.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_owner_only ON app_v3.notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY notifications_service_role ON app_v3.notifications TO service_role USING (true) WITH CHECK (true);
ALTER TABLE app_v3.organization_member_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_member_invites_delete ON app_v3.organization_member_invites FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organization_member_invites.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY organization_member_invites_insert ON app_v3.organization_member_invites FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organization_member_invites.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY organization_member_invites_select ON app_v3.organization_member_invites FOR SELECT TO authenticated USING (((target_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organization_member_invites.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY organization_member_invites_update ON app_v3.organization_member_invites FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organization_member_invites.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organization_member_invites.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_members_delete ON app_v3.organization_members FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m2
  WHERE ((m2.organization_id = organization_members.organization_id) AND (m2.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY organization_members_insert ON app_v3.organization_members FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m2
  WHERE ((m2.organization_id = organization_members.organization_id) AND (m2.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY organization_members_select ON app_v3.organization_members FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m2
  WHERE ((m2.organization_id = organization_members.organization_id) AND (m2.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY organization_members_update ON app_v3.organization_members FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m2
  WHERE ((m2.organization_id = organization_members.organization_id) AND (m2.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m2
  WHERE ((m2.organization_id = organization_members.organization_id) AND (m2.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_select_member ON app_v3.organizations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY organizations_update_member ON app_v3.organizations FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM app_v3.organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.padel_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY padel_categories_rw ON app_v3.padel_categories TO authenticated USING ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_categories.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_categories.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.padel_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY padel_matches_rw ON app_v3.padel_matches TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((app_v3.events e
     JOIN app_v3.organizations o ON ((o.id = e.organization_id)))
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((e.id = padel_matches.event_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((app_v3.events e
     JOIN app_v3.organizations o ON ((o.id = e.organization_id)))
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((e.id = padel_matches.event_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.padel_player_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY padel_player_profiles_rw ON app_v3.padel_player_profiles TO authenticated USING ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_player_profiles.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_player_profiles.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.padel_ranking_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY padel_ranking_entries_rw ON app_v3.padel_ranking_entries TO authenticated USING ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_ranking_entries.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_ranking_entries.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.padel_rule_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY padel_rule_sets_rw ON app_v3.padel_rule_sets TO authenticated USING ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_rule_sets.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_rule_sets.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.padel_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY padel_teams_rw ON app_v3.padel_teams TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((app_v3.events e
     JOIN app_v3.organizations o ON ((o.id = e.organization_id)))
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((e.id = padel_teams.event_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((app_v3.events e
     JOIN app_v3.organizations o ON ((o.id = e.organization_id)))
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((e.id = padel_teams.event_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.padel_tournament_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY padel_tournament_configs_rw ON app_v3.padel_tournament_configs TO authenticated USING ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_tournament_configs.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE ((o.id = padel_tournament_configs.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.sale_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY sale_lines_service_role ON app_v3.sale_lines FOR SELECT TO service_role USING (true);
CREATE POLICY sale_lines_view ON app_v3.sale_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM app_v3.sale_summaries s
  WHERE ((s.id = sale_lines.sale_summary_id) AND ((s.user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM (app_v3.events e
             JOIN app_v3.organization_members m ON ((m.organization_id = e.organization_id)))
          WHERE ((e.id = s.event_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))))))));
ALTER TABLE app_v3.sale_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY sale_summaries_service_role ON app_v3.sale_summaries FOR SELECT TO service_role USING (true);
CREATE POLICY sale_summaries_view ON app_v3.sale_summaries FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (app_v3.events e
     JOIN app_v3.organization_members m ON ((m.organization_id = e.organization_id)))
  WHERE ((e.id = sale_summaries.event_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY select_own_resales ON app_v3.ticket_resales FOR SELECT TO authenticated USING ((seller_user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY select_own_transfers ON app_v3.ticket_transfers FOR SELECT TO authenticated USING (((from_user_id = ( SELECT auth.uid() AS uid)) OR (to_user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY select_public_listed_resales ON app_v3.ticket_resales FOR SELECT TO anon USING ((status = 'LISTED'::app_v3."ResaleStatus"));
ALTER TABLE app_v3.staff_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_assignments_select ON app_v3.staff_assignments FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (organization_id IN ( SELECT o.id
   FROM (app_v3.organizations o
     JOIN app_v3.organization_members m ON ((m.organization_id = o.id)))
  WHERE (m.user_id = ( SELECT auth.uid() AS uid))))));
ALTER TABLE app_v3.ticket_resales ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_v3.ticket_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_v3.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tickets_service_role ON app_v3.tickets FOR SELECT TO service_role USING (true);
CREATE POLICY tickets_user_view ON app_v3.tickets FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (owner_user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY update_own_resale ON app_v3.ticket_resales FOR UPDATE TO authenticated USING ((seller_user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((seller_user_id = ( SELECT auth.uid() AS uid)));
