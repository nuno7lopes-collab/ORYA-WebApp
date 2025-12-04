--
-- PostgreSQL database dump
--

\restrict Vk9c0MqiRHnaToe1OG4kX2cimglJeiQxlwSlkz1NFNJyQggh78Pf4clpQwmcYpO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_v3; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_v3;


--
-- Name: EventCategoryType; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."EventCategoryType" AS ENUM (
    'FESTA',
    'DESPORTO',
    'CONCERTO',
    'PALESTRA',
    'ARTE',
    'COMIDA',
    'DRINKS'
);


--
-- Name: EventStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."EventStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'CANCELLED',
    'FINISHED'
);


--
-- Name: EventTemplateType; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."EventTemplateType" AS ENUM (
    'PARTY',
    'SPORT',
    'VOLUNTEERING',
    'TALK',
    'OTHER'
);


--
-- Name: EventType; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."EventType" AS ENUM (
    'EXPERIENCE',
    'ORGANIZER_EVENT'
);


--
-- Name: FeeMode; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."FeeMode" AS ENUM (
    'INCLUDED',
    'ADDED',
    'ON_TOP'
);


--
-- Name: OrganizerStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."OrganizerStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED'
);


--
-- Name: ResaleMode; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."ResaleMode" AS ENUM (
    'ALWAYS',
    'AFTER_SOLD_OUT',
    'DISABLED'
);


--
-- Name: ResaleStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."ResaleStatus" AS ENUM (
    'LISTED',
    'SOLD',
    'CANCELLED'
);


--
-- Name: ReservationStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."ReservationStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'EXPIRED',
    'CANCELED'
);


--
-- Name: StaffScope; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."StaffScope" AS ENUM (
    'GLOBAL',
    'EVENT'
);


--
-- Name: StaffStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."StaffStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED'
);


--
-- Name: TicketStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."TicketStatus" AS ENUM (
    'ACTIVE',
    'USED',
    'REFUNDED',
    'TRANSFERRED',
    'RESALE_LISTED'
);


--
-- Name: TicketTypeStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."TicketTypeStatus" AS ENUM (
    'ON_SALE',
    'UPCOMING',
    'CLOSED',
    'SOLD_OUT'
);


--
-- Name: TransferStatus; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."TransferStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'CANCELLED'
);


--
-- Name: Visibility; Type: TYPE; Schema: app_v3; Owner: -
--

