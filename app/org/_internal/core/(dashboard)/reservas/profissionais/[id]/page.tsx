import { redirect } from "next/navigation";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type PageProps = {
  params: {
    orgId?: string;
    id?: string;
  };
};

export default function ProfissionalDisponibilidadeRedirectPage({ params }: PageProps) {
  const orgId = parseOrganizationId(params?.orgId ?? null);
  const professionalId = parseOrganizationId(params?.id ?? null);

  if (!orgId || !professionalId) {
    return <div className="text-white">Profissional inválido.</div>;
  }

  redirect(
    buildOrgHref(orgId, "/calendar/availability", {
      scopeType: "PROFESSIONAL",
      scopeId: professionalId,
    }),
  );
}
