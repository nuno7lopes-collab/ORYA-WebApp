"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SidebarRail } from "@/components/ui/sidebar";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";
import { CTA_PRIMARY } from "@/app/organizador/dashboardUi";

type OrgOption = {
  organizerId: number;
  role: string;
  organizer: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    organizationKind?: string | null;
    organizationCategory?: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
  };
};

type ActiveOrg = {
  id: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  organizationKind?: string | null;
  organizationCategory?: string | null;
};

type UserInfo = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type OrgCategory = "EVENTOS" | "PADEL" | "VOLUNTARIADO";

const normalizeOrganizationCategory = (category?: string | null): OrgCategory => {
  const normalized = category?.toUpperCase() ?? "";
  if (normalized === "PADEL") return "PADEL";
  if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
  return "EVENTOS";
};

const CATEGORY_LABELS: Record<OrgCategory, string> = {
  EVENTOS: "Eventos",
  PADEL: "Padel",
  VOLUNTARIADO: "Voluntariado",
};

const CATEGORY_CTA: Record<OrgCategory, { label: string; href: string }> = {
  EVENTOS: { label: "Criar evento", href: "/organizador/eventos/novo" },
  PADEL: { label: "Criar torneio de padel", href: "/organizador/eventos/novo?preset=padel" },
  VOLUNTARIADO: { label: "Criar evento", href: "/organizador/eventos/novo?preset=voluntariado" },
};

function buildNav() {
  const linkClass = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm",
      active
        ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    );

  const subLinkClass = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm",
      active
        ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    );

  return {
    linkClass,
    subLinkClass,
  };
}