CREATE TYPE app_v3."Visibility" AS ENUM (
    'PUBLIC',
    'PRIVATE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: event_categories; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.event_categories (
    id integer NOT NULL,
    event_id integer NOT NULL,
    category app_v3."EventCategoryType" NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_categories_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.event_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.event_categories_id_seq OWNED BY app_v3.event_categories.id;


--
-- Name: event_interests; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.event_interests (
    id text NOT NULL,
    "eventId" integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" uuid NOT NULL
);


--
-- Name: event_sales_agg; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.event_sales_agg (
    id integer NOT NULL,
    "eventId" integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    tickets_sold integer DEFAULT 0 NOT NULL,
    revenue integer DEFAULT 0 NOT NULL
);


--
-- Name: event_sales_agg_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.event_sales_agg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_sales_agg_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.event_sales_agg_id_seq OWNED BY app_v3.event_sales_agg.id;


--
-- Name: event_views; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.event_views (
    id text NOT NULL,
    "eventId" integer NOT NULL,
    session_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" uuid
);


--
-- Name: events; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.events (
    id integer NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type app_v3."EventType" DEFAULT 'EXPERIENCE'::app_v3."EventType" NOT NULL,
    template_type app_v3."EventTemplateType",
    organizer_id integer,
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
    is_test boolean DEFAULT false NOT NULL
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.events_id_seq OWNED BY app_v3.events.id;


--
-- Name: experience_participants; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.experience_participants (
    id text NOT NULL,
    "eventId" integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" uuid NOT NULL,
    volunteer_minutes integer
);


--
-- Name: follows; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.follows (
    id integer NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: follows_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: follows_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.follows_id_seq OWNED BY app_v3.follows.id;


--
-- Name: guest_ticket_links; Type: TABLE; Schema: app_v3; Owner: -
--

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


--
-- Name: organizers; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.organizers (
    id integer NOT NULL,
    display_name text NOT NULL,
    stripe_account_id text,
    status app_v3."OrganizerStatus" DEFAULT 'PENDING'::app_v3."OrganizerStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id uuid NOT NULL,
    fee_mode app_v3."FeeMode" DEFAULT 'ADDED'::app_v3."FeeMode" NOT NULL,
    platform_fee_bps integer DEFAULT 200 NOT NULL,
    platform_fee_fixed_cents integer DEFAULT 0 NOT NULL,
    stripe_charges_enabled boolean DEFAULT false NOT NULL,
    stripe_payouts_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: organizers_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.organizers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizers_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.organizers_id_seq OWNED BY app_v3.organizers.id;


--
-- Name: payment_events; Type: TABLE; Schema: app_v3; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_events_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.payment_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_events_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.payment_events_id_seq OWNED BY app_v3.payment_events.id;


--
-- Name: platform_settings; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.platform_settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: platform_settings_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.platform_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.platform_settings_id_seq OWNED BY app_v3.platform_settings.id;


--
-- Name: profiles; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.profiles (
    id uuid NOT NULL,
    username text,
    full_name text,
    avatar_url text,
    bio text,
    city text,
    favourite_categories text[] DEFAULT ARRAY[]::text[],
    onboarding_done boolean DEFAULT false NOT NULL,
    roles text[] DEFAULT ARRAY['user'::text],
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    allow_email_notifications boolean DEFAULT true NOT NULL,
    allow_event_reminders boolean DEFAULT true NOT NULL,
    allow_friend_requests boolean DEFAULT true NOT NULL,
    deleted_at timestamp without time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    visibility app_v3."Visibility" DEFAULT 'PUBLIC'::app_v3."Visibility" NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    contact_phone text
);


--
-- Name: staff_assignments; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.staff_assignments (
    id integer NOT NULL,
    organizer_id integer NOT NULL,
    scope app_v3."StaffScope" NOT NULL,
    event_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_at timestamp(3) without time zone,
    user_id uuid NOT NULL,
    accepted_at timestamp without time zone,
    status app_v3."StaffStatus" DEFAULT 'PENDING'::app_v3."StaffStatus" NOT NULL
);


--
-- Name: staff_assignments_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.staff_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.staff_assignments_id_seq OWNED BY app_v3.staff_assignments.id;


--
-- Name: ticket_resales; Type: TABLE; Schema: app_v3; Owner: -
--

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


--
-- Name: ticket_transfers; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.ticket_transfers (
    id text NOT NULL,
    ticket_id text NOT NULL,
    status app_v3."TransferStatus" DEFAULT 'PENDING'::app_v3."TransferStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL
);


--
-- Name: ticket_history; Type: VIEW; Schema: app_v3; Owner: -
--

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


--
-- Name: ticket_reservations; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.ticket_reservations (
    id text NOT NULL,
    "eventId" integer NOT NULL,
    ticket_type_id integer NOT NULL,
    quantity integer NOT NULL,
    status app_v3."ReservationStatus" DEFAULT 'ACTIVE'::app_v3."ReservationStatus" NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id uuid
);


--
-- Name: ticket_types; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.ticket_types (
    id integer NOT NULL,
    "eventId" integer NOT NULL,
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
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: ticket_types_id_seq; Type: SEQUENCE; Schema: app_v3; Owner: -
--

CREATE SEQUENCE app_v3.ticket_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_types_id_seq; Type: SEQUENCE OWNED BY; Schema: app_v3; Owner: -
--

ALTER SEQUENCE app_v3.ticket_types_id_seq OWNED BY app_v3.ticket_types.id;


--
-- Name: tickets; Type: TABLE; Schema: app_v3; Owner: -
--

CREATE TABLE app_v3.tickets (
    id text NOT NULL,
    "eventId" integer NOT NULL,
    ticket_type_id integer NOT NULL,
    purchased_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status app_v3."TicketStatus" DEFAULT 'ACTIVE'::app_v3."TicketStatus" NOT NULL,
    qr_secret text NOT NULL,
    rotating_seed uuid,
    price_paid integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    stripe_payment_intent_id text,
    used_at timestamp(3) without time zone,
    user_id uuid,
    platform_fee_cents integer DEFAULT 0 NOT NULL,
    total_paid_cents integer DEFAULT 0 NOT NULL
);


--
-- Name: event_categories id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_categories ALTER COLUMN id SET DEFAULT nextval('app_v3.event_categories_id_seq'::regclass);


--
-- Name: event_sales_agg id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_sales_agg ALTER COLUMN id SET DEFAULT nextval('app_v3.event_sales_agg_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.events ALTER COLUMN id SET DEFAULT nextval('app_v3.events_id_seq'::regclass);


--
-- Name: follows id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.follows ALTER COLUMN id SET DEFAULT nextval('app_v3.follows_id_seq'::regclass);


--
-- Name: organizers id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.organizers ALTER COLUMN id SET DEFAULT nextval('app_v3.organizers_id_seq'::regclass);


--
-- Name: payment_events id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.payment_events ALTER COLUMN id SET DEFAULT nextval('app_v3.payment_events_id_seq'::regclass);


--
-- Name: platform_settings id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.platform_settings ALTER COLUMN id SET DEFAULT nextval('app_v3.platform_settings_id_seq'::regclass);


--
-- Name: staff_assignments id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.staff_assignments ALTER COLUMN id SET DEFAULT nextval('app_v3.staff_assignments_id_seq'::regclass);


--
-- Name: ticket_types id; Type: DEFAULT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_types ALTER COLUMN id SET DEFAULT nextval('app_v3.ticket_types_id_seq'::regclass);


--
-- Name: event_categories event_categories_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_categories
    ADD CONSTRAINT event_categories_pkey PRIMARY KEY (id);


--
-- Name: event_categories event_categories_unique; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_categories
    ADD CONSTRAINT event_categories_unique UNIQUE (event_id, category);


--
-- Name: event_interests event_interests_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_interests
    ADD CONSTRAINT event_interests_pkey PRIMARY KEY (id);


--
-- Name: event_sales_agg event_sales_agg_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_sales_agg
    ADD CONSTRAINT event_sales_agg_pkey PRIMARY KEY (id);


--
-- Name: event_views event_views_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_views
    ADD CONSTRAINT event_views_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: experience_participants experience_participants_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.experience_participants
    ADD CONSTRAINT experience_participants_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: follows follows_unique; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_unique UNIQUE (follower_id, following_id);


--
-- Name: guest_ticket_links guest_ticket_links_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.guest_ticket_links
    ADD CONSTRAINT guest_ticket_links_pkey PRIMARY KEY (ticket_id);


--
-- Name: organizers organizers_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.organizers
    ADD CONSTRAINT organizers_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_key_key; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.platform_settings
    ADD CONSTRAINT platform_settings_key_key UNIQUE (key);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: staff_assignments staff_assignments_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.staff_assignments
    ADD CONSTRAINT staff_assignments_pkey PRIMARY KEY (id);


--
-- Name: ticket_resales ticket_resales_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_resales
    ADD CONSTRAINT ticket_resales_pkey PRIMARY KEY (id);


--
-- Name: ticket_reservations ticket_reservations_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_reservations
    ADD CONSTRAINT ticket_reservations_pkey PRIMARY KEY (id);


--
-- Name: ticket_transfers ticket_transfers_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_transfers
    ADD CONSTRAINT ticket_transfers_pkey PRIMARY KEY (id);


--
-- Name: ticket_types ticket_types_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_types
    ADD CONSTRAINT ticket_types_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: event_categories_category_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX event_categories_category_idx ON app_v3.event_categories USING btree (category);


--
-- Name: event_interests_eventId_userId_key; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX "event_interests_eventId_userId_key" ON app_v3.event_interests USING btree ("eventId", "userId");


--
-- Name: event_interests_userId_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX "event_interests_userId_idx" ON app_v3.event_interests USING btree ("userId");


--
-- Name: event_sales_agg_eventId_key; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX "event_sales_agg_eventId_key" ON app_v3.event_sales_agg USING btree ("eventId");


--
-- Name: event_views_eventId_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX "event_views_eventId_idx" ON app_v3.event_views USING btree ("eventId");


--
-- Name: event_views_userId_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX "event_views_userId_idx" ON app_v3.event_views USING btree ("userId");


--
-- Name: events_organizer_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX events_organizer_id_idx ON app_v3.events USING btree (organizer_id);


--
-- Name: events_owner_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX events_owner_user_id_idx ON app_v3.events USING btree (owner_user_id);


--
-- Name: events_slug_key; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX events_slug_key ON app_v3.events USING btree (slug);


--
-- Name: events_type_status_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX events_type_status_idx ON app_v3.events USING btree (type, status);


--
-- Name: experience_participants_eventId_userId_key; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX "experience_participants_eventId_userId_key" ON app_v3.experience_participants USING btree ("eventId", "userId");


--
-- Name: experience_participants_userId_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX "experience_participants_userId_idx" ON app_v3.experience_participants USING btree ("userId");


--
-- Name: guest_ticket_links_email_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX guest_ticket_links_email_idx ON app_v3.guest_ticket_links USING btree (lower(guest_email));


--
-- Name: guest_ticket_links_migrated_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX guest_ticket_links_migrated_idx ON app_v3.guest_ticket_links USING btree (migrated_to_user_id);


--
-- Name: idx_follows_follower; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX idx_follows_follower ON app_v3.follows USING btree (follower_id);


--
-- Name: idx_follows_following; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX idx_follows_following ON app_v3.follows USING btree (following_id);


--
-- Name: organizers_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX organizers_user_id_idx ON app_v3.organizers USING btree (user_id);


--
-- Name: payment_events_event_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX payment_events_event_id_idx ON app_v3.payment_events USING btree (event_id);


--
-- Name: payment_events_stripe_payment_intent_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX payment_events_stripe_payment_intent_id_idx ON app_v3.payment_events USING btree (stripe_payment_intent_id);


--
-- Name: payment_events_stripe_payment_intent_id_key; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX payment_events_stripe_payment_intent_id_key ON app_v3.payment_events USING btree (stripe_payment_intent_id);


--
-- Name: platform_settings_key_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX platform_settings_key_idx ON app_v3.platform_settings USING btree (key);


--
-- Name: profiles_username_key; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX profiles_username_key ON app_v3.profiles USING btree (username);


--
-- Name: staff_assignments_event_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX staff_assignments_event_id_idx ON app_v3.staff_assignments USING btree (event_id);


--
-- Name: staff_assignments_organizer_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX staff_assignments_organizer_id_idx ON app_v3.staff_assignments USING btree (organizer_id);


--
-- Name: staff_assignments_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX staff_assignments_user_id_idx ON app_v3.staff_assignments USING btree (user_id);


--
-- Name: ticket_resales_seller_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_resales_seller_user_id_idx ON app_v3.ticket_resales USING btree (seller_user_id);


--
-- Name: ticket_resales_ticket_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_resales_ticket_id_idx ON app_v3.ticket_resales USING btree (ticket_id);


--
-- Name: ticket_reservations_eventId_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX "ticket_reservations_eventId_idx" ON app_v3.ticket_reservations USING btree ("eventId");


--
-- Name: ticket_reservations_status_expires_at_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_reservations_status_expires_at_idx ON app_v3.ticket_reservations USING btree (status, expires_at);


--
-- Name: ticket_reservations_ticket_type_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_reservations_ticket_type_id_idx ON app_v3.ticket_reservations USING btree (ticket_type_id);


--
-- Name: ticket_reservations_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_reservations_user_id_idx ON app_v3.ticket_reservations USING btree (user_id);


--
-- Name: ticket_transfers_from_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_transfers_from_user_id_idx ON app_v3.ticket_transfers USING btree (from_user_id);


--
-- Name: ticket_transfers_ticket_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_transfers_ticket_id_idx ON app_v3.ticket_transfers USING btree (ticket_id);


--
-- Name: ticket_transfers_to_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX ticket_transfers_to_user_id_idx ON app_v3.ticket_transfers USING btree (to_user_id);


--
-- Name: ticket_types_eventId_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX "ticket_types_eventId_idx" ON app_v3.ticket_types USING btree ("eventId");


--
-- Name: tickets_eventId_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX "tickets_eventId_idx" ON app_v3.tickets USING btree ("eventId");


--
-- Name: tickets_qr_secret_key; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE UNIQUE INDEX tickets_qr_secret_key ON app_v3.tickets USING btree (qr_secret);


--
-- Name: tickets_stripe_payment_intent_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX tickets_stripe_payment_intent_id_idx ON app_v3.tickets USING btree (stripe_payment_intent_id);


--
-- Name: tickets_ticket_type_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX tickets_ticket_type_id_idx ON app_v3.tickets USING btree (ticket_type_id);


--
-- Name: tickets_user_id_idx; Type: INDEX; Schema: app_v3; Owner: -
--

CREATE INDEX tickets_user_id_idx ON app_v3.tickets USING btree (user_id);


--
-- Name: event_categories event_categories_event_fk; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_categories
    ADD CONSTRAINT event_categories_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;


--
-- Name: event_interests event_interests_eventId_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_interests
    ADD CONSTRAINT "event_interests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_sales_agg event_sales_agg_eventId_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_sales_agg
    ADD CONSTRAINT "event_sales_agg_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: event_views event_views_eventId_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.event_views
    ADD CONSTRAINT "event_views_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: events events_organizer_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.events
    ADD CONSTRAINT events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES app_v3.organizers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: experience_participants experience_participants_eventId_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.experience_participants
    ADD CONSTRAINT "experience_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;


--
-- Name: guest_ticket_links guest_ticket_links_migrated_to_user_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.guest_ticket_links
    ADD CONSTRAINT guest_ticket_links_migrated_to_user_id_fkey FOREIGN KEY (migrated_to_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: guest_ticket_links guest_ticket_links_ticket_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.guest_ticket_links
    ADD CONSTRAINT guest_ticket_links_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON DELETE CASCADE;


--
-- Name: organizers organizers_user_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.organizers
    ADD CONSTRAINT organizers_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: staff_assignments staff_assignments_event_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.staff_assignments
    ADD CONSTRAINT staff_assignments_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: staff_assignments staff_assignments_organizer_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.staff_assignments
    ADD CONSTRAINT staff_assignments_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES app_v3.organizers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_resales ticket_resales_ticket_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_resales
    ADD CONSTRAINT ticket_resales_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_reservations ticket_reservations_eventId_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_reservations
    ADD CONSTRAINT "ticket_reservations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_reservations ticket_reservations_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_reservations
    ADD CONSTRAINT ticket_reservations_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES app_v3.ticket_types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_transfers ticket_transfers_ticket_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_transfers
    ADD CONSTRAINT ticket_transfers_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_types ticket_types_eventId_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.ticket_types
    ADD CONSTRAINT "ticket_types_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tickets tickets_eventId_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tickets tickets_ticket_type_id_fkey; Type: FK CONSTRAINT; Schema: app_v3; Owner: -
--

ALTER TABLE ONLY app_v3.tickets
    ADD CONSTRAINT tickets_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES app_v3.ticket_types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tickets No direct insert/update from anon; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "No direct insert/update from anon" ON app_v3.tickets USING (false);


--
-- Name: events Organizer can see own events; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "Organizer can see own events" ON app_v3.events FOR SELECT USING ((owner_user_id = auth.uid()));


--
-- Name: events Organizer can update own events; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "Organizer can update own events" ON app_v3.events FOR UPDATE USING ((owner_user_id = auth.uid()));


--
-- Name: staff_assignments Organizer sees assignments for own organizerIds; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "Organizer sees assignments for own organizerIds" ON app_v3.staff_assignments FOR SELECT USING ((organizer_id IN ( SELECT organizers.id
   FROM app_v3.organizers
  WHERE (organizers.user_id = auth.uid()))));


--
-- Name: events Public can see published events; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "Public can see published events" ON app_v3.events FOR SELECT USING ((status = 'PUBLISHED'::app_v3."EventStatus"));


--
-- Name: staff_assignments Staff sees own assignments; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "Staff sees own assignments" ON app_v3.staff_assignments FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: tickets User can see own tickets; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "User can see own tickets" ON app_v3.tickets FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: organizers User sees own organizer record; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY "User sees own organizer record" ON app_v3.organizers FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: events; Type: ROW SECURITY; Schema: app_v3; Owner: -
--

ALTER TABLE app_v3.events ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_resales insert_own_resale; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY insert_own_resale ON app_v3.ticket_resales FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (seller_user_id = auth.uid())));


--
-- Name: ticket_transfers insert_own_transfer; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY insert_own_transfer ON app_v3.ticket_transfers FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (from_user_id = auth.uid())));


--
-- Name: organizers; Type: ROW SECURITY; Schema: app_v3; Owner: -
--

ALTER TABLE app_v3.organizers ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_resales select_own_resales; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY select_own_resales ON app_v3.ticket_resales FOR SELECT USING (((auth.uid() IS NOT NULL) AND (seller_user_id = auth.uid())));


--
-- Name: ticket_transfers select_own_transfers; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY select_own_transfers ON app_v3.ticket_transfers FOR SELECT USING (((auth.uid() IS NOT NULL) AND ((from_user_id = auth.uid()) OR (to_user_id = auth.uid()))));


--
-- Name: ticket_resales select_public_listed_resales; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY select_public_listed_resales ON app_v3.ticket_resales FOR SELECT USING ((status = 'LISTED'::app_v3."ResaleStatus"));


--
-- Name: staff_assignments; Type: ROW SECURITY; Schema: app_v3; Owner: -
--

ALTER TABLE app_v3.staff_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_resales; Type: ROW SECURITY; Schema: app_v3; Owner: -
--

ALTER TABLE app_v3.ticket_resales ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_transfers; Type: ROW SECURITY; Schema: app_v3; Owner: -
--

ALTER TABLE app_v3.ticket_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: app_v3; Owner: -
--

ALTER TABLE app_v3.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_resales update_own_resale; Type: POLICY; Schema: app_v3; Owner: -
--

CREATE POLICY update_own_resale ON app_v3.ticket_resales FOR UPDATE USING (((auth.uid() IS NOT NULL) AND (seller_user_id = auth.uid()))) WITH CHECK (((auth.uid() IS NOT NULL) AND (seller_user_id = auth.uid())));


--
-- PostgreSQL database dump complete
--

\unrestrict Vk9c0MqiRHnaToe1OG4kX2cimglJeiQxlwSlkz1NFNJyQggh78Pf4clpQwmcYpO

