-- Remove unused ticket transfer flow
DROP VIEW IF EXISTS app_v3.ticket_history;
DROP TABLE IF EXISTS app_v3.ticket_transfers;
DROP TYPE IF EXISTS app_v3."TransferStatus";
