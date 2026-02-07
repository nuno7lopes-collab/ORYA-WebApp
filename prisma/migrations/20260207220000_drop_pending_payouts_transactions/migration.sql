-- Drop legacy payout control tables and enums

DROP INDEX IF EXISTS app_v3.payouts_pending_idx;
ALTER TABLE app_v3.payouts DROP COLUMN IF EXISTS pending_payout_id;

DROP TABLE IF EXISTS app_v3.pending_payouts;
DROP TABLE IF EXISTS app_v3.transactions;

DROP TYPE IF EXISTS app_v3."PendingPayoutStatus";
DROP TYPE IF EXISTS app_v3."TransactionPayoutStatus";