export function AppSidebar({
  activeOrg,
  orgOptions,
  user,
}: {
  activeOrg: ActiveOrg | null;
  orgOptions: OrgOption[];
  user: UserInfo | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab");
  const sectionParam = searchParams?.get("section");
  const [orgOpen, setOrgOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<number | null>(null);

  const isEventsActive = useMemo(() => {
    if (pathname === "/organizador") return true;
    if (pathname?.startsWith("/organizador/eventos")) return true;
    if (tabParamRaw === "manage") {
      if (!sectionParam) return true;
      return ["eventos", "events", "torneios"].includes(sectionParam);
    }
    return false;
  }, [pathname, tabParamRaw, sectionParam]);

  const isInscricoesActive = useMemo(() => {
    if (pathname?.startsWith("/organizador/inscricoes")) return true;
    return tabParamRaw === "manage" && sectionParam === "inscricoes";
  }, [pathname, tabParamRaw, sectionParam]);

  const isPadelActive = useMemo(() => {
    if (pathname?.startsWith("/organizador/padel")) return true;
    return tabParamRaw === "manage" && ["padel-hub", "padel"].includes(sectionParam ?? "");
  }, [pathname, tabParamRaw, sectionParam]);

  const isPromoteActive = useMemo(() => {
    if (pathname?.startsWith("/organizador/updates")) return true;
    return tabParamRaw === "promote";
  }, [pathname, tabParamRaw]);

  const isAnalyzeActive = useMemo(() => {
    if (pathname?.startsWith("/organizador/faturacao")) return true;
    if (pathname?.startsWith("/organizador/pagamentos/invoices")) return true;
    if (pathname?.startsWith("/organizador/tournaments/") && pathname?.endsWith("/finance")) return true;
    return tabParamRaw === "analyze";
  }, [pathname, tabParamRaw]);

  const isProfileActive = useMemo(
    () => tabParamRaw === "profile" || tabParamRaw === "perfil",
    [tabParamRaw],
  );

  const isStaffActive = useMemo(() => pathname?.startsWith("/organizador/staff"), [pathname]);
  const isSettingsActive = useMemo(() => pathname?.startsWith("/organizador/settings"), [pathname]);

  const { linkClass, subLinkClass } = buildNav();

  const orgDisplay = activeOrg?.name ?? "Organização";
  const orgAvatar = activeOrg?.avatarUrl ?? null;

  const switchOrg = async (orgId: number) => {
    if (switchingOrgId) return;
    setSwitchingOrgId(orgId);
    try {
      const res = await fetch("/api/organizador/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: orgId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        console.warn("[org switch] falhou", json?.error ?? res.statusText);
        return;
      }
      setOrgOpen(false);
      router.replace(`/organizador?tab=manage&org=${orgId}`);
      router.refresh();
    } catch (err) {
      console.error("[org switch] erro inesperado", err);
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const goUserMode = () => {
    try {
      document.cookie = "orya_org=; path=/; Max-Age=0; SameSite=Lax";
    } catch {
      /* ignore */
    }
    setUserOpen(false);
    router.push("/me");
  };

  const signOut = async () => {
    try {
      await supabaseBrowser.auth.signOut();
    } catch (err) {
      console.error("Erro no signOut", err);
    } finally {
      router.push("/login");
    }
  };

  const userLabel = user?.name || user?.email || "Utilizador";
  const userInitial = (userLabel || "U").charAt(0).toUpperCase();

  const orgList = orgOptions ?? [];
  const orgCurrent = orgList.find((o) => o.organizerId === activeOrg?.id) ?? orgList[0] ?? null;
  const orgButtonAvatar = orgCurrent?.organizer.brandingAvatarUrl || orgAvatar;
  const orgCategoryValue =
    orgCurrent?.organizer.organizationCategory ?? activeOrg?.organizationCategory ?? null;
  const orgCategory = normalizeOrganizationCategory(orgCategoryValue);
  const categoryLabel = CATEGORY_LABELS[orgCategory];
  const categoryCta = CATEGORY_CTA[orgCategory];
  const eventsLabel = orgCategory === "PADEL" ? "Torneios" : "Eventos";
  const supportsInscricoes = orgCategory !== "PADEL";

  return (
    <>
      <SidebarRail>
      {/* Organização switcher */}
      <div className="px-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setOrgOpen((v) => !v)}
            aria-expanded={orgOpen}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2">
              {orgButtonAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orgButtonAvatar}
                  alt={orgCurrent?.organizer.publicName || orgDisplay || "Organização"}
                  className="h-8 w-8 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold">
                  {(orgCurrent?.organizer.publicName || orgCurrent?.organizer.businessName || "O")[0]}
                </span>
              )}
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Organização</p>
                <p className="text-sm font-semibold text-white">
                  {orgCurrent?.organizer.publicName ||
                    orgCurrent?.organizer.businessName ||
                    "Selecionar"}
                </p>
              </div>
            </div>
            <span className={cn("text-white/60 transition-transform", orgOpen ? "rotate-180" : "")}>▾</span>
          </button>
          {orgOpen && (
            <div className="mt-2 space-y-1">
              {orgList.map((item) => {
                const isActive = item.organizerId === orgCurrent?.organizerId;
                const isSwitching = switchingOrgId === item.organizerId;
                return (
                  <button
                    key={item.organizerId}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => switchOrg(item.organizerId)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                      isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10",
                      isSwitching && "opacity-70 cursor-progress",
                    )}
                  >
                    <span className="text-left">
                      {item.organizer.publicName || item.organizer.businessName}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]">
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-[1px] text-white/70">
                        {item.role}
                      </span>
                      {isActive && <span className="text-emerald-200">ativo</span>}
                    </div>
                  </button>
                );
              })}
              <Link
                href="/organizador/become"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                onClick={() => setOrgOpen(false)}
              >
                <span>Adicionar organização</span>
                <span className="text-[10px] text-white/60">+</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Navegação */}
      <nav className="mt-6 flex-1 space-y-3 px-3 text-sm">
        <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">Categoria ativa</p>
          <p className="text-sm font-semibold text-white">{categoryLabel}</p>
        </div>

        <Link
          href={categoryCta.href}
          className={cn(CTA_PRIMARY, "w-full justify-center")}
        >
          {categoryCta.label}
        </Link>

        <p className="px-2 pt-2 text-[10px] uppercase tracking-[0.24em] text-white/45">Organização</p>
        <Link href="/organizador" className={linkClass(isEventsActive)}>
          <span>{eventsLabel}</span>
        </Link>
        {supportsInscricoes && (
          <Link href="/organizador/inscricoes" className={linkClass(isInscricoesActive)}>
            <span>Inscrições</span>
          </Link>
        )}
        {orgCategory === "PADEL" && (
          <Link href="/organizador/padel" className={linkClass(isPadelActive)}>
            <span>Padel Hub</span>
          </Link>
        )}
        <Link
          href="/organizador?tab=promote&section=marketing&marketing=overview"
          className={linkClass(isPromoteActive)}
        >
          <span>Promover</span>
        </Link>
        <Link href="/organizador?tab=analyze&section=financas" className={linkClass(isAnalyzeActive)}>
          <span>Analisar</span>
        </Link>
        <Link href="/organizador?tab=profile" className={linkClass(isProfileActive)}>
          <span>Perfil</span>
        </Link>

        <div className="pt-2">
          <p className="px-2 text-[10px] uppercase tracking-[0.24em] text-white/45">Equipa &amp; Conta</p>
          <Link href="/organizador/staff" className={subLinkClass(isStaffActive)}>
            <span>Staff</span>
          </Link>
          <Link href="/organizador/settings" className={subLinkClass(isSettingsActive)}>
            <span>Definições</span>
          </Link>
        </div>
      </nav>

      {/* Utilizador */}
      <div className="space-y-2 px-3 pb-4 pt-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            aria-expanded={userOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={userLabel} className="h-8 w-8 rounded-lg border border-white/10 object-cover" />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold">
                  {userInitial}
                </span>
              )}
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Utilizador</p>
                <p className="text-sm font-semibold text-white">{userLabel}</p>
              </div>
            </div>
            <span className={cn("text-white/60 transition-transform", userOpen ? "rotate-180" : "")}>▾</span>
          </button>
          {userOpen && (
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={goUserMode}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                <span>Voltar a utilizador</span>
                <span className="text-[10px] text-white/60">↺</span>
              </button>
              <Link
                href="/me/settings"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition hover:bg-white/10"
                onClick={() => setUserOpen(false)}
              >
                <span>Settings</span>
                <span className="text-[10px] text-white/60">↗</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/15"
              >
                <span>Terminar sessão</span>
                <span className="text-[10px] text-rose-200">×</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </SidebarRail>
    </>
  );
}
