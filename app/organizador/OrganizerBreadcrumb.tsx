"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";

const SECTION_LABELS: Record<string, string> = {
  overview: "Visão geral",
  eventos: "Eventos",
  "padel-hub": "Hub Padel",
  inscricoes: "Inscrições",
  reservas: "Reservas",
  checkin: "Check-in",
  staff: "Staff",
  settings: "Definições",
  perfil: "Perfil público",
  marketing: "Marketing",
  promos: "Códigos promocionais",
  promoters: "Promotores e parcerias",
  content: "Conteúdos e kits",
  vendas: "Vendas",
  financas: "Finanças",
  invoices: "Faturação",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  create: "Resumo",
  manage: "Gerir",
  promote: "Promover",
  analyze: "Analisar",
};

function resolveLabel(pathname: string, tab: string, section?: string | null, marketing?: string | null) {
  if (pathname.startsWith("/organizador/eventos/novo")) return "Criar evento";
  if (pathname.startsWith("/organizador/reservas/novo")) return "Criar serviço";
  if (pathname.startsWith("/organizador/reservas")) return "Reservas";
  if (pathname.includes("/eventos/") && pathname.endsWith("/edit")) return "Editar evento";
  if (pathname.includes("/eventos/") && pathname.endsWith("/live")) return "Gerir · Preparar live";
  if (pathname.includes("/eventos/")) return "Eventos";
  if (pathname.startsWith("/organizador/inscricoes")) return "Inscrições";
  if (pathname.startsWith("/organizador/scan")) return "Check-in";
  if (pathname.startsWith("/organizador/faturacao")) return "Finanças";
  if (pathname.startsWith("/organizador/pagamentos/invoices")) return "Faturação";
  if (pathname.startsWith("/organizador/tournaments/") && pathname.endsWith("/finance")) return "Finanças do torneio";
  if (pathname.startsWith("/organizador/tournaments/") && pathname.endsWith("/live")) return "Live do torneio";
  if (pathname.startsWith("/organizador/tournaments/")) return "Torneios";
  if (pathname.startsWith("/organizador/staff")) return "Staff";
  if (pathname.startsWith("/organizador/settings")) return "Definições";

  const objectiveLabel = OBJECTIVE_LABELS[tab];
  const sectionKey =
    tab === "promote" && section === "marketing" && marketing ? marketing : section;
  const sectionLabel = sectionKey ? SECTION_LABELS[sectionKey] : null;
  if (objectiveLabel && sectionLabel) {
    return `${objectiveLabel} · ${sectionLabel}`;
  }
  if (objectiveLabel) return objectiveLabel;

  if (tab === "overview") return "Resumo";
  return "Dashboard";
}

export function OrganizerBreadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") || "overview";
  const sectionParamRaw = searchParams?.get("section");
  const marketingParamRaw = searchParams?.get("marketing");
  const label = resolveLabel(pathname || "", tabParamRaw, sectionParamRaw, marketingParamRaw);

  return (
    <Breadcrumb className="text-base md:text-lg font-semibold text-white/80">
      <BreadcrumbList className="gap-3">
        <BreadcrumbItem className="text-white/75 hover:text-white transition">
          <Link href="/organizador">Dashboard</Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-white/50" />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-white">{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
