import OrganizationScanPage from "@/app/organizacao/(dashboard)/scan/page";
import { redirect } from "next/navigation";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

type CheckinMode = "scanner" | "list" | "sessions" | "logs" | "devices";

const CHECKIN_MODES: CheckinMode[] = ["scanner", "list", "sessions", "logs", "devices"];

function normalizeMode(value: string | null | undefined): CheckinMode {
  const normalized = (value ?? "").trim().toLowerCase();
  return CHECKIN_MODES.includes(normalized as CheckinMode)
    ? (normalized as CheckinMode)
    : "scanner";
}

export default async function OrgCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: SearchParamsInput;
}) {
  const { orgId } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const modeRaw = resolvedSearchParams?.mode;
  const mode = normalizeMode(Array.isArray(modeRaw) ? modeRaw[0] : modeRaw);
  const eventIdRaw = resolvedSearchParams?.eventId;
  const eventId = Array.isArray(eventIdRaw) ? eventIdRaw[0] : eventIdRaw;
  const nextEventQuery = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";

  if (mode === "list") {
    redirect(`/org/${orgId}/check-in/list${nextEventQuery}`);
  }
  if (mode === "sessions") {
    redirect(`/org/${orgId}/check-in/sessions${nextEventQuery}`);
  }
  if (mode === "logs") {
    redirect(`/org/${orgId}/check-in/logs${nextEventQuery}`);
  }
  if (mode === "devices") {
    redirect(`/org/${orgId}/check-in/devices${nextEventQuery}`);
  }

  return <OrganizationScanPage embedded mode="scanner" />;
}
