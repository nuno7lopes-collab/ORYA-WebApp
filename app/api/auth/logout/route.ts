import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function resolveCookieDomainFromHost(rawHost?: string | null) {
  if (!rawHost) return "";
  const hostname = rawHost.split(":")[0]?.toLowerCase();
  if (!hostname) return "";
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return "";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length >= 2) return `.${parts.slice(-2).join(".")}`;
  return "";
}

async function _POST(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return jsonWrap(
        { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("[auth/logout] supabase signOut warning:", error);
    }

    const res = jsonWrap({ ok: true, warning: error ? "LOGOUT_REMOTE_FAILED" : undefined }) as NextResponse;
    const appEnv = (process.env.APP_ENV ?? "").trim().toLowerCase();
    const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
    const secureCookie =
      process.env.NODE_ENV === "production" ||
      vercelEnv === "production" ||
      vercelEnv === "preview" ||
      appEnv === "prod" ||
      appEnv === "production" ||
      appEnv === "stage" ||
      appEnv === "staging" ||
      (req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() ?? "") === "https" ||
      req.nextUrl.protocol === "https:";

    // Garantir limpeza de todos os cookies sb-*
    try {
      const store = await cookies();
      const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host");
      const cookieDomain = resolveCookieDomainFromHost(hostHeader);
      store
        .getAll()
        .filter((c) => c.name.startsWith("sb-"))
        .forEach((c) => {
          res.cookies.set({
            name: c.name,
            value: "",
            maxAge: 0,
            ...(secureCookie ? { secure: true } : {}),
            ...(cookieDomain ? { domain: cookieDomain } : {}),
          });
        });

      // limpar cookie de sessão MFA admin
      res.cookies.set({
        name: "orya_admin_mfa",
        value: "",
        path: "/",
        maxAge: 0,
        ...(secureCookie ? { secure: true } : {}),
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      });

      // logout canónico limpa também cookies de contexto UI.
      res.cookies.set({
        name: "orya_organization",
        value: "",
        path: "/",
        maxAge: 0,
        ...(secureCookie ? { secure: true } : {}),
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      });
    } catch {
      /* noop */
    }

    return res;
  } catch (err) {
    console.error("[auth/logout] unexpected error:", err);
    return jsonWrap(
      { ok: false, errorCode: "LOGOUT_FAILED", message: "Erro ao terminar sessão." },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
