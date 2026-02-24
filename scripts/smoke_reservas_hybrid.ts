import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type SmokeMode = "PROFESSIONAL_ONLY" | "RESOURCE_ONLY" | "PROFESSIONAL_AND_RESOURCE";
type PaymentsBlockedStage = "CALENDAR_MONTH" | "CALENDAR_DAY" | "RESERVAR" | "CHECKOUT";
type SmokeOutcome = "BOOKING_CONFIRMED" | "PAYMENTS_BLOCKED";
type SmokeResult = {
  mode: SmokeMode;
  serviceId: number;
  outcome: SmokeOutcome;
  blockedStage: PaymentsBlockedStage | null;
  bookingId: number | null;
  startsAt: string | null;
  checkoutStatus: number | null;
  checkoutOk: boolean;
  checkoutPaymentsNotReady: boolean;
};

const args = process.argv.slice(2);
const baseUrl =
  args.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ??
  process.env.SMOKE_BASE_URL ??
  "http://localhost:3000";
const username =
  args.find((arg) => arg.startsWith("--username="))?.split("=")[1] ??
  process.env.SMOKE_USERNAME ??
  "top_padel";
const maxDays = Number(
  args.find((arg) => arg.startsWith("--max-days="))?.split("=")[1] ??
    process.env.SMOKE_MAX_DAYS ??
    "14",
);

const databaseUrl = process.env.DATABASE_URL;
const adapter =
  databaseUrl && databaseUrl.startsWith("postgres")
    ? new PrismaPg({ connectionString: databaseUrl })
    : null;
const prisma = new PrismaClient(adapter ? { adapter } : undefined);

