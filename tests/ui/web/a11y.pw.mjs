import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { authHeaders } from "./auth.mjs";

const axeSource = fs.readFileSync(new URL("../../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");

async function runAxe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const axe = window.axe;
    return axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
    });
  });
}

function summarizeCritical(violations) {
  return violations
    .filter((violation) => violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
}

async function gotoRoute(page, route) {
  let lastError = null;
  let lastResponse = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      lastResponse = response;
      if (!response || response.status() < 500) {
        return response;
      }
      if (attempt === 1) return response;
      await page.waitForTimeout(500);
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
      await page.waitForTimeout(500);
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError ?? new Error(`failed to navigate route=${route}`);
}

test("@a11y public critical routes have no critical axe violations", async ({ page }) => {
  const routes = ["/eventos", "/descobrir"];

  for (const route of routes) {
    const response = await gotoRoute(page, route);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    await expect(page.locator("body")).toBeVisible();

    const results = await runAxe(page);
    const critical = summarizeCritical(results.violations);
    expect(critical, `critical axe violations on ${route}`).toEqual([]);
  }
});

test("@a11y authenticated user/org/admin routes have no critical axe violations", async ({ browser }) => {
  const userBearer = process.env.UI_E2E_USER_BEARER_RESOLVED;
  const adminBearer = process.env.UI_E2E_ADMIN_BEARER_RESOLVED;
  if (!userBearer) {
    test.info().annotations.push({ type: "env-missing", description: "missing resolved user bearer" });
    return;
  }
  const orgId = process.env.UI_E2E_ORG_ID_RESOLVED || null;

  const userContext = await browser.newContext({
    extraHTTPHeaders: authHeaders(userBearer),
  });
  const userPage = await userContext.newPage();

  const userRoutes = ["/me/settings", "/me/reservas"];
  if (orgId) {
    userRoutes.push(
      `/org/${orgId}/overview`,
      `/org/${orgId}/bookings`,
      `/org/${orgId}/calendar`,
      `/org/${orgId}/calendar/day`,
    );
  }
  for (const route of userRoutes) {
    const response = await gotoRoute(userPage, route);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    await expect(userPage.locator("body")).toBeVisible();
    const results = await runAxe(userPage);
    const critical = summarizeCritical(results.violations);
    expect(critical, `critical axe violations on ${route}`).toEqual([]);
  }

  await userContext.close();

  if (adminBearer) {
    const adminContext = await browser.newContext({
      extraHTTPHeaders: authHeaders(adminBearer),
    });
    const adminPage = await adminContext.newPage();

    for (const route of ["/admin/organizacoes", "/admin/tickets"]) {
      const adminResponse = await gotoRoute(adminPage, route);
      if (adminResponse) {
        expect(adminResponse.status()).toBeLessThan(500);
      }
      await expect(adminPage.locator("body")).toBeVisible();
      await expect(adminPage).not.toHaveURL(/\/login(\?|$)/);
      await expect(adminPage).not.toHaveURL(/\/admin\/forbidden(\?|$)/);

      const adminResults = await runAxe(adminPage);
      const adminCritical = summarizeCritical(adminResults.violations);
      expect(adminCritical, `critical axe violations on ${route}`).toEqual([]);
    }

    await adminContext.close();
  }
});
