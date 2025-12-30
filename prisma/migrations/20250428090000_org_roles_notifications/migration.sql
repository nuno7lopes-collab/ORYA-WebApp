-- Novos tipos e colunas para organizações e notificações + atualização de roles

-- OrgType e colunas em organizers
DO $$
BEGIN
  CREATE TYPE app_v3."OrgType" AS ENUM ('PLATFORM', 'EXTERNAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE app_v3.organizers
  ADD COLUMN IF NOT EXISTS org_type app_v3."OrgType" NOT NULL DEFAULT 'EXTERNAL';

ALTER TABLE app_v3.organizers
  ADD COLUMN IF NOT EXISTS official_email text;

-- Atualização do enum OrganizerMemberRole (mapear CHECKIN_ONLY -> STAFF)
DO $$
BEGIN
  CREATE TYPE app_v3."OrganizerMemberRole_new" AS ENUM ('OWNER', 'CO_OWNER', 'ADMIN', 'STAFF', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE app_v3.organizer_members
  ALTER COLUMN role TYPE app_v3."OrganizerMemberRole_new"
  USING (
    CASE role::text
      WHEN 'CHECKIN_ONLY' THEN 'STAFF'
      ELSE role::text
    END::app_v3."OrganizerMemberRole_new"
  );

ALTER TABLE app_v3.organizer_member_invites
  ALTER COLUMN role TYPE app_v3."OrganizerMemberRole_new"
  USING (
    CASE role::text
      WHEN 'CHECKIN_ONLY' THEN 'STAFF'
      ELSE role::text
    END::app_v3."OrganizerMemberRole_new"
  );

ALTER TYPE app_v3."OrganizerMemberRole" RENAME TO "OrganizerMemberRole_old";
ALTER TYPE app_v3."OrganizerMemberRole_new" RENAME TO "OrganizerMemberRole";

DROP TYPE IF EXISTS app_v3."OrganizerMemberRole_old";

-- Garantir que NotificationType existe mesmo em bases antigas
DO $$
BEGIN
  CREATE TYPE app_v3."NotificationType" AS ENUM (
    'ORGANIZER_INVITE',
    'ORGANIZER_TRANSFER',
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
    'NEW_EVENT_FROM_FOLLOWED_ORGANIZER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Novos valores no enum NotificationType para flows sociais e bilhetes
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'FOLLOWED_YOU';
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'TICKET_TRANSFER_RECEIVED';
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'TICKET_TRANSFER_ACCEPTED';
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'TICKET_TRANSFER_DECLINED';
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'CLUB_INVITE';
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'NEW_EVENT_FROM_FOLLOWED_ORGANIZER';

-- Tabela notifications: alinhar com novo modelo (FKs e metadata)
DO $$
BEGIN
  ALTER TABLE app_v3.notifications RENAME COLUMN "userId" TO user_id;
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;

-- Permitir título/corpo opcionais e payload default {}
ALTER TABLE app_v3.notifications ALTER COLUMN title DROP NOT NULL;
ALTER TABLE app_v3.notifications ALTER COLUMN body DROP NOT NULL;
ALTER TABLE app_v3.notifications ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
UPDATE app_v3.notifications SET payload = '{}'::jsonb WHERE payload IS NULL;

-- Novas colunas de relação
ALTER TABLE app_v3.notifications
  ADD COLUMN IF NOT EXISTS from_user_id uuid,
  ADD COLUMN IF NOT EXISTS organizer_id integer,
  ADD COLUMN IF NOT EXISTS event_id integer,
  ADD COLUMN IF NOT EXISTS ticket_id text,
  ADD COLUMN IF NOT EXISTS invite_id uuid,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

-- Recriar FK do user (ajustar nome) e adicionar novas FKs
ALTER TABLE app_v3.notifications DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";

ALTER TABLE app_v3.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT notifications_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT notifications_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES app_v3.organizers(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT notifications_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT notifications_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES app_v3.organizer_member_invites(id) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Índices atualizados
DROP INDEX IF EXISTS "notifications_userId_created_at_idx";
DROP INDEX IF EXISTS "notifications_userId_read_at_idx";

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON app_v3.notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_id_read_at_idx ON app_v3.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_from_user_id_idx ON app_v3.notifications(from_user_id);
CREATE INDEX IF NOT EXISTS notifications_organizer_id_idx ON app_v3.notifications(organizer_id);
CREATE INDEX IF NOT EXISTS notifications_event_id_idx ON app_v3.notifications(event_id);
CREATE INDEX IF NOT EXISTS notifications_ticket_id_idx ON app_v3.notifications(ticket_id);
CREATE INDEX IF NOT EXISTS notifications_invite_id_idx ON app_v3.notifications(invite_id);

-- Alinhar flag de leitura com read_at existente
UPDATE app_v3.notifications SET is_read = TRUE WHERE read_at IS NOT NULL;

-- Constraint de unicidade em follows
DO $$
BEGIN
  ALTER TABLE app_v3.follows
    ADD CONSTRAINT follows_unique UNIQUE (follower_id, following_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Marcar a organização principal da ORYA como plataforma (preencher ID antes de correr em produção)
UPDATE app_v3.organizers
SET org_type = 'PLATFORM'
WHERE id = 4;
