"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { appendOrganizationIdToHref, parseOrganizationId } from "@/lib/organizationIdUtils";

const SECTION_LABELS: Record<string, string> = {
  overview: "Visão geral",
  modulos: "Módulos",
  eventos: "Eventos",
  "padel-club": "Gestão de Clube Padel",
  "padel-tournaments": "Torneios de Padel",
  calendar: "Calendário",
  clubs: "Clubes",
  courts: "Campos",
  categories: "Categorias",
  players: "Jogadores",
  trainers: "Treinadores",
  teams: "Equipas",
  community: "Comunidade",
  lessons: "Aulas",
  inscricoes: "Formulários",
  reservas: "Reservas",
  agenda: "Agenda",
  disponibilidade: "Disponibilidade",
  servicos: "Serviços",
  clientes: "Clientes",
  profissionais: "Profissionais",
  recursos: "Recursos",
  politicas: "Políticas",
  membros: "Membros",
  caixa: "Caixa",
  checkin: "Check-in",
  staff: "Equipa",
  settings: "Definições",
  perfil: "Perfil público",
  marketing: "Promoções",
  promos: "Códigos promocionais",
  promoters: "Promotores e parcerias",
  content: "Conteúdos e kits",
  vendas: "Vendas",
  financas: "Finanças",
  invoices: "Faturação",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  create: "Dashboard",
  manage: "Gerir",
  promote: "Promoções",
  analyze: "Analisar",
  profile: "Perfil",
};

function resolveLabel(
  pathname: string,
  tab: string,
  section?: string | null,
  marketing?: string | null,
  preset?: string | null,
  padel?: string | null,
) {
  if (pathname.startsWith("/org/torneios/novo") || pathname.startsWith("/org/padel/torneios/novo")) {
    return "Criar torneio";
  }
  if (pathname.startsWith("/org/eventos/novo")) return preset === "padel" ? "Criar torneio" : "Criar evento";
  if (pathname.startsWith("/org/chat")) {
    return "Chat interno";
  }
  if (
    (pathname.startsWith("/org/padel/torneios/") || pathname.startsWith("/org/torneios/")) &&
    pathname.endsWith("/edit")
  ) {
    return "Editar torneio";
  }
  if (
    (pathname.startsWith("/org/padel/torneios/") || pathname.startsWith("/org/torneios/")) &&
    pathname.endsWith("/live")
  ) {
    return "Gerir · Preparar live";
  }
  if (pathname.startsWith("/org/padel/torneios") || pathname.startsWith("/org/torneios")) {
    const sectionLabel = section ? SECTION_LABELS[section] : null;
    const padelLabel = padel ? SECTION_LABELS[padel] : null;
    const isPadelSection = section === "padel-club" || section === "padel-tournaments";
    if (isPadelSection && padelLabel) {
      return `${sectionLabel ?? "Padel"} · ${padelLabel}`;
    }
    if (sectionLabel && section !== "eventos") {
      return `Torneios de Padel · ${sectionLabel}`;
    }
    return "Torneios de Padel";
  }
  if (pathname.startsWith("/org/eventos")) {
    const sectionLabel = section ? SECTION_LABELS[section] : null;
    if (sectionLabel && section !== "eventos") {
      return `Eventos · ${sectionLabel}`;
    }
    return "Eventos";
  }
  if (pathname.startsWith("/org/reservas/novo")) return "Reservas · Criar serviço";
  if (pathname.startsWith("/org/reservas/servicos")) return "Reservas · Serviços";
  if (pathname.startsWith("/org/reservas/clientes")) return "Reservas · Clientes";
  if (pathname.startsWith("/org/reservas/profissionais")) return "Reservas · Profissionais";
  if (pathname.startsWith("/org/reservas/recursos")) return "Reservas · Recursos";
  if (pathname.startsWith("/org/reservas/politicas")) return "Reservas · Políticas";
  if (pathname.startsWith("/org/reservas")) {
    if (tab === "availability") return "Reservas · Disponibilidade";
    const sectionLabel = section ? SECTION_LABELS[section] : null;
    if (sectionLabel && section !== "reservas") {
      return `Reservas · ${sectionLabel}`;
    }
    return "Reservas";
  }
  if (pathname.startsWith("/org/clube/membros")) return "Clube · Membros";
  if (pathname.startsWith("/org/clube/caixa")) return "Clube · Caixa";
  if (pathname.includes("/eventos/") && pathname.endsWith("/edit")) return "Editar evento";
  if (pathname.includes("/eventos/") && pathname.endsWith("/live")) return "Gerir · Preparar live";
  if (pathname.includes("/eventos/")) return "Eventos";
  if (pathname.startsWith("/org/inscricoes")) return "Formulários";
  if (pathname.startsWith("/org/scan")) return "Check-in";
  if (pathname.startsWith("/org/faturacao")) return "Finanças";
  if (pathname.startsWith("/org/pagamentos/invoices")) return "Faturação";
  if (pathname.startsWith("/org/tournaments/") && pathname.endsWith("/finance")) return "Finanças do torneio";
  if (pathname.startsWith("/org/tournaments/") && pathname.endsWith("/live")) return "Live do torneio";
  if (pathname.startsWith("/org/tournaments/")) return "Torneios de Padel";
  if (pathname.startsWith("/org/staff")) return "Equipa";
  if (pathname.startsWith("/org/settings")) return "Definições";
  const objectiveLabel = OBJECTIVE_LABELS[tab];
  const sectionKey =
    tab === "promote" && section === "marketing" && marketing
      ? marketing
      : (section === "padel-club" || section === "padel-tournaments") && padel
        ? padel
        : section;
  const sectionLabel = sectionKey ? SECTION_LABELS[sectionKey] : null;
  if (objectiveLabel && sectionLabel) {
    return `${objectiveLabel} · ${sectionLabel}`;
  }
  if (objectiveLabel) return objectiveLabel;

  if (tab === "overview") return "Dashboard";
  if (tab === "profile") return "Perfil";
  return "Dashboard";
}

export function OrganizationBreadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") || "overview";
  const sectionParamRaw = searchParams?.get("section");
  const marketingParamRaw = searchParams?.get("marketing");
  const presetParamRaw = searchParams?.get("preset");
  const padelParamRaw = searchParams?.get("padel");
  const organizationId = parseOrganizationId(searchParams?.get("organizationId"));
  const dashboardHref = appendOrganizationIdToHref("/org/overview", organizationId);
  const label = resolveLabel(
    pathname || "",
    tabParamRaw,
    sectionParamRaw,
    marketingParamRaw,
    presetParamRaw,
    padelParamRaw,
  );

  return (
    <Breadcrumb className="text-base md:text-lg font-semibold text-white/80">
        <BreadcrumbList className="gap-3">
        <BreadcrumbItem className="text-white/75 hover:text-white transition">
          <Link href={dashboardHref}>Dashboard</Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-white/50" />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-white">{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
