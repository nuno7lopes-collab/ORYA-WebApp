BEGIN;

-- Remove semântica legacy de revenda no estado de bilhetes.
UPDATE app_v3.tickets
SET status = 'ACTIVE'::app_v3."TicketStatus"
WHERE status::text = 'RESALE_LISTED';

-- Postgres não permite remover valores de enum de forma portável em todas as versões;
-- recriamos o enum sem RESALE_LISTED e convertemos a coluna.
CREATE TYPE app_v3."TicketStatus_v2" AS ENUM (
  'ACTIVE',
  'REFUNDED',
  'TRANSFERRED',
  'DISPUTED',
  'CHARGEBACK_LOST',
  'CANCELLED'
);

-- O default mantém dependência no enum antigo; removemos antes de converter.
ALTER TABLE app_v3.tickets
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE app_v3.tickets
  ALTER COLUMN status TYPE app_v3."TicketStatus_v2"
  USING status::text::app_v3."TicketStatus_v2";

DROP TYPE app_v3."TicketStatus";
ALTER TYPE app_v3."TicketStatus_v2" RENAME TO "TicketStatus";

ALTER TABLE app_v3.tickets
  ALTER COLUMN status SET DEFAULT 'ACTIVE'::app_v3."TicketStatus";

COMMIT;
