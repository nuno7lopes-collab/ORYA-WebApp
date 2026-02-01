"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendOrganizationIdToHref, parseOrganizationId } from "@/lib/organizationIdUtils";

export default function OrganizationLinkInterceptor({
  organizationId,
}: {
  organizationId?: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedOrgId = organizationId ?? parseOrganizationId(searchParams?.get("organizationId"));

  useEffect(() => {
    if (!resolvedOrgId) return;

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
      if (url.searchParams.has("organizationId")) return;

      const relative = `${url.pathname}${url.search}${url.hash}`;
      const nextHref = appendOrganizationIdToHref(relative, resolvedOrgId);
      if (nextHref === relative) return;

      event.preventDefault();
      router.push(nextHref);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [resolvedOrgId, router]);

  return null;
}
