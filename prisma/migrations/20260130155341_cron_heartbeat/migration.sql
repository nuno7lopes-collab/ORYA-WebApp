CREATE TABLE "app_v3"."cron_heartbeats" (
    "job_key" text NOT NULL,
    "last_run_at" timestamptz NOT NULL,
    "last_success_at" timestamptz,
    "last_error_at" timestamptz,
    "last_error" text,
    "run_count" integer NOT NULL DEFAULT 0,
    "success_count" integer NOT NULL DEFAULT 0,
    "error_count" integer NOT NULL DEFAULT 0,
    "last_duration_ms" integer,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "cron_heartbeats_pkey" PRIMARY KEY ("job_key")
);

CREATE INDEX "cron_heartbeats_last_run_idx" ON "app_v3"."cron_heartbeats"("last_run_at");
