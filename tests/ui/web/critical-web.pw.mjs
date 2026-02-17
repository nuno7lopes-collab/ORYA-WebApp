import { expect, test } from "@playwright/test";
import { authHeaders } from "./auth.mjs";

function blockingErrorRegex() {
  return /(Application error|Unhandled Runtime Error|LEGACY_ROUTE_REMOVED|500\s*\)|Internal Server Error)/i;
}

async function assertNoBlockingErrors(page) {
  await expect(page.locator("body")).not.toContainText(blockingErrorRegex());
}

async function gotoCriticalRoute(page, route) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.goto(route, { waitUntil: "domcontentloaded" });
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
      await page.waitForTimeout(250);
    }
  }
  throw lastError ?? new Error(`failed to navigate route=${route}`);
}

test("@web public critical pages render without blocking errors", async ({ page, baseURL }) => {
  const seedUsername = process.env.UI_E2E_SEED_ORG_USERNAME || "top_padel";
  const targets = ["/", "/eventos", "/descobrir", `/${seedUsername}`];

  for (const route of targets) {
    const response = await gotoCriticalRoute(page, route);
    if (response) {
      expect(response.status(), `${route} status`).toBeLessThan(500);
    }
    await expect(page.locator("body")).toBeVisible();
    await assertNoBlockingErrors(page);
  }

  expect(baseURL).toBeTruthy();
});

test("@web authenticated user+org surfaces render", async ({ browser }) => {
  test.setTimeout(720_000);

  const userBearer = process.env.UI_E2E_USER_BEARER_RESOLVED;
  const orgId = process.env.UI_E2E_ORG_ID_RESOLVED;

  expect(userBearer, "missing resolved user bearer").toBeTruthy();
  expect(orgId, "missing resolved orgId").toBeTruthy();

  const context = await browser.newContext({
    extraHTTPHeaders: authHeaders(userBearer),
  });
  const page = await context.newPage();

  const targets = [
    "/me/reservas",
    "/me/compras/loja",
    "/me/settings",
    `/org/${orgId}/overview`,
    `/org/${orgId}/analytics`,
    `/org/${orgId}/bookings`,
    `/org/${orgId}/calendar`,
    `/org/${orgId}/finance`,
    `/org/${orgId}/policies`,
    `/org/${orgId}/chat`,
    `/org/${orgId}/padel/tournaments`,
    `/org/${orgId}/forms`,
    `/org/${orgId}/team`,
    `/org/${orgId}/settings`,
  ];

  for (const route of targets) {
    await test.step(`route:${route}`, async () => {
      const response = await gotoCriticalRoute(page, route);
      if (response) {
        expect(response.status(), `${route} status`).toBeLessThan(500);
      }
      await expect(page.locator("body")).toBeVisible();
      await expect(page).not.toHaveURL(/\/login(\?|$)/);
      await assertNoBlockingErrors(page);
    });
  }

  await context.close();
});

test("@web admin protected surfaces render with authenticated context", async ({ browser }) => {
  const adminBearer = process.env.UI_E2E_ADMIN_BEARER_RESOLVED;
  expect(adminBearer, "missing resolved admin bearer").toBeTruthy();

  const context = await browser.newContext({
    extraHTTPHeaders: authHeaders(adminBearer),
  });
  const page = await context.newPage();

  const targets = [
    "/admin/organizacoes",
    "/admin/payments",
    "/admin/refunds",
    "/admin/finance",
    "/admin/audit",
    "/admin/infra",
    "/admin/settings",
    "/admin/tickets",
    "/admin/suporte",
  ];

  for (const route of targets) {
    await test.step(`route:${route}`, async () => {
      const response = await gotoCriticalRoute(page, route);
      if (response) {
        expect(response.status(), `${route} status`).toBeLessThan(500);
      }
      await expect(page.locator("body")).toBeVisible();
      await expect(page).not.toHaveURL(/\/login(\?|$)/);
      await expect(page).not.toHaveURL(/\/admin\/forbidden(\?|$)/);
      await assertNoBlockingErrors(page);
    });
  }

  await context.close();
});
