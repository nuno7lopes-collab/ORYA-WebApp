"use client";
import { Suspense, useEffect, useState } from "react";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { PendingDeleteBanner } from "./pending-delete-banner";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";

function LoginContent() {
  const { openModal, isOpen } = useAuthModal();
  const searchParams = useSearchParams();
  const router = useRouter();
  const logoutFlag =
    searchParams.get("logout") === "1" || searchParams.get("loggedOut") === "1";
  const redirectTo = sanitizeRedirectPath(
    searchParams.get("redirectTo") ??
      searchParams.get("redirect") ??
      searchParams.get("next"),
    "/"
  );
  const [checked, setChecked] = useState(false);
  const [openedOnce, setOpenedOnce] = useState(false);
  const [fallback, setFallback] = useState<string>("/");
  const [mounted, setMounted] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const pending = window.localStorage.getItem("orya_pending_email");
      if (pending) setPendingEmail(pending);
    }
  }, []);

  useEffect(() => {
    // Escolhe melhor fallback: query ? redirectTo : same-origin referrer : "/"
    if (typeof window !== "undefined") {
      const ref = document.referrer;
      const sameOriginRef =
        ref && new URL(ref).origin === window.location.origin
          ? new URL(ref).pathname + new URL(ref).search
          : null;
      const safeRef = sanitizeRedirectPath(sameOriginRef, "/");
      setFallback(redirectTo || safeRef || "/");
    }
  }, [redirectTo]);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      const { data, error } = await supabaseBrowser.auth.getUser();
      if (cancelled) return;
      if (!error && data?.user) {
        if (redirectTo.startsWith("/admin")) {
          try {
            const res = await fetch("/api/admin/mfa/session", {
              cache: "no-store",
              credentials: "include",
            });
            if (res.status === 403) {
              router.replace("/admin/forbidden");
              return;
            }
            const json = await res.json().catch(() => null);
            if (json?.ok && json.data?.required && !json.data?.verified) {
              const next =
                redirectTo && redirectTo !== "/admin"
                  ? `?redirectTo=${encodeURIComponent(redirectTo)}`
                  : "";
              router.replace(`/admin/mfa${next}`);
              return;
            }
          } catch {
            // fall back to redirect below
          }
        }
        router.replace(redirectTo);
        return;
      }
      if (!openedOnce && !isOpen) {
        if (pendingEmail) {
          openModal({ mode: "verify", email: pendingEmail, redirectTo });
        } else {
          openModal({ mode: "login", redirectTo, showGoogle: true });
        }
        setOpenedOnce(true);
      }
      setChecked(true);
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [openModal, redirectTo, router, isOpen, openedOnce, pendingEmail]);

  useEffect(() => {
    setShowFallback(false);
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, [redirectTo]);

  // Se o modal foi aberto e entretanto está fechado, redireciona para o fallback
  useEffect(() => {
    if (openedOnce && !isOpen) {
      router.replace(fallback);
    }
  }, [openedOnce, isOpen, router, fallback]);

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 text-white bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)]">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <PendingDeleteBanner />
        {logoutFlag && (
          <div className="mb-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-[12px] text-emerald-100">
            Sessão terminada com sucesso.
          </div>
        )}
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-white/20 bg-white/10 grid place-items-center">
          <div className="h-3 w-3 rounded-full bg-white/70 animate-pulse" />
        </div>
        <h1 className="text-lg font-semibold">A abrir sessão</h1>
        <p className="mt-2 text-sm text-white/60">{checked ? "Só um instante." : "A preparar..."}</p>

        {checked && showFallback && !isOpen && (
          <div className="mt-5 flex items-center justify-center gap-3 text-sm">
            <button
              onClick={() =>
                openModal({ mode: "login", redirectTo, showGoogle: true })
              }
              className="rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10"
            >
              Abrir
            </button>
            <button
              onClick={() => router.replace(redirectTo)}
              className="rounded-full border border-white/10 px-4 py-2 text-white/60 hover:bg-white/5"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginRedirectPage() {
  return (
    <Suspense
      fallback={
        <main className="orya-page-width min-h-screen flex items-center justify-center text-white">
          <p className="text-sm text-white/60">A preparar sessão...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
