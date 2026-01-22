-- Create enum for RBAC access levels
CREATE TYPE "app_v3"."OrganizationPermissionLevel" AS ENUM ('NONE', 'VIEW', 'EDIT');

-- Create permissions table
CREATE TABLE "app_v3"."organization_member_permissions" (
  "id" SERIAL NOT NULL,
  "organization_id" INTEGER NOT NULL,
  "user_id" UUID NOT NULL,
  "module_key" "app_v3"."OrganizationModule" NOT NULL,
  "access_level" "app_v3"."OrganizationPermissionLevel" NOT NULL DEFAULT 'VIEW',
  "scope_type" TEXT,
  "scope_id" TEXT,
  "created_at" TIMESTAMPTZ(6) DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) DEFAULT now(),
  CONSTRAINT "organization_member_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_member_permissions_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "app_v3"."organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organization_member_permissions_user_fk" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "org_member_permission_unique" ON "app_v3"."organization_member_permissions" ("organization_id", "user_id", "module_key", "scope_type", "scope_id");
CREATE INDEX "org_member_permissions_org_user_idx" ON "app_v3"."organization_member_permissions" ("organization_id", "user_id");
CREATE INDEX "org_member_permissions_org_module_idx" ON "app_v3"."organization_member_permissions" ("organization_id", "module_key");
