import type { Prisma, PrismaClient } from "@prisma/client";

type OperationalTx = Pick<PrismaClient, "organizationSettings"> | Prisma.TransactionClient;

export const RESERVAS_OPERATIONAL_OFF_ERROR_CODE = "RESERVAS_OPERATIONAL_OFF" as const;

export type ReservasOperationalState = {
  acceptNewBookings: boolean;
};

export type ReservasOperationalGateResult =
  | { ok: true; state: ReservasOperationalState }
  | {
      ok: false;
      errorCode: typeof RESERVAS_OPERATIONAL_OFF_ERROR_CODE;
      message: string;
      state: ReservasOperationalState;
    };

function normalizeAcceptNewBookings(value: unknown) {
  return typeof value === "boolean" ? value : true;
}

export async function getOrganizationReservasOperationalState(params: {
  organizationId: number;
  tx?: OperationalTx;
}): Promise<ReservasOperationalState> {
  const tx = params.tx;
  if (!tx) {
    return { acceptNewBookings: true };
  }

  const settings = await tx.organizationSettings.findUnique({
    where: { organizationId: params.organizationId },
    select: { bookingAcceptNewReservations: true },
  });

  return {
    acceptNewBookings: normalizeAcceptNewBookings(settings?.bookingAcceptNewReservations),
  };
}

export async function ensureReservasOperationalOpen(params: {
  organizationId: number;
  tx?: OperationalTx;
  message?: string;
}): Promise<ReservasOperationalGateResult> {
  const state = await getOrganizationReservasOperationalState({
    organizationId: params.organizationId,
    tx: params.tx,
  });

  if (state.acceptNewBookings) {
    return { ok: true, state };
  }

  return {
    ok: false,
    errorCode: RESERVAS_OPERATIONAL_OFF_ERROR_CODE,
    message: params.message ?? "Novas reservas estão temporariamente indisponíveis.",
    state,
  };
}
