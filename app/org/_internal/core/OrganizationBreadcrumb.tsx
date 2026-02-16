"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { buildOrgHref, buildOrgHubHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";

const SECTION_LABELS: Record<string, string> = {
  overview: "Visão geral",
  ferramentas: "Ferramentas",
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
  marketing: "Promoções",
  promos: "Códigos promocionais",
  promoters: "Promotores e parcerias",
  content: "Conteúdos e kits",
  vendas: "Vendas",
  financas: "Finanças",
  invoices: "Faturação",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  create: "Painel",
  manage: "Gerir",
  promote: "Promoções",
  analyze: "Analisar",
};

function resolveLabel(
  pathname: string,
  tab: string,
  section?: string | null,
  marketing?: string | null,
  preset?: string | null,
  padel?: string | null,
) {
  if (pathname.startsWith("/org/padel/tournaments/create")) {
    return "Criar torneio";
  }
  if (pathname.startsWith("/org/events/new")) return preset === "padel" ? "Criar torneio" : "Criar evento";
  if (/^\/org\/\d+\/chat(?:\/|$)/.test(pathname)) {
    return "Chat interno";
  }
  if (pathname.startsWith("/org/padel/tournaments/") && pathname.endsWith("/edit")) {
    return "Editar torneio";
  }
  if (pathname.startsWith("/org/padel/tournaments")) {
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
  if (pathname.startsWith("/org/events")) {
    const sectionLabel = section ? SECTION_LABELS[section] : null;
    if (sectionLabel && section !== "eventos") {
      return `Eventos · ${sectionLabel}`;
    }
    return "Eventos";
  }
  if (pathname.startsWith("/org/calendar/day")) return "Calendário · Dia";
  if (pathname.startsWith("/org/calendar")) return "Calendário";
  if (pathname.startsWith("/org/bookings/new")) return "Reservas · Criar serviço";
  if (pathname.startsWith("/org/bookings/customers")) return "Reservas · Clientes";
  if (pathname.startsWith("/org/bookings/professionals")) return "Reservas · Profissionais";
  if (pathname.startsWith("/org/bookings/resources")) return "Reservas · Recursos";
  if (pathname.startsWith("/org/bookings/policies")) return "Reservas · Políticas";
  if (pathname.startsWith("/org/bookings/prices")) return "Reservas · Preços";
  if (pathname.startsWith("/org/bookings/integrations")) return "Reservas · Integrações";
  if (pathname.startsWith("/org/bookings")) {
    if (pathname.startsWith("/org/bookings/availability")) return "Reservas · Disponibilidade";
    const sectionLabel = section ? SECTION_LABELS[section] : null;
    if (sectionLabel && section !== "reservas") {
      return `Reservas · ${sectionLabel}`;
    }
    return "Reservas";
  }
  if (pathname.startsWith("/org/clube/membros")) return "Clube · Membros";
  if (pathname.startsWith("/org/clube/caixa")) return "Clube · Caixa";
  if (pathname.includes("/eventos/") && pathname.endsWith("/edit")) return "Editar evento";
  if (pathname.includes("/eventos/")) return "Eventos";
  if (pathname.startsWith("/org/forms")) return "Formulários";
  if (pathname.startsWith("/org/check-in")) return "Check-in";
  if (pathname.startsWith("/org/faturacao")) return "Finanças";
  if (pathname.startsWith("/org/pagamentos/invoices")) return "Faturação";
  if (pathname.startsWith("/org/team")) return "Equipa";
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

  if (tab === "overview") return "Painel";
  return "Painel";
}

export function OrganizationBreadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") || "overview";
  const sectionParamRaw = searchParams?.get("section");
  const marketingParamRaw = searchParams?.get("marketing");
  const presetParamRaw = searchParams?.get("preset");
  const padelParamRaw = searchParams?.get("padel");
  const organizationId = parseOrgIdFromPathnameStrict(pathname ?? "");
  const dashboardHref = organizationId ? buildOrgHref(organizationId, "/overview") : buildOrgHubHref("/organizations");
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
          <Link href={dashboardHref}>Painel</Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-white/50" />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-white">{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
