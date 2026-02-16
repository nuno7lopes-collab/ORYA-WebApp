import { redirect } from "next/navigation";
import DashboardClient from "../DashboardClient";
import { OrganizationTour } from "../OrganizationTour";
import { AuthModalProvider } from "@/app/components/autenticação/AuthModalContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { ensureDashboardAccess } from "@/app/org/_internal/core/_lib/dashboardAccess";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { buildOrgHref } from "@/lib/organizationIdUtils";

export const runtime = "nodejs";

/**
 * Router inteligente do /organizacao.
 * Decide o destino com base no estado do utilizador e organizações.
 * Quando há organização ativa, renderiza o dashboard (overview como tab default no client).
 */
export default async function OrganizationRouterPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { activeOrganizationId, isSuspended } = await ensureDashboardAccess();
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const tabParam = typeof resolvedSearchParams?.tab === "string" ? resolvedSearchParams?.tab : null;
  const sectionParam = typeof resolvedSearchParams?.section === "string" ? resolvedSearchParams.section : null;
  const targetBase =
    tabParam === "manage"
      ? sectionParam === "reservas"
        ? buildOrgHref(activeOrganizationId, "/bookings")
        : sectionParam === "inscricoes"
          ? buildOrgHref(activeOrganizationId, "/forms")
          : sectionParam === "padel-club"
            ? buildOrgHref(activeOrganizationId, "/padel/clubs")
            : sectionParam === "padel-tournaments"
              ? buildOrgHref(activeOrganizationId, "/padel/tournaments")
              : sectionParam === "staff"
                ? buildOrgHref(activeOrganizationId, "/team")
                : sectionParam === "chat"
                  ? buildOrgHref(activeOrganizationId, "/chat")
                  : sectionParam === "crm"
                    ? buildOrgHref(activeOrganizationId, "/crm/customers")
                    : buildOrgHref(activeOrganizationId, "/events")
      : tabParam === "analyze"
        ? sectionParam === "financas" || sectionParam === "invoices"
          ? buildOrgHref(activeOrganizationId, "/finance")
          : buildOrgHref(activeOrganizationId, "/analytics")
        : tabParam === "promote"
          ? buildOrgHref(activeOrganizationId, "/marketing")
          : tabParam === "profile"
            ? buildOrgHref(activeOrganizationId, "/settings")
            : buildOrgHref(activeOrganizationId, "/overview");

  const params = new URLSearchParams();
  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (key === "tab") continue;
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      }
    }
  }
  params.delete("organizationId");

  const query = params.toString();
  if (tabParam || query) {
    redirect(`${targetBase}${query ? `?${query}` : ""}`);
  }

  return (
    <AuthModalProvider>
      <DashboardClient hasOrganization defaultObjective="create" defaultSection="overview" />
      {!isSuspended ? <OrganizationTour organizationId={activeOrganizationId} /> : null}
    </AuthModalProvider>
  );
}
