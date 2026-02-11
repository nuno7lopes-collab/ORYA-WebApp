"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { useUser } from "@/app/hooks/useUser";

export function AuthGate() {
  const { openModal, isOpen } = useAuthModal();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoggedIn, isLoading } = useUser();
  const openedRef = useRef(false);
  const refreshedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (openedRef.current || isOpen) return;
    const query = searchParams?.toString();
    const current = `${pathname}${query ? `?${query}` : ""}`;
    const redirectTo = sanitizeRedirectPath(current, "/");
    openModal({ mode: "login", redirectTo, showGoogle: true, dismissible: false });
    openedRef.current = true;
  }, [openModal, pathname, searchParams, isOpen]);

  useEffect(() => {
    setShowFallback(false);
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, [pathname, searchParams, isOpen]);

  useEffect(() => {
    if (isLoading || !isLoggedIn || refreshedRef.current) return;
    refreshedRef.current = true;
    router.refresh();
  }, [isLoggedIn, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-white bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)]">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-white/20 bg-white/10 grid place-items-center">
          <div className="h-3 w-3 rounded-full bg-white/70 animate-pulse" />
        </div>
        <h1 className="text-lg font-semibold">Acesso reservado</h1>
        <p className="mt-2 text-sm text-white/60">A abrir o login.</p>
        {showFallback && !isOpen && !isLoading && !isLoggedIn && (
          <div className="mt-5 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                const query = searchParams?.toString();
                const current = `${pathname}${query ? `?${query}` : ""}`;
                const redirectTo = sanitizeRedirectPath(current, "/");
                openModal({ mode: "login", redirectTo, showGoogle: true, dismissible: false });
              }}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Abrir login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
