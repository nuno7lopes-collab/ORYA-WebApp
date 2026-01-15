-- Create enum for waitlist status
CREATE TYPE app_v3."PadelWaitlistStatus" AS ENUM ('PENDING', 'PROMOTED', 'CANCELLED', 'EXPIRED');

-- Waitlist entries for Padel
CREATE TABLE app_v3.padel_waitlist_entries (
    id SERIAL NOT NULL,
    event_id INTEGER NOT NULL,
    organization_id INTEGER NOT NULL,
    category_id INTEGER,
    user_id UUID NOT NULL,
    payment_mode app_v3."PadelPaymentMode" NOT NULL,
    pairing_join_mode app_v3."PadelPairingJoinMode" NOT NULL,
    invited_contact TEXT,
    status app_v3."PadelWaitlistStatus" NOT NULL DEFAULT 'PENDING'::app_v3."PadelWaitlistStatus",
    promoted_pairing_id INTEGER,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT padel_waitlist_entries_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY app_v3.padel_waitlist_entries
    ADD CONSTRAINT padel_waitlist_event_category_user_uq UNIQUE (event_id, category_id, user_id);

CREATE INDEX padel_waitlist_event_status_idx ON app_v3.padel_waitlist_entries USING btree (event_id, status);
CREATE INDEX padel_waitlist_org_idx ON app_v3.padel_waitlist_entries USING btree (organization_id);

ALTER TABLE ONLY app_v3.padel_waitlist_entries
    ADD CONSTRAINT padel_waitlist_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_waitlist_entries
    ADD CONSTRAINT padel_waitlist_org_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_waitlist_entries
    ADD CONSTRAINT padel_waitlist_category_id_fkey FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY app_v3.padel_waitlist_entries
    ADD CONSTRAINT padel_waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.padel_waitlist_entries
    ADD CONSTRAINT padel_waitlist_promoted_pairing_id_fkey FOREIGN KEY (promoted_pairing_id) REFERENCES app_v3.padel_pairings(id) ON UPDATE CASCADE ON DELETE SET NULL;
