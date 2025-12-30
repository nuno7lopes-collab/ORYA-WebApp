CREATE TYPE "app_v3"."LiveHubVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'DISABLED');
CREATE TYPE "app_v3"."EventInviteScope" AS ENUM ('PUBLIC', 'PARTICIPANT');

ALTER TABLE "app_v3"."events"
ADD COLUMN "live_hub_visibility" "app_v3"."LiveHubVisibility" NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE "app_v3"."event_invites"
ADD COLUMN "scope" "app_v3"."EventInviteScope" NOT NULL DEFAULT 'PUBLIC';

DROP INDEX IF EXISTS "app_v3"."event_invites_event_identifier_uq";

CREATE UNIQUE INDEX "event_invites_event_identifier_uq"
ON "app_v3"."event_invites" ("event_id", "target_identifier", "scope");

CREATE INDEX "event_invites_event_scope_idx"
ON "app_v3"."event_invites" ("event_id", "scope");
