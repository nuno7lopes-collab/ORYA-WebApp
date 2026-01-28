import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser, ORG_ACTIVE_ACCESS_OPTIONS } from "@/lib/organizationContext";

async function _GET() {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const orgContext = await getActiveOrganizationForUser(user.id, ORG_ACTIVE_ACCESS_OPTIONS);
    if (!orgContext.organization || !orgContext.membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    return jsonWrap(
      { ok: false, error: "CHAT_INTERNO_EM_BETA" },
      { status: 501 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[organizacao][mensagens][history] error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
