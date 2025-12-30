"use client";

import { useEffect } from "react";

export function RecoveryRedirector() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hash, pathname, search } = window.location;
    if (pathname === "/reset-password") return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const query = new URLSearchParams(search.replace(/^\?/, ""));

    const type = params.get("type") || query.get("type");
    const hasRecoveryFlag = query.get("recovery") === "1";
    const hasToken =
      params.has("access_token") ||
      params.has("token") ||
      params.has("code") ||
      params.has("refresh_token");
    const hasError =
      params.has("error") ||
      params.has("error_code") ||
      params.has("error_description");

    // Redireciona para reset-password em qualquer cenário de recuperação (tokens ou erros)
    if ((hasRecoveryFlag || type === "recovery") && (hasToken || hasError)) {
      window.location.replace(`/reset-password${search}${hash}`);
    } else if (hasError && hasToken) {
      // fallback defensivo para hashes de recovery sem type/recovery flag
      window.location.replace(`/reset-password${search}${hash}`);
    }
  }, []);

  return null;
}
