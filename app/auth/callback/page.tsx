"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function handleCallback() {
      try {
        // Garante que a sessão está escrita no browser
        await supabaseBrowser.auth.getSession();

        let target =
          searchParams.get("redirect") ||
          (typeof window !== "undefined"
            ? window.localStorage.getItem("orya_post_auth_redirect") || "/"
            : "/");

        if (!target || target === "") target = "/";

        // Migração de bilhetes guest para user recém autenticado (best-effort, assíncrono)
        fetch("/api/tickets/migrate-guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch((mErr) => console.warn("[auth/callback] migrate-guest falhou", mErr));

        if (cancelled) return;
        router.replace(target);
      } catch (err) {
        console.error("[auth/callback] erro", err);
        if (!cancelled) {
          setError("Não foi possível concluir a autenticação. Tenta novamente.");
        }
      } finally {
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem("orya_post_auth_redirect");
          } catch {}
        }
      }
    }

    handleCallback();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="orya-page-width min-h-screen flex items-center justify-center text-white">
        <p className="text-sm text-white/80">{error}</p>
      </main>
    );
  }

  return (
    <main className="orya-page-width min-h-screen flex items-center justify-center text-white">
      <p className="text-sm text-white/60">A concluir login…</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="orya-page-width min-h-screen flex items-center justify-center text-white">
          <p className="text-sm text-white/60">A concluir login…</p>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
