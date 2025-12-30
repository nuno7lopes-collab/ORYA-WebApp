import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = data.user;
  const verified = Boolean((user as any)?.email_confirmed_at || (user as any)?.emailConfirmedAt);
  if (!verified) {
    return NextResponse.json({ error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { purchaseId?: string } | null;
  const purchaseIdFromBody = typeof body?.purchaseId === "string" ? body.purchaseId.trim() : null;
  const normEmail = normalizeEmail(user.email ?? "");
  const emailNormalized = normEmail || user.email?.toLowerCase() || null;

  if (!emailNormalized) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "NO_EMAIL" });
  }

  // Garantir identidade de email para ligar claims a ownerIdentityId
  const identity = await prisma.emailIdentity.upsert({
    where: { emailNormalized },
    update: { userId: user.id, emailVerifiedAt: new Date() },
    create: { emailNormalized, userId: user.id, emailVerifiedAt: new Date() },
  });

  // Se tiver purchaseId explícito, enfileiramos só esse
  if (purchaseIdFromBody) {
    const dedupeKey = `CLAIM_GUEST_PURCHASE:${purchaseIdFromBody}:${user.id}`;
    await enqueueOperation({
      operationType: "CLAIM_GUEST_PURCHASE",
      purchaseId: purchaseIdFromBody,
      dedupeKey,
      payload: {
        purchaseId: purchaseIdFromBody,
        userId: user.id,
        userEmail: user.email,
      },
    });
    return NextResponse.json({ ok: true, enqueued: true, purchaseId: purchaseIdFromBody });
  }

  // Caso geral: encontrar purchases guest por ownerIdentityId do email ou ownerKey=email:<email>
  const purchases = await prisma.entitlement.findMany({
    where: {
      ownerUserId: null,
      OR: [
        { ownerIdentityId: identity.id },
        { ownerKey: `email:${emailNormalized}` },
      ],
    },
    select: { purchaseId: true },
    distinct: ["purchaseId"],
  });

  if (!purchases.length) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "NO_GUEST_ENTITLEMENTS" });
  }

  await Promise.all(
    purchases
      .map((p) => p.purchaseId)
      .filter((p): p is string => !!p)
      .map((pid) =>
        enqueueOperation({
          operationType: "CLAIM_GUEST_PURCHASE",
          purchaseId: pid,
          dedupeKey: `CLAIM_GUEST_PURCHASE:${pid}:${user.id}`,
          payload: {
            purchaseId: pid,
            userId: user.id,
            userEmail: user.email,
          },
        }),
      ),
  );

  return NextResponse.json({ ok: true, enqueued: true, purchases: purchases.map((p) => p.purchaseId) });
}
