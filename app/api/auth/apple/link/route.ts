import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { linkAppleIdentity } from "@/domain/apple/linkIdentity";
import { verifyAppleIdToken } from "@/lib/apple/signin";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationIdForUser } from "@/lib/organizationContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type AppleLinkBody = { idToken?: string | null };

function extractAppleIdentityFromSupabaseUser(user: { identities?: Array<any> }) {
  const identity = user?.identities?.find((item: any) => item?.provider === "apple");
  if (!identity) return null;
  const data = identity.identity_data ?? {};
  const providerUserId =
    typeof data.sub === "string"
      ? data.sub
      : typeof identity.id === "string"
        ? identity.id
        : null;
  const email = typeof data.email === "string" ? data.email : null;
  return providerUserId ? { providerUserId, email } : null;
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return jsonWrap(
      { ok: false, errorCode: "UNAUTHENTICATED", message: "Sessao invalida." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as AppleLinkBody | null;
  const idToken = body?.idToken ?? null;

  let providerUserId: string | null = null;
  let email: string | null = null;

  if (idToken) {
    const verified = await verifyAppleIdToken(idToken);
    providerUserId = verified.sub;
    email = verified.email;
  } else {
    const adminUser = await supabaseAdmin.auth.admin.getUserById(data.user.id);
    const appleIdentity = adminUser?.data?.user
      ? extractAppleIdentityFromSupabaseUser(adminUser.data.user)
      : null;
    if (!appleIdentity) {
      return jsonWrap(
        {
          ok: false,
          errorCode: "APPLE_IDENTITY_MISSING",
          message: "Identidade Apple nao encontrada.",
        },
        { status: 400 }
      );
    }
    providerUserId = appleIdentity.providerUserId;
    email = appleIdentity.email;
  }

  if (!providerUserId) {
    return jsonWrap(
      {
        ok: false,
        errorCode: "APPLE_IDENTITY_INVALID",
        message: "Identidade Apple invalida.",
      },
      { status: 400 }
    );
  }

  const orgId = await getActiveOrganizationIdForUser(data.user.id);

  try {
    const identity = await linkAppleIdentity({
      userId: data.user.id,
      providerUserId,
      email,
      organizationId: orgId,
      correlationId: `apple:${providerUserId}`,
    });
    return jsonWrap({ ok: true, identityId: identity.id });
  } catch (err) {
    if (err instanceof Error && err.message === "APPLE_IDENTITY_ALREADY_LINKED") {
      return jsonWrap(
        {
          ok: false,
          errorCode: "ALREADY_LINKED",
          message: "Identidade Apple ja associada a outra conta.",
        },
        { status: 409 }
      );
    }
    console.error("[auth/apple/link] error:", err);
    return jsonWrap(
      { ok: false, errorCode: "SERVER_ERROR", message: "Erro inesperado no servidor." },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
