import { expect, test } from "@playwright/test";
import { authHeaders } from "./auth.mjs";

const VIEWPORTS = [
  { width: 375, height: 812, label: "mobile" },
  { width: 768, height: 1024, label: "tablet" },
  { width: 1280, height: 800, label: "desktop" },
  { width: 1536, height: 960, label: "wide" },
];

async function assertNoHorizontalOverflow(page, route, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const width = Math.max(doc?.scrollWidth ?? 0, body?.scrollWidth ?? 0);
    return width - window.innerWidth;
  });
  expect(overflow, `${route} (${label}) has horizontal overflow`).toBeLessThanOrEqual(2);
}

async function gotoRoute(page, route) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.goto(route, { waitUntil: "domcontentloaded" });
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const waitMs = message.includes("ERR_CONNECTION_REFUSED") ? 2500 : 250;
      await page.waitForTimeout(waitMs);
    }
  }
  throw lastError ?? new Error(`failed to navigate route=${route}`);
}

test("@responsive public responsive guardrails across target breakpoints", async ({ browser }) => {
  const routes = ["/", "/eventos", "/descobrir"];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();

    for (const route of routes) {
      const response = await gotoRoute(page, route);
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      await expect(page.locator("body")).toBeVisible();
      await assertNoHorizontalOverflow(page, route, viewport.label);
    }

    await context.close();
  }
});

test("@responsive org shell responsive guardrails across target breakpoints", async ({ browser }) => {
  const userBearer = process.env.UI_E2E_USER_BEARER_RESOLVED;
  if (!userBearer) {
    test.skip(true, "missing resolved user bearer");
  }
  const orgId = process.env.UI_E2E_ORG_ID_RESOLVED || null;

  const routes = ["/me/reservas"];
  if (orgId) {
    routes.push(
      `/org/${orgId}/overview`,
      `/org/${orgId}/bookings`,
      `/org/${orgId}/calendar`,
      `/org/${orgId}/calendar/day`,
    );
  }

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      extraHTTPHeaders: authHeaders(userBearer),
    });
    const page = await context.newPage();

    for (const route of routes) {
      const response = await gotoRoute(page, route);
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      await expect(page.locator("body")).toBeVisible();
      await expect(page).not.toHaveURL(/\/login(\?|$)/);
      await assertNoHorizontalOverflow(page, route, viewport.label);
    }

    await context.close();
  }
});
