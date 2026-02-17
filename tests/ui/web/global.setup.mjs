import { assertAdminBearer, assertPublicBaseline, resolveBearer, resolveOrgId } from "./auth.mjs";

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL || process.env.UI_E2E_BASE_URL || "http://127.0.0.1:33123";

  await assertPublicBaseline(baseURL);

  let userBearer = "";
  try {
    userBearer = await resolveBearer("user");
  } catch (error) {
    console.warn(`[playwright][global-setup] user bearer unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.env.UI_E2E_USER_BEARER_RESOLVED = userBearer;

  const orgId = userBearer ? await resolveOrgId(baseURL, userBearer) : null;
  process.env.UI_E2E_ORG_ID_RESOLVED = orgId ? String(orgId) : "";

  let adminBearer = "";
  try {
    adminBearer = await resolveBearer("admin");
    await assertAdminBearer(baseURL, adminBearer);
  } catch (error) {
    adminBearer = "";
    console.warn(`[playwright][global-setup] admin bearer unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.env.UI_E2E_ADMIN_BEARER_RESOLVED = adminBearer;

  console.log(
    `[playwright][global-setup] baseURL=${baseURL} user=${Boolean(userBearer)} orgId=${process.env.UI_E2E_ORG_ID_RESOLVED || "none"} admin=${Boolean(adminBearer)}`,
  );
}
