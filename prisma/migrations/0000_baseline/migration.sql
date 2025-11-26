-- DropForeignKey
ALTER TABLE "app_v3"."profiles" DROP CONSTRAINT "profiles_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."identities" DROP CONSTRAINT "identities_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."mfa_amr_claims" DROP CONSTRAINT "mfa_amr_claims_session_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."mfa_challenges" DROP CONSTRAINT "mfa_challenges_auth_factor_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."mfa_factors" DROP CONSTRAINT "mfa_factors_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."oauth_authorizations" DROP CONSTRAINT "oauth_authorizations_client_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."oauth_authorizations" DROP CONSTRAINT "oauth_authorizations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."oauth_consents" DROP CONSTRAINT "oauth_consents_client_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."oauth_consents" DROP CONSTRAINT "oauth_consents_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."one_time_tokens" DROP CONSTRAINT "one_time_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."refresh_tokens" DROP CONSTRAINT "refresh_tokens_session_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."saml_providers" DROP CONSTRAINT "saml_providers_sso_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."saml_relay_states" DROP CONSTRAINT "saml_relay_states_flow_state_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."saml_relay_states" DROP CONSTRAINT "saml_relay_states_sso_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."sessions" DROP CONSTRAINT "sessions_oauth_client_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth"."sso_domains" DROP CONSTRAINT "sso_domains_sso_provider_id_fkey";

-- AlterTable
ALTER TABLE "app_v3"."profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "auth"."audit_log_entries";

-- DropTable
DROP TABLE "auth"."flow_state";

-- DropTable
DROP TABLE "auth"."identities";

-- DropTable
DROP TABLE "auth"."instances";

-- DropTable
DROP TABLE "auth"."mfa_amr_claims";

-- DropTable
DROP TABLE "auth"."mfa_challenges";

-- DropTable
DROP TABLE "auth"."mfa_factors";

-- DropTable
DROP TABLE "auth"."oauth_authorizations";

-- DropTable
DROP TABLE "auth"."oauth_clients";

-- DropTable
DROP TABLE "auth"."oauth_consents";

-- DropTable
DROP TABLE "auth"."one_time_tokens";

-- DropTable
DROP TABLE "auth"."refresh_tokens";

-- DropTable
DROP TABLE "auth"."saml_providers";

-- DropTable
DROP TABLE "auth"."saml_relay_states";

-- DropTable
DROP TABLE "auth"."schema_migrations";

-- DropTable
DROP TABLE "auth"."sessions";

-- DropTable
DROP TABLE "auth"."sso_domains";

-- DropTable
DROP TABLE "auth"."sso_providers";

-- DropTable
DROP TABLE "auth"."users";

-- DropEnum
DROP TYPE "auth"."aal_level";

-- DropEnum
DROP TYPE "auth"."code_challenge_method";

-- DropEnum
DROP TYPE "auth"."factor_status";

-- DropEnum
DROP TYPE "auth"."factor_type";

-- DropEnum
DROP TYPE "auth"."oauth_authorization_status";

-- DropEnum
DROP TYPE "auth"."oauth_client_type";

-- DropEnum
DROP TYPE "auth"."oauth_registration_type";

-- DropEnum
DROP TYPE "auth"."oauth_response_type";

-- DropEnum
DROP TYPE "auth"."one_time_token_type";

