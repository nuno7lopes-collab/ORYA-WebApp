"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import OrganizationSidebar from "@/app/org/_internal/core/OrganizationSidebar";
import type {
  OrganizationShellActiveOrg,
  OrganizationShellOrgOption,
  OrganizationShellUser,
} from "@/app/org/_internal/core/OrganizationDashboardShell";
export default function OrganizationSidebarDrawer({
  isOpen,
  onClose,
  activeOrg,
  orgOptions,
  user,
  role,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeOrg: OrganizationShellActiveOrg | null;
  orgOptions: OrganizationShellOrgOption[];
  user: OrganizationShellUser | null;
  role?: string | null;
}) {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    if (!isOpen) return;
    if (pathname === previousPathname) return;
    onClose();
  }, [isOpen, onClose, pathname]);
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] lg:hidden",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!isOpen}
    >
      {" "}
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/76 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        aria-label="Fechar menu"
      />{" "}
      <aside
        className={cn(
          "org-shell-sidebar absolute inset-y-0 left-0 w-[var(--org-sidebar-drawer-width,min(86vw,360px))] overflow-hidden border-r border-[var(--org-shell-border)] bg-[var(--org-sidebar-bg)] transition-transform",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {" "}
        <div className="flex h-12 items-center justify-between border-b border-[var(--org-shell-border)] px-3">
          {" "}
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
            Navegação
          </p>{" "}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-transparent px-2 py-1 text-[12px] text-white/70 hover:bg-[var(--org-hover)]"
          >
            {" "}
            Fechar{" "}
          </button>{" "}
        </div>{" "}
        <OrganizationSidebar
          activeOrg={activeOrg}
          orgOptions={orgOptions}
          user={user}
          role={role}
          className="h-[calc(100%-48px)] min-h-0 overflow-hidden"
          onNavigate={onClose}
        />{" "}
      </aside>{" "}
    </div>
  );
}
