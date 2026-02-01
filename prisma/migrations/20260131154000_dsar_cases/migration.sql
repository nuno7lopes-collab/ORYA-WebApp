CREATE TYPE "app_v3"."DsarCaseType" AS ENUM ('EXPORT', 'DELETE');
CREATE TYPE "app_v3"."DsarCaseStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

CREATE TABLE "app_v3"."dsar_cases" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "type" "app_v3"."DsarCaseType" NOT NULL,
    "status" "app_v3"."DsarCaseStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" timestamptz NOT NULL DEFAULT now(),
    "due_at" timestamptz,
    "completed_at" timestamptz,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "dsar_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dsar_cases_user_status_idx" ON "app_v3"."dsar_cases"("user_id", "status");

ALTER TABLE "app_v3"."dsar_cases"
  ADD CONSTRAINT "dsar_cases_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
