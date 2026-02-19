"use client";

import useSWR from "swr";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function TeamSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  const { data } = useSWR<{ viewerRole?: string | null }>(
    orgId ? `/api/org-hub/organizations/members?organizationId=${orgId}` : null,
    (url: string) => fetch(url).then((res) => res.json()),
    { revalidateOnFocus: false },
  );
  if (!orgId) return null;

  const viewerRole = typeof data?.viewerRole === "string" ? data.viewerRole : null;
  const canManageTeam = viewerRole === "OWNER" || viewerRole === "CO_OWNER" || viewerRole === "ADMIN";

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "members", label: "Membros", href: buildOrgHref(orgId, "/team") },
        ...(canManageTeam
          ? [
              { id: "permissions", label: "Permissões", href: buildOrgHref(orgId, "/team", { staff: "permissoes" }) },
              { id: "audit", label: "Auditoria", href: buildOrgHref(orgId, "/team", { staff: "auditoria" }) },
            ]
          : []),
      ]}
    />
  );
}
