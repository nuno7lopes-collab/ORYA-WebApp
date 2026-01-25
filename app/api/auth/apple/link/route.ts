import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { linkAppleIdentity } from "@/domain/apple/linkIdentity";
import { verifyAppleIdToken } from "@/lib/apple/signin";
import { prisma } from "@/lib/prisma";

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

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
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
      return NextResponse.json({ ok: false, error: "APPLE_IDENTITY_MISSING" }, { status: 400 });
    }
    providerUserId = appleIdentity.providerUserId;
    email = appleIdentity.email;
  }

  if (!providerUserId) {
    return NextResponse.json({ ok: false, error: "APPLE_IDENTITY_INVALID" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: data.user.id },
    select: { activeOrganizationId: true },
  });
  const orgId = profile?.activeOrganizationId ?? null;

  try {
    const identity = await linkAppleIdentity({
      userId: data.user.id,
      providerUserId,
      email,
      organizationId: orgId,
      correlationId: `apple:${providerUserId}`,
    });
    return NextResponse.json({ ok: true, identityId: identity.id });
  } catch (err) {
    if (err instanceof Error && err.message === "APPLE_IDENTITY_ALREADY_LINKED") {
      return NextResponse.json({ ok: false, error: "ALREADY_LINKED" }, { status: 409 });
    }
    console.error("[auth/apple/link] error:", err);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
