"use client";

import { useEffect } from "react";
import { useAuthModal } from "./AuthModalContext";
import { useUser } from "@/app/hooks/useUser";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";

const PROTECTED_PREFIXES = ["/org", "/org-hub", "/me"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AuthLinkInterceptor() {
  const { openModal, isOpen } = useAuthModal();
  const { isLoggedIn, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;

    const handleClick = (event: MouseEvent) => {
      if (isLoggedIn || isOpen) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (!isProtectedPath(url.pathname)) return;

      event.preventDefault();
      const redirectTo = sanitizeRedirectPath(`${url.pathname}${url.search}`, "/");
      openModal({ mode: "login", redirectTo, showGoogle: true });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isLoggedIn, isLoading, openModal, isOpen]);

  return null;
}
