export type CronJobDefinition = {
  key: string;
  envIntervalMs: string;
  defaultIntervalMs: number;
  method: "GET" | "POST";
  endpoint: string;
};

export const CRON_JOBS: CronJobDefinition[] = [
  {
    key: "operations",
    envIntervalMs: "CRON_OPERATIONS_INTERVAL_MS",
    defaultIntervalMs: 1000,
    method: "POST",
    endpoint: "/api/cron/operations",
  },
  {
    key: "bookings-cleanup",
    envIntervalMs: "CRON_BOOKINGS_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    method: "GET",
    endpoint: "/api/cron/bookings/cleanup",
  },
  {
    key: "reservations-cleanup",
    envIntervalMs: "CRON_RESERVATIONS_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    method: "GET",
    endpoint: "/api/cron/reservations/cleanup",
  },
  {
    key: "credits-expire",
    envIntervalMs: "CRON_CREDITS_INTERVAL_MS",
    defaultIntervalMs: 300_000,
    method: "GET",
    endpoint: "/api/cron/creditos/expire",
  },
  {
    key: "padel-expire",
    envIntervalMs: "CRON_PADEL_EXPIRE_INTERVAL_MS",
    defaultIntervalMs: 300_000,
    method: "POST",
    endpoint: "/api/cron/padel/expire",
  },
  {
    key: "padel-matchmaking",
    envIntervalMs: "CRON_PADEL_MATCHMAKING_INTERVAL_MS",
    defaultIntervalMs: 300_000,
    method: "POST",
    endpoint: "/api/cron/padel/matchmaking",
  },
  {
    key: "padel-split-reminders",
    envIntervalMs: "CRON_PADEL_SPLIT_REMINDERS_INTERVAL_MS",
    defaultIntervalMs: 300_000,
    method: "POST",
    endpoint: "/api/cron/padel/split-reminders",
  },
  {
    key: "padel-waitlist",
    envIntervalMs: "CRON_PADEL_WAITLIST_INTERVAL_MS",
    defaultIntervalMs: 300_000,
    method: "POST",
    endpoint: "/api/cron/padel/waitlist",
  },
  {
    key: "padel-reminders",
    envIntervalMs: "CRON_PADEL_REMINDERS_INTERVAL_MS",
    defaultIntervalMs: 300_000,
    method: "POST",
    endpoint: "/api/cron/padel/reminders",
  },
  {
    key: "padel-tournament-eve",
    envIntervalMs: "CRON_PADEL_TOURNAMENT_EVE_INTERVAL_MS",
    defaultIntervalMs: 3_600_000,
    method: "POST",
    endpoint: "/api/cron/padel/tournament-eve",
  },
  {
    key: "padel-partnership-grants-revoke",
    envIntervalMs: "CRON_PADEL_PARTNERSHIP_GRANTS_REVOKE_INTERVAL_MS",
    defaultIntervalMs: 300_000,
    method: "POST",
    endpoint: "/api/cron/padel/partnership-grants/revoke",
  },
  {
    key: "entitlements-qr-cleanup",
    envIntervalMs: "CRON_ENTITLEMENTS_QR_CLEANUP_INTERVAL_MS",
    defaultIntervalMs: 3_600_000,
    method: "GET",
    endpoint: "/api/cron/entitlements/qr-cleanup",
  },
  {
    key: "crm-rebuild",
    envIntervalMs: "CRON_CRM_REBUILD_INTERVAL_MS",
    defaultIntervalMs: 86_400_000,
    method: "POST",
    endpoint: "/api/cron/crm/rebuild",
  },
  {
    key: "crm-campanhas",
    envIntervalMs: "CRON_CRM_CAMPAIGNS_INTERVAL_MS",
    defaultIntervalMs: 60_000,
    method: "POST",
    endpoint: "/api/cron/crm/campanhas",
  },
  {
    key: "repair-usernames",
    envIntervalMs: "CRON_REPAIR_USERNAMES_INTERVAL_MS",
    defaultIntervalMs: 604_800_000,
    method: "POST",
    endpoint: "/api/cron/repair-usernames",
  },
  {
    key: "analytics-rollup",
    envIntervalMs: "CRON_ANALYTICS_INTERVAL_MS",
    defaultIntervalMs: 86_400_000,
    method: "POST",
    endpoint: "/api/cron/analytics/rollup",
  },
  {
    key: "loyalty-expire",
    envIntervalMs: "CRON_LOYALTY_EXPIRE_INTERVAL_MS",
    defaultIntervalMs: 86_400_000,
    method: "POST",
    endpoint: "/api/cron/loyalty/expire",
  },
];

export function getCronIntervalMs(job: CronJobDefinition) {
  const raw = process.env[job.envIntervalMs];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return job.defaultIntervalMs;
  return parsed;
}
