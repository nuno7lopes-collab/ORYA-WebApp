import { expect, test } from "@playwright/test";
import { authHeaders } from "./auth.mjs";

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

async function findVisibleAulasAcademyLink(page, orgId) {
  const links = page.locator("a", { hasText: /^Aulas$/ });
  const count = await links.count();
  const hrefs = [];

  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    if (!(await link.isVisible())) continue;
    const href = (await link.getAttribute("href")) ?? "";
    hrefs.push(href);
    if (href.includes(`/org/${orgId}/academy/classes`)) {
      return { link, hrefs };
    }
  }

  throw new Error(`AULAS_ACADEMY_LINK_NOT_FOUND visibleHrefs=${JSON.stringify(hrefs)}`);
}

async function assertNoAulasToAvailability(page) {
  const badLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a"))
      .map((anchor) => ({
        text: (anchor.textContent ?? "").trim(),
        href: anchor.getAttribute("href") ?? "",
      }))
      .filter((item) => item.text === "Aulas" && item.href.includes("/calendar/availability"));
  });
  expect(badLinks).toEqual([]);
}

function pickOrgIdFromListPayload(payload) {
  const data = payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
    ? payload.data
    : payload;
  const items = Array.isArray(data?.items) ? data.items : [];
  const preferredUsername = process.env.UI_E2E_SEED_ORG_USERNAME || "top_padel";
  const preferred = items.find((item) => item?.organization?.username === preferredUsername);
  const fallback = items[0];
  const candidate = preferred?.organizationId ?? fallback?.organizationId ?? null;
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0) return null;
  return String(candidate);
}

function buildCreateOrgPayload() {
  const suffix = Date.now().toString(36);
  return {
    businessName: `E2E Clube ${suffix}`,
    username: `e2e${suffix}`.slice(0, 15),
    tools: ["RESERVAS"],
    groupMode: "NEW_GROUP",
  };
}

async function resolveOrCreateOrgId(baseURL, userBearer) {
  const normalizedBaseURL = (baseURL || "").replace(/\/+$/, "");
  if (!normalizedBaseURL) return null;

  const listResponse = await fetch(`${normalizedBaseURL}/api/org-hub/organizations`, {
    headers: {
      ...authHeaders(userBearer),
      Accept: "application/json",
    },
  });
  const listJson = await listResponse.json().catch(() => null);
  if (listResponse.ok) {
    const existingOrgId = pickOrgIdFromListPayload(listJson);
    if (existingOrgId) return existingOrgId;
  }

  const createPayload = buildCreateOrgPayload();
  const createResponse = await fetch(`${normalizedBaseURL}/api/org-hub/organizations`, {
    method: "POST",
    headers: {
      ...authHeaders(userBearer),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(createPayload),
  });
  const createJson = await createResponse.json().catch(() => null);
  if (!createResponse.ok) return null;

  const createdOrgId =
    createJson?.data?.organization?.id ??
    createJson?.organization?.id ??
    null;
  if (typeof createdOrgId === "number" && Number.isFinite(createdOrgId) && createdOrgId > 0) {
    return String(createdOrgId);
  }

  const retryListResponse = await fetch(`${normalizedBaseURL}/api/org-hub/organizations`, {
    headers: {
      ...authHeaders(userBearer),
      Accept: "application/json",
    },
  });
  const retryListJson = await retryListResponse.json().catch(() => null);
  if (!retryListResponse.ok) return null;
  return pickOrgIdFromListPayload(retryListJson);
}

test("@web academy aulas navigation keeps canonical classes destination", async ({ browser, baseURL }) => {
  const userBearer = process.env.UI_E2E_USER_BEARER_RESOLVED;
  let orgId = process.env.UI_E2E_ORG_ID_RESOLVED || null;

  if (!userBearer) {
    test.info().annotations.push({
      type: "env-missing",
      description: "missing resolved user bearer",
    });
    return;
  }

  if (!orgId) {
    orgId = await resolveOrCreateOrgId(baseURL, userBearer);
  }

  if (!orgId) {
    test.info().annotations.push({
      type: "env-missing",
      description: "orgId unavailable and org creation failed",
    });
    return;
  }

  const context = await browser.newContext({
    extraHTTPHeaders: authHeaders(userBearer),
  });
  const page = await context.newPage();

  try {
    await test.step("academy trainers: Aulas stays in academy/classes", async () => {
      const response = await gotoRoute(page, `/org/${orgId}/academy/trainers`);
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      await expect(page).not.toHaveURL(/\/login(\?|$)/);
      await assertNoAulasToAvailability(page);

      const { link } = await findVisibleAulasAcademyLink(page, orgId);
      await link.click();

      await expect(page).toHaveURL(new RegExp(`/org/${orgId}/academy/classes(?:\\?|$)`));
      await expect(page).not.toHaveURL(new RegExp(`/org/${orgId}/calendar/availability(?:\\?|$)`));
    });

    await test.step("manage overview (optional): if Aulas is visible, destination is academy/classes", async () => {
      const response = await gotoRoute(page, `/org/${orgId}/overview?tab=manage&section=reservas`);
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      await expect(page).not.toHaveURL(/\/login(\?|$)/);
      await assertNoAulasToAvailability(page);

      const links = page.locator("a", { hasText: /^Aulas$/ });
      const count = await links.count();
      let clicked = false;
      for (let index = 0; index < count; index += 1) {
        const link = links.nth(index);
        if (!(await link.isVisible())) continue;
        const href = (await link.getAttribute("href")) ?? "";
        if (!href.includes(`/org/${orgId}/academy/classes`)) continue;
        await link.click();
        clicked = true;
        break;
      }

      if (!clicked) {
        test.info().annotations.push({
          type: "optional-step-skip",
          description: "manage overview sem link Aulas visível para clique direto",
        });
        return;
      }

      await expect(page).toHaveURL(new RegExp(`/org/${orgId}/academy/classes(?:\\?|$)`));
      await expect(page).not.toHaveURL(new RegExp(`/org/${orgId}/calendar/availability(?:\\?|$)`));
    });
  } finally {
    await context.close();
  }
});
