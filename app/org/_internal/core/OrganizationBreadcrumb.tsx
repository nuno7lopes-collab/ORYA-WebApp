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
  disponibilidade: "Disponibilidade (calendário)",
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
  marketing: "Marketing",
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
  promote: "Marketing",
  analyze: "Analisar",
};

function resolveLabel(
  pathname: string,
  tab: string,
  section?: string | null,
  marketing?: string | null,
  preset?: string | null,
  padel?: string | null,
  view?: string | null,
) {
  if (pathname.startsWith("/org/padel/tournaments/create")) {
    return "Criar torneio";
  }
  if (pathname.startsWith("/org/events/new")) return preset === "padel" ? "Criar torneio" : "Criar evento";
  if (/^\/org\/\d+\/chat(?:\/|$)/.test(pathname)) {
    return "Mensagens";
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
  if (/^\/org\/(?:\d+\/)?calendar\/day(?:\/|$)/.test(pathname)) return "Calendário · Dia";
  if (
    /^\/org\/(?:\d+\/)?calendar\/conflicts(?:\/|$)/.test(pathname) ||
    /^\/org\/(?:\d+\/)?calendar\/availability\/conflicts(?:\/|$)/.test(pathname)
  ) {
    return "Calendário · Conflitos de disponibilidade";
  }
  if (/^\/org\/(?:\d+\/)?calendar\/availability(?:\/|$)/.test(pathname)) {
    return "Calendário · Disponibilidade";
  }
  if (/^\/org\/(?:\d+\/)?calendar(?:\/|$)/.test(pathname)) return "Calendário";
  if (/^\/org\/(?:\d+\/)?bookings\/new(?:\/|$)/.test(pathname)) return "Reservas · Criar serviço";
  if (/^\/org\/(?:\d+\/)?bookings\/customers(?:\/|$)/.test(pathname)) return "Reservas · Clientes";
  if (/^\/org\/(?:\d+\/)?bookings\/professionals(?:\/|$)/.test(pathname)) return "Reservas · Profissionais";
  if (/^\/org\/(?:\d+\/)?bookings\/resources(?:\/|$)/.test(pathname)) return "Reservas · Recursos";
  if (/^\/org\/(?:\d+\/)?bookings(?:\/|$)/.test(pathname)) {
    if (/^\/org\/(?:\d+\/)?bookings\/availability(?:\/|$)/.test(pathname)) return "Calendário · Disponibilidade";
    const sectionLabel = section ? SECTION_LABELS[section] : null;
    if (sectionLabel && section !== "reservas") {
      return `Reservas · ${sectionLabel}`;
    }
    return "Reservas";
  }
  if (/^\/org\/\d+\/policies(?:\/|$)/.test(pathname)) {
    if (view === "booking") return "Políticas · Reservas";
    if (view === "crm") return "Políticas · CRM";
    if (view === "finance") return "Políticas · Financeiro";
    if (view === "padel") return "Políticas · Padel";
    if (view === "terms") return "Políticas · Termos";
    if (view === "store") return "Políticas · Loja";
    if (view === "guardrails") return "Políticas · Limites";
    return "Políticas";
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
  const viewParamRaw = searchParams?.get("view");
  const organizationId = parseOrgIdFromPathnameStrict(pathname ?? "");
  const dashboardHref = organizationId ? buildOrgHref(organizationId, "/overview") : buildOrgHubHref("/organizations");
  const label = resolveLabel(
    pathname || "",
    tabParamRaw,
    sectionParamRaw,
    marketingParamRaw,
    presetParamRaw,
    padelParamRaw,
    viewParamRaw,
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
