import { expect, test } from "@playwright/test";

const INSTALL_APP_URL = "https://testflight.apple.com/join/rw661rQX";
const INSTALL_APP_LABEL = /^Instalar app ORYA$/i;
const INSTALL_APP_HINT = /Para já via TestFlight \(iOS\)/i;

async function gotoRoute(page, route) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  if (response) {
    expect(response.status(), `${route} status`).toBeLessThan(500);
  }
}

async function assertInstallLinksPointToTestFlight(page, scopeLabel) {
  const links = page.getByRole("link", { name: INSTALL_APP_LABEL });
  const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));

  expect(hrefs.length, `${scopeLabel} install CTA count`).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, `${scopeLabel} install CTA href`).toBe(INSTALL_APP_URL);
  }
}

async function dismissAuthModalIfPresent(page) {
  const authDialog = page.getByRole("dialog", { name: /Entrar na ORYA/i });
  if (await authDialog.isVisible().catch(() => false)) {
    const closeButton = authDialog.getByRole("button", { name: /Fechar/i });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(200);
    }
  }
}

async function tryReachPublicHome(page) {
  await dismissAuthModalIfPresent(page);
  const installLinks = page.getByRole("link", { name: INSTALL_APP_LABEL });
  return (await installLinks.count()) > 0;
}

test("@web install app CTA uniformizado aponta para TestFlight", async ({ page }) => {
  await gotoRoute(page, "/");
  const homeAvailable = await tryReachPublicHome(page);

  if (homeAvailable) {
    const homeInstallLinks = page.getByRole("link", { name: INSTALL_APP_LABEL });
    const homeCount = await homeInstallLinks.count();
    expect(homeCount, "home install CTA count").toBe(1);
    await assertInstallLinksPointToTestFlight(page, "home");
    await expect(page.getByText(INSTALL_APP_HINT).first()).toBeVisible();
  } else {
    test.info().annotations.push({
      type: "home-unavailable",
      description: "home publica indisponivel neste ambiente; CTA validado no evento",
    });
  }

  await gotoRoute(page, "/eventos");
  const eventHref = await page.locator('a[href^="/eventos/"]').first().getAttribute("href");
  if (!eventHref || eventHref === "/eventos") {
    test.info().annotations.push({ type: "data-missing", description: "sem evento publico para validar CTA de app" });
    return;
  }

  await gotoRoute(page, eventHref);
  await assertInstallLinksPointToTestFlight(page, `event:${eventHref}`);
  await expect(page.getByText(INSTALL_APP_HINT)).toBeVisible();
});
