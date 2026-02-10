import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  readAdminHost,
  readMfaSessionCookie,
  shouldRequireAdminMfa,
  verifyMfaSession,
} from "@/lib/admin/mfaSession";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import MfaChallengeClient from "./MfaChallengeClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminMfaPageProps = {
  searchParams?: {
    redirectTo?: string;
  };
};

export default async function AdminMfaPage({ searchParams }: AdminMfaPageProps) {
  const admin = await requireAdminUser({ skipMfa: true });
  if (!admin.ok) {
    if (admin.error === "FORBIDDEN") {
      redirect("/admin/forbidden");
    }
    redirect("/login?redirectTo=/admin/mfa");
  }

  const params = searchParams ?? {};
  const redirectTo = sanitizeRedirectPath(params.redirectTo, "/admin");
  const host = await readAdminHost();
  const required = shouldRequireAdminMfa(host);
  if (!required) {
    redirect(redirectTo);
  }

  const token = await readMfaSessionCookie();
  const session = verifyMfaSession(token, admin.userId);
  if (session.ok) {
    redirect(redirectTo);
  }

  return <MfaChallengeClient redirectTo={redirectTo} adminEmail={admin.userEmail ?? ""} />;
}
