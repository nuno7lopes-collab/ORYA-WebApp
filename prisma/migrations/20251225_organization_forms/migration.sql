DO $$ BEGIN
  CREATE TYPE "app_v3"."OrganizationFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "app_v3"."OrganizationFormFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "app_v3"."OrganizationFormSubmissionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'WAITLISTED', 'INVITED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "app_v3"."organization_forms" (
  "id" SERIAL PRIMARY KEY,
  "organizer_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "app_v3"."OrganizationFormStatus" NOT NULL DEFAULT 'DRAFT',
  "capacity" INTEGER,
  "waitlist_enabled" BOOLEAN NOT NULL DEFAULT true,
  "start_at" TIMESTAMPTZ(6),
  "end_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "organization_forms_organizer_fk" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "organization_forms_organizer_id_idx" ON "app_v3"."organization_forms" ("organizer_id");

CREATE TABLE IF NOT EXISTS "app_v3"."organization_form_fields" (
  "id" SERIAL PRIMARY KEY,
  "form_id" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "field_type" "app_v3"."OrganizationFormFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "help_text" TEXT,
  "placeholder" TEXT,
  "options" JSONB,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "organization_form_fields_form_fk" FOREIGN KEY ("form_id") REFERENCES "app_v3"."organization_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "organization_form_fields_form_id_idx" ON "app_v3"."organization_form_fields" ("form_id");

CREATE TABLE IF NOT EXISTS "app_v3"."organization_form_submissions" (
  "id" SERIAL PRIMARY KEY,
  "form_id" INTEGER NOT NULL,
  "user_id" UUID,
  "guest_email" TEXT,
  "status" "app_v3"."OrganizationFormSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "organization_form_submissions_form_fk" FOREIGN KEY ("form_id") REFERENCES "app_v3"."organization_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organization_form_submissions_user_fk" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "organization_form_submissions_form_id_idx" ON "app_v3"."organization_form_submissions" ("form_id");
CREATE INDEX IF NOT EXISTS "organization_form_submissions_user_id_idx" ON "app_v3"."organization_form_submissions" ("user_id");
