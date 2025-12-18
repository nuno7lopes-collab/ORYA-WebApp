"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";

function resolveLabel(pathname: string, tab: string) {
  if (pathname.startsWith("/organizador/eventos/novo")) return "Criar Evento";
  if (pathname.includes("/eventos/") && pathname.endsWith("/edit")) return "Editar Evento";
  if (pathname.includes("/eventos/")) return "Eventos";
  if (pathname.startsWith("/organizador/staff")) return "Staff";
  if (pathname.startsWith("/organizador/settings")) return "Definições";
  const map: Record<string, string> = {
    overview: "Resumos",
    events: "Eventos",
    sales: "Vendas",
    finance: "Finanças",
    invoices: "Faturação",
    marketing: "Marketing",
    padel: "Padel",
    staff: "Staff",
    settings: "Definições",
    create: "Criar Evento",
  };
  return map[tab] ?? "Dashboard";
}

export function OrganizerBreadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") || "overview";
  const label = resolveLabel(pathname || "", tabParamRaw);

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
