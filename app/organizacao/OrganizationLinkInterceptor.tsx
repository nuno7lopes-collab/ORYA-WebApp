"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { appendOrganizationIdToHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";

export default function OrganizationLinkInterceptor({
  organizationId,
}: {
  organizationId?: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedOrgId = organizationId ?? parseOrgIdFromPathnameStrict(pathname);

  useEffect(() => {
    const normalizeHref = (anchor: HTMLAnchorElement) => {
      if (!anchor.href) return;
      if (anchor.getAttribute("data-org-link") === "ignore") return;
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/organizacao")) return;
      const relative = `${url.pathname}${url.search}${url.hash}`;
      const nextHref = appendOrganizationIdToHref(relative, resolvedOrgId ?? null);
      if (nextHref && nextHref !== relative) {
        anchor.setAttribute("href", nextHref);
      }
    };

    // Canonicalize existing anchors so right-click/new-tab also use /org and /org-hub.
    document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => normalizeHref(anchor));

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node instanceof HTMLAnchorElement) {
            normalizeHref(node);
          }
          node.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => normalizeHref(anchor));
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("data-org-link") === "ignore") return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/organizacao")) return;

      const relative = `${url.pathname}${url.search}${url.hash}`;
      const nextHref = appendOrganizationIdToHref(relative, resolvedOrgId ?? null);
      if (nextHref === relative) return;

      event.preventDefault();
      router.push(nextHref);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, [resolvedOrgId, router]);

  return null;
}
