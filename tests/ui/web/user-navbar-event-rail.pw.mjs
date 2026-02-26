import { expect, test } from "@playwright/test";

async function gotoRoute(page, route) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  if (response) {
    expect(response.status(), `${route} status`).toBeLessThan(500);
  }
}

async function assertStraightNavbar(page, route) {
  const navbar = page.locator('[data-testid="user-navbar-shell"]');
  await expect(navbar, `${route} navbar`).toBeVisible();

  const radius = await navbar.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      left: Number.parseFloat(style.borderBottomLeftRadius || "0"),
      right: Number.parseFloat(style.borderBottomRightRadius || "0"),
    };
  });

  expect(radius.left, `${route} border bottom left radius`).toBeLessThanOrEqual(1);
  expect(radius.right, `${route} border bottom right radius`).toBeLessThanOrEqual(1);
}

async function assertHideShowOnScroll(page, route) {
  const canScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight > 220,
  );
  if (!canScroll) return;

  const navbar = page.locator('[data-testid="user-navbar-shell"]');
  await page.evaluate(() => window.scrollTo({ top: 460, behavior: "auto" }));
  await page.waitForTimeout(220);
  await expect(navbar, `${route} hidden on down-scroll`).toHaveAttribute("data-nav-phase", "hidden");

  await page.evaluate(() => window.scrollTo({ top: 120, behavior: "auto" }));
  await page.waitForTimeout(220);
  await expect(navbar, `${route} visible on up-scroll`).toHaveAttribute(
    "data-nav-phase",
    /top|scrolled-visible/,
  );
}

test("@web user navbar global behavior e rail de compra no evento", async ({ page }) => {
  for (const route of ["/", "/descobrir", "/eventos"]) {
    await test.step(`route:${route}`, async () => {
      await gotoRoute(page, route);
      await assertStraightNavbar(page, route);
      await assertHideShowOnScroll(page, route);
    });
  }

  await gotoRoute(page, "/eventos");
  const eventHref = await page.locator('a[href^="/eventos/"]').first().getAttribute("href");
  if (!eventHref || eventHref === "/eventos") {
    test.info().annotations.push({ type: "data-missing", description: "sem evento publico para validar rail" });
    return;
  }

  await gotoRoute(page, eventHref);
  await assertStraightNavbar(page, eventHref);

  const rail = page.locator('[data-testid="event-purchase-rail"]');
  await expect(rail).toBeVisible();
  await expect(page.getByRole("button", { name: "Partilhar evento" })).toBeVisible();

  const actionable = page.locator(
    '[data-testid="event-purchase-rail"] button:not([disabled]), [data-testid="event-purchase-rail"] a',
  );
  if ((await actionable.count()) > 0) {
    await expect(actionable.first()).toBeVisible();
  }

  await expect(page.locator("#local")).toBeVisible();
  const installAppLink = page.getByRole("link", { name: /Instalar app ORYA/i });
  await expect(installAppLink).toBeVisible();
  await expect(installAppLink).toHaveAttribute("href", "https://testflight.apple.com/join/rw661rQX");
});
