export const runtime = "nodejs";

import PartnershipWorkspaceClient from "./PartnershipWorkspaceClient";

type PageProps = {
  params: Promise<{ agreementId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const raw = params?.[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return null;
}

export default async function PadelPartnershipWorkspacePage({ params, searchParams }: PageProps) {
  const { agreementId } = await params;
  const query = (await searchParams) ?? {};
  const organizationIdRaw = readParam(query, "organizationId");
  const agreementIdNum = Number(agreementId);
  const organizationId = organizationIdRaw ? Number(organizationIdRaw) : null;

  return (
    <PartnershipWorkspaceClient
      agreementId={Number.isFinite(agreementIdNum) ? agreementIdNum : null}
      organizationId={Number.isFinite(organizationId) ? organizationId : null}
    />
  );
}

