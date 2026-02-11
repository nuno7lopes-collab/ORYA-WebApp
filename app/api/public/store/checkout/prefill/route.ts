import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreAddressType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

type PrefillResponse = {
  ok: boolean;
  customer?: { name: string | null; email: string | null; phone: string | null };
  shippingAddress?: {
    addressId: string;
    fullName: string;
    formattedAddress: string | null;
    nif: string | null;
  } | null;
  billingAddress?: {
    addressId: string;
    fullName: string;
    formattedAddress: string | null;
    nif: string | null;
  } | null;
  error?: string;
};

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return fail(400, storeParsed.error);
    }

    const store = await prisma.store.findFirst({
      where: { id: storeParsed.storeId },
      select: { id: true },
    });
    if (!store) {
      return fail(404, "Store nao encontrada.");
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const [profile, lastOrder] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: user.id },
        select: { fullName: true, contactPhone: true },
      }),
      prisma.storeOrder.findFirst({
        where: { storeId: store.id, userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          addresses: {
            select: {
              addressType: true,
              addressId: true,
              fullName: true,
              nif: true,
              addressRef: { select: { formattedAddress: true } },
            },
          },
        },
      }),
    ]);

    const shippingAddress =
      lastOrder?.addresses.find((address) => address.addressType === StoreAddressType.SHIPPING) ?? null;
    const billingAddress =
      lastOrder?.addresses.find((address) => address.addressType === StoreAddressType.BILLING) ?? null;
    const serializeAddress = (address: typeof shippingAddress) =>
      address
        ? {
            addressId: address.addressId,
            fullName: address.fullName,
            formattedAddress: address.addressRef?.formattedAddress ?? null,
            nif: address.nif ?? null,
          }
        : null;

    const metadata = user.user_metadata as { full_name?: string; name?: string } | null;
    const customer = {
      name: profile?.fullName ?? lastOrder?.customerName ?? metadata?.full_name ?? metadata?.name ?? null,
      email: user.email ?? lastOrder?.customerEmail ?? null,
      phone: profile?.contactPhone ?? lastOrder?.customerPhone ?? null,
    };

    return respondOk(ctx, {
      customer,
      shippingAddress: serializeAddress(shippingAddress),
      billingAddress: serializeAddress(billingAddress),
    });
  } catch (err) {
    console.error("GET /api/public/store/checkout/prefill error:", err);
    return fail(500, "Erro ao carregar prefill.");
  }
}
export const GET = withApiEnvelope(_GET);