function isoDateOnly(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthParam(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

function isPaymentsNotReadyResult(params: { status: number; json: any }) {
  if (params.status !== 409 || params.json?.ok !== false) return false;
  return params.json?.errorCode === "PAYMENTS_NOT_READY" || params.json?.error === "PAYMENTS_NOT_READY";
}

async function findOpenSlot(serviceId: number, partySize: number | null) {
  for (let i = 0; i <= maxDays; i += 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + i);
    const day = isoDateOnly(date);
    const params = new URLSearchParams({ day });
    if (partySize != null) params.set("partySize", String(partySize));
    const { status, json } = await fetchJson(
      `${baseUrl}/api/servicos/${serviceId}/calendario?${params.toString()}`,
    );
    if (isPaymentsNotReadyResult({ status, json })) {
      return { startsAt: null, paymentsNotReady: true };
    }
    if (status !== 200 || !json?.ok) continue;
    const first = Array.isArray(json.items) ? json.items[0] : null;
    if (first?.startsAt) return { startsAt: first.startsAt as string, paymentsNotReady: false };
  }
  return { startsAt: null, paymentsNotReady: false };
}

function blockedResult(params: {
  mode: SmokeMode;
  serviceId: number;
  stage: PaymentsBlockedStage;
  startsAt?: string | null;
  bookingId?: number | null;
  checkoutStatus?: number | null;
}): SmokeResult {
  return {
    mode: params.mode,
    serviceId: params.serviceId,
    outcome: "PAYMENTS_BLOCKED",
    blockedStage: params.stage,
    bookingId: params.bookingId ?? null,
    startsAt: params.startsAt ?? null,
    checkoutStatus: params.checkoutStatus ?? null,
    checkoutOk: false,
    checkoutPaymentsNotReady: true,
  };
}

async function runMode(mode: SmokeMode, service: any) {
  const partySize =
    service.partySizeRequired || mode !== "PROFESSIONAL_ONLY"
      ? Math.max(1, service.partySizeMin ?? 1)
      : null;

  const month = monthParam(new Date());
  const monthParams = new URLSearchParams({ month });
  if (partySize != null) monthParams.set("partySize", String(partySize));
  const monthResult = await fetchJson(
    `${baseUrl}/api/servicos/${service.id}/calendario?${monthParams.toString()}`,
  );
  if (monthResult.status !== 200 || !monthResult.json?.ok) {
    if (isPaymentsNotReadyResult(monthResult)) {
      return blockedResult({
        mode,
        serviceId: service.id,
        stage: "CALENDAR_MONTH",
      });
    }
    throw new Error(`[${mode}] calendário mês falhou: ${monthResult.status}`);
  }

  const slotLookup = await findOpenSlot(service.id, partySize);
  if (slotLookup.paymentsNotReady) {
    return blockedResult({
      mode,
      serviceId: service.id,
      stage: "CALENDAR_DAY",
    });
  }
  const startsAt = slotLookup.startsAt;
  if (!startsAt) {
    throw new Error(`[${mode}] sem slot aberto nos próximos ${maxDays} dias.`);
  }

  const guest = {
    name: `Smoke ${mode}`,
    email: `smoke+${mode.toLowerCase()}@orya.local`,
    phone: "+351912345678",
    consent: true,
  };

  const reservarPayload: Record<string, unknown> = {
    startsAt,
    guest,
  };
  if (partySize != null) reservarPayload.partySize = partySize;

  const reservarResult = await fetchJson(`${baseUrl}/api/servicos/${service.id}/reservar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(reservarPayload),
  });
  if (reservarResult.status !== 200 || !reservarResult.json?.ok) {
    if (isPaymentsNotReadyResult(reservarResult)) {
      return blockedResult({
        mode,
        serviceId: service.id,
        stage: "RESERVAR",
        startsAt,
      });
    }
    throw new Error(
      `[${mode}] reservar falhou: ${reservarResult.status} ${JSON.stringify(reservarResult.json)}`,
    );
  }
  const bookingId = Number(reservarResult.json?.booking?.id);
  if (!Number.isFinite(bookingId)) {
    throw new Error(`[${mode}] reserva sem booking.id`);
  }

  const checkoutResult = await fetchJson(`${baseUrl}/api/servicos/${service.id}/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookingId, guest }),
  });
  const checkoutOk = checkoutResult.status === 200 && checkoutResult.json?.ok === true;
  const checkoutPaymentsNotReady = isPaymentsNotReadyResult(checkoutResult);
  if (!checkoutOk && !checkoutPaymentsNotReady) {
    throw new Error(
      `[${mode}] checkout falhou: ${checkoutResult.status} ${JSON.stringify(checkoutResult.json)}`,
    );
  }
  if (checkoutPaymentsNotReady) {
    return blockedResult({
      mode,
      serviceId: service.id,
      stage: "CHECKOUT",
      startsAt,
      bookingId,
      checkoutStatus: checkoutResult.status,
    });
  }

  // Simula confirmação final no DB para fechar o fluxo smoke sem depender de pagamento real.
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CONFIRMED", pendingExpiresAt: null },
  });

  const confirmed = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, professionalId: true, resourceId: true, assignmentMode: true },
  });
  if (!confirmed || confirmed.status !== "CONFIRMED") {
    throw new Error(`[${mode}] confirmação simulada falhou`);
  }
  if (mode === "PROFESSIONAL_ONLY" && !confirmed.professionalId) {
    throw new Error(`[${mode}] reserva confirmada sem profissional`);
  }
  if (mode === "RESOURCE_ONLY" && !confirmed.resourceId) {
    throw new Error(`[${mode}] reserva confirmada sem recurso`);
  }
  if (mode === "PROFESSIONAL_AND_RESOURCE" && (!confirmed.professionalId || !confirmed.resourceId)) {
    throw new Error(`[${mode}] reserva híbrida sem ambos os IDs`);
  }

  return {
    mode,
    serviceId: service.id,
    outcome: "BOOKING_CONFIRMED",
    blockedStage: null,
    bookingId,
    startsAt,
    checkoutStatus: checkoutResult.status ?? null,
    checkoutOk,
    checkoutPaymentsNotReady,
  } satisfies SmokeResult;
}

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { username, status: "ACTIVE" },
    select: { id: true, username: true },
  });
  if (!organization) {
    throw new Error(`organização '${username}' não encontrada`);
  }

  const services = await prisma.service.findMany({
    where: {
      organizationId: organization.id,
      isActive: true,
      assignmentMode: { in: ["PROFESSIONAL_ONLY", "RESOURCE_ONLY", "PROFESSIONAL_AND_RESOURCE"] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      assignmentMode: true,
      partySizeRequired: true,
      partySizeMin: true,
      partySizeMax: true,
    },
  });

  const byMode = new Map<SmokeMode, any>();
  services.forEach((service) => {
    if (!byMode.has(service.assignmentMode as SmokeMode)) {
      byMode.set(service.assignmentMode as SmokeMode, service);
    }
  });

  const requiredModes: SmokeMode[] = [
    "PROFESSIONAL_ONLY",
    "RESOURCE_ONLY",
    "PROFESSIONAL_AND_RESOURCE",
  ];
  for (const mode of requiredModes) {
    if (!byMode.has(mode)) {
      throw new Error(`serviço demo em falta para modo ${mode}`);
    }
  }

  const results: Array<Awaited<ReturnType<typeof runMode>>> = [];
  for (const mode of requiredModes) {
    const service = byMode.get(mode);
    const result = await runMode(mode, service);
    results.push(result);
    if (result.outcome === "BOOKING_CONFIRMED") {
      console.log(
        `[smoke] ${mode} ok | service=${result.serviceId} booking=${result.bookingId} checkout=${result.checkoutStatus}`,
      );
    } else {
      console.log(
        `[smoke] ${mode} bloqueado por pagamentos (${result.blockedStage}) | service=${result.serviceId}`,
      );
    }
  }

  console.log("[smoke] sucesso");
  console.table(results);
}

main()
  .catch((err) => {
    console.error("[smoke] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
