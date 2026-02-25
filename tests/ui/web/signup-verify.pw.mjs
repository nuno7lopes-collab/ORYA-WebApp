import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function pickNonEmpty(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function buildSupabaseAdminClient() {
  const supabaseUrl = pickNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = pickNonEmpty(process.env.SUPABASE_SERVICE_ROLE);
  if (!supabaseUrl || !serviceRole) return null;

  return createClient(supabaseUrl, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findUserByEmail(adminClient, email) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`LIST_USERS_FAILED: ${error.message}`);
    const users = data?.users ?? [];
    const matched = users.find((user) => (user.email ?? "").trim().toLowerCase() === normalized);
    if (matched) return matched;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function deleteUserIfExists(adminClient, email) {
  const existing = await findUserByEmail(adminClient, email);
  if (!existing?.id) return;
  const { error } = await adminClient.auth.admin.deleteUser(existing.id);
  if (error) throw new Error(`DELETE_USER_FAILED: ${error.message}`);
}

async function generateSignupOtp(adminClient, { email, password, redirectTo }) {
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo },
  });
  if (error) throw new Error(`GENERATE_SIGNUP_OTP_FAILED: ${error.message}`);

  const otp = data?.properties?.email_otp ?? null;
  if (!otp) throw new Error("SIGNUP_OTP_MISSING");
  return otp;
}

test("@web signup + confirmação por código funciona sem worker/redis", async ({ page, baseURL }) => {
  const adminClient = buildSupabaseAdminClient();
  if (!adminClient) {
    test.info().annotations.push({
      type: "env-missing",
      description: "missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE",
    });
    return;
  }

  const base = (baseURL || "http://127.0.0.1:33123").replace(/\/+$/, "");
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `e2e.signup.${unique}@orya.pt`.toLowerCase();
  const password = "OryaSignup123!";

  await deleteUserIfExists(adminClient, email);

  try {
    await page.goto(`/signup?redirectTo=${encodeURIComponent("/me")}`, { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Criar conta na ORYA")).toBeVisible();

    await dialog.locator('input[autocomplete="email"]').fill(email);
    const passwordInputs = dialog.locator('input[autocomplete="new-password"]');
    await expect(passwordInputs).toHaveCount(2);
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);

    const sendOtpResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/auth/send-otp") && response.request().method() === "POST";
    });

    await dialog.locator('button[type="submit"]').click();

    const sendOtpResponse = await sendOtpResponsePromise;
    expect(sendOtpResponse.status()).toBe(200);
    const sendOtpJson = await sendOtpResponse.json();
    expect(sendOtpJson?.ok).toBe(true);
    expect(sendOtpJson?.otpType).toBe("signup");

    await expect(dialog.getByText("Confirmar email")).toBeVisible();

    const otp = await generateSignupOtp(adminClient, {
      email,
      password,
      redirectTo: `${base}/auth/callback`,
    });

    await dialog.locator('input[autocomplete="email"]').fill(email);
    await dialog.locator('input[placeholder="Código de 6 dígitos"]').fill(otp);
    await dialog.locator('button[type="submit"]').click();

    await expect
      .poll(
        async () => {
          const meResponse = await page.request.get("/api/auth/me");
          if (!meResponse.ok()) return null;
          const meJson = await meResponse.json();
          if ((meJson?.user?.email ?? "").toLowerCase() !== email) return null;
          return {
            emailConfirmed: Boolean(meJson?.user?.emailConfirmed),
            needsEmailConfirmation: Boolean(meJson?.needsEmailConfirmation),
          };
        },
        { timeout: 60_000, intervals: [500, 1_000, 2_000] },
      )
      .toEqual({
        emailConfirmed: true,
        needsEmailConfirmation: false,
      });
  } finally {
    await deleteUserIfExists(adminClient, email);
  }
});
