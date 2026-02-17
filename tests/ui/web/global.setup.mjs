import { assertAdminBearer, assertTopPadelSeed, resolveBearer, resolveOrgId } from "./auth.mjs";

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL || process.env.UI_E2E_BASE_URL || "http://127.0.0.1:33123";

  await assertTopPadelSeed(baseURL);

  const userBearer = await resolveBearer("user");
  process.env.UI_E2E_USER_BEARER_RESOLVED = userBearer;

  const orgId = await resolveOrgId(baseURL, userBearer);
  process.env.UI_E2E_ORG_ID_RESOLVED = String(orgId);

  const adminBearer = await resolveBearer("admin");
  await assertAdminBearer(baseURL, adminBearer);
  process.env.UI_E2E_ADMIN_BEARER_RESOLVED = adminBearer;

  console.log(`[playwright][global-setup] baseURL=${baseURL} orgId=${process.env.UI_E2E_ORG_ID_RESOLVED}`);
}
