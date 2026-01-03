CREATE TABLE app_v3.follow_requests (
    id integer NOT NULL,
    requester_id uuid NOT NULL,
    target_id uuid NOT NULL,
    created_at timestamptz(6) DEFAULT now() NOT NULL
);

CREATE SEQUENCE app_v3.follow_requests_id_seq;
ALTER SEQUENCE app_v3.follow_requests_id_seq OWNED BY app_v3.follow_requests.id;

ALTER TABLE ONLY app_v3.follow_requests ALTER COLUMN id SET DEFAULT nextval('app_v3.follow_requests_id_seq'::regclass);

ALTER TABLE ONLY app_v3.follow_requests
    ADD CONSTRAINT follow_requests_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX follow_requests_unique ON app_v3.follow_requests USING btree (requester_id, target_id);
CREATE INDEX idx_follow_requests_requester ON app_v3.follow_requests USING btree (requester_id);
CREATE INDEX idx_follow_requests_target ON app_v3.follow_requests USING btree (target_id);

ALTER TABLE ONLY app_v3.follow_requests
    ADD CONSTRAINT follow_requests_requester_fk FOREIGN KEY (requester_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
ALTER TABLE ONLY app_v3.follow_requests
    ADD CONSTRAINT follow_requests_target_fk FOREIGN KEY (target_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
