import { assertAdminBearer, assertPublicBaseline, resolveBearer, resolveOrgId } from "./auth.mjs";

async function ensureAuthBootstrap(baseURL, bearer, label) {
  const endpoint = `${baseURL.replace(/\/+$/, "")}/api/auth/bootstrap`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const body = await response.text();
      console.warn(
        `[playwright][global-setup] ${label} bootstrap failed status=${response.status} body=${body.slice(0, 220)}`,
      );
    }
  } catch (error) {
    console.warn(
      `[playwright][global-setup] ${label} bootstrap request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL || process.env.UI_E2E_BASE_URL || "http://127.0.0.1:33123";

  await assertPublicBaseline(baseURL);

  let userBearer = "";
  try {
    userBearer = await resolveBearer("user");
    if (userBearer) {
      await ensureAuthBootstrap(baseURL, userBearer, "user");
    }
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
