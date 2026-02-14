"use client";

import { CheckinScanner } from "@/app/components/checkin/CheckinScanner";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { buildOrgHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";

type OrganizationScanPageProps = {
  embedded?: boolean;
  mode?: "scanner" | "list" | "sessions" | "logs" | "devices";
};

const MODE_COPY: Record<NonNullable<OrganizationScanPageProps["mode"]>, { title: string; subtitle: string }> = {
  scanner: {
    title: "Modo Receção · Scanner",
    subtitle: "Validação QR rápida com confirmação explícita.",
  },
  list: {
    title: "Modo Receção · Lista",
    subtitle: "Validação assistida por pesquisa e seleção manual.",
  },
  sessions: {
    title: "Modo Receção · Sessões",
    subtitle: "Operação contínua para equipas de receção em rotação.",
  },
  logs: {
    title: "Modo Receção · Logs",
    subtitle: "Auditoria operacional com foco em validações recentes.",
  },
  devices: {
    title: "Modo Receção · Dispositivos",
    subtitle: "Controlo de postos e contexto de validação por dispositivo.",
  },
};

export default function OrganizationScanPage({ embedded, mode = "scanner" }: OrganizationScanPageProps) {
  const pathname = usePathname();
  const orgId = parseOrgIdFromPathnameStrict(pathname);
  const backHref = orgId ? buildOrgHref(orgId, "/overview") : "/org-hub/organizations";
  const modeCopy = MODE_COPY[mode] ?? MODE_COPY.scanner;
  const wrapperClass = cn(
    embedded ? "space-y-6 text-white" : "w-full space-y-6 py-8 text-white",
  );

  return (
    <div className={wrapperClass}>
      <CheckinScanner
        backHref={backHref}
        backLabel="Ver gestão"
        title={modeCopy.title}
        subtitle={modeCopy.subtitle}
        allowOrganizationEvents
        embedded
        showBackLink={false}
      />
    </div>
  );
}
