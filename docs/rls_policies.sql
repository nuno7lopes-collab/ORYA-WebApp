-- RLS baseline for organizer-owned data (Supabase / Postgres).
-- Apply with psql against your Supabase DB (schema app_v3).

-- Organizer members: a user only sees/edits memberships of orgs where they are a member.
ALTER TABLE app_v3.organizer_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizer_members_select ON app_v3.organizer_members;
CREATE POLICY organizer_members_select ON app_v3.organizer_members
  FOR SELECT USING (EXISTS (SELECT 1 FROM app_v3.organizer_members m2 WHERE m2.organizer_id = organizer_id AND m2.user_id = auth.uid()));
DROP POLICY IF EXISTS organizer_members_modify ON app_v3.organizer_members;
CREATE POLICY organizer_members_modify ON app_v3.organizer_members
  FOR ALL USING (EXISTS (SELECT 1 FROM app_v3.organizer_members m2 WHERE m2.organizer_id = organizer_id AND m2.user_id = auth.uid()));

-- Organizer member invites: visible if you are a manager of that org OR you are the invite target.
ALTER TABLE app_v3.organizer_member_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizer_member_invites_select ON app_v3.organizer_member_invites;
CREATE POLICY organizer_member_invites_select ON app_v3.organizer_member_invites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM app_v3.organizer_members m2 WHERE m2.organizer_id = organizer_id AND m2.user_id = auth.uid())
    OR target_user_id = auth.uid()
  );
DROP POLICY IF EXISTS organizer_member_invites_modify ON app_v3.organizer_member_invites;
CREATE POLICY organizer_member_invites_modify ON app_v3.organizer_member_invites
  FOR ALL USING (EXISTS (SELECT 1 FROM app_v3.organizer_members m2 WHERE m2.organizer_id = organizer_id AND m2.user_id = auth.uid()));

-- Notifications: owner only.
ALTER TABLE app_v3.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_owner_only ON app_v3.notifications;
CREATE POLICY notifications_owner_only ON app_v3.notifications
  FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_service_role ON app_v3.notifications;
CREATE POLICY notifications_service_role ON app_v3.notifications
  FOR ALL USING (current_setting('request.jwt.claim.role', true) = 'service_role');

-- Guest ticket links: owner only (used for migrate guest -> user).
ALTER TABLE app_v3.guest_ticket_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guest_ticket_links_owner_only ON app_v3.guest_ticket_links;
CREATE POLICY guest_ticket_links_owner_only ON app_v3.guest_ticket_links
  FOR ALL USING (guest_email IS NOT NULL AND auth.jwt() ->> 'email' = guest_email);
DROP POLICY IF EXISTS guest_ticket_links_service_role ON app_v3.guest_ticket_links;
CREATE POLICY guest_ticket_links_service_role ON app_v3.guest_ticket_links
  FOR ALL USING (current_setting('request.jwt.claim.role', true) = 'service_role');

-- Payout settings: only members of the organizer.
-- NOTE: organizers.id is int; auth.uid() is uuid. Cast uid to uuid to match organizer_members.user_id.
ALTER TABLE app_v3.organizers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizers_select_member ON app_v3.organizers;
CREATE POLICY organizers_select_member ON app_v3.organizers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_v3.organizer_members m
      WHERE m.organizer_id = app_v3.organizers.id
        AND m.user_id = auth.uid()::uuid
    )
  );
DROP POLICY IF EXISTS organizers_update_member ON app_v3.organizers;
CREATE POLICY organizers_update_member ON app_v3.organizers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM app_v3.organizer_members m
      WHERE m.organizer_id = app_v3.organizers.id
        AND m.user_id = auth.uid()::uuid
    )
  );

-- Tickets (optional hardening): user can see own tickets.
ALTER TABLE app_v3.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tickets_owner_or_guest ON app_v3.tickets;
CREATE POLICY tickets_owner_or_guest ON app_v3.tickets
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS tickets_service_role ON app_v3.tickets;
CREATE POLICY tickets_service_role ON app_v3.tickets
  FOR SELECT USING (current_setting('request.jwt.claim.role', true) = 'service_role');

-- Sale summaries/lines (optional hardening): only by organizer members or buyer.
ALTER TABLE app_v3.sale_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sale_summaries_view ON app_v3.sale_summaries;
CREATE POLICY sale_summaries_view ON app_v3.sale_summaries
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM app_v3.events e
      JOIN app_v3.organizer_members m ON m.organizer_id = e.organizer_id
      WHERE e.id = event_id
        AND m.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS sale_summaries_service_role ON app_v3.sale_summaries;
CREATE POLICY sale_summaries_service_role ON app_v3.sale_summaries
  FOR SELECT USING (current_setting('request.jwt.claim.role', true) = 'service_role');

ALTER TABLE app_v3.sale_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sale_lines_view ON app_v3.sale_lines;
CREATE POLICY sale_lines_view ON app_v3.sale_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app_v3.sale_summaries s
      WHERE s.id = sale_summary_id
        AND (
          s.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM app_v3.events e
            JOIN app_v3.organizer_members m ON m.organizer_id = e.organizer_id
            WHERE e.id = event_id
              AND m.user_id = auth.uid()
          )
        )
    )
  );
DROP POLICY IF EXISTS sale_lines_service_role ON app_v3.sale_lines;
CREATE POLICY sale_lines_service_role ON app_v3.sale_lines
  FOR SELECT USING (current_setting('request.jwt.claim.role', true) = 'service_role');

-- NOTE: adjust or drop optional policies if they conflict with analytics/reporting needs.
