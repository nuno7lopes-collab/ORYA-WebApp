export const runtime = "nodejs";

import PartnershipsPageClient from "./PartnershipsPageClient";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function readParam(params: PageProps["searchParams"], key: string) {
  const raw = params?.[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return null;
}

export default function PadelPartnershipsPage({ searchParams }: PageProps) {
  const organizationIdRaw = readParam(searchParams, "organizationId");
  const organizationId = organizationIdRaw ? Number(organizationIdRaw) : null;
  return <PartnershipsPageClient organizationId={Number.isFinite(organizationId) ? organizationId : null} />;
}

