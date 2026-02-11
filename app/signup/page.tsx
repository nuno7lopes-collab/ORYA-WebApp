"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";

function SignupContent() {
  const { openModal, isOpen } = useAuthModal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectPath(
    searchParams.get("redirectTo") ?? searchParams.get("redirect"),
    "/"
  );
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    openModal({ mode: "signup", redirectTo });
  }, [openModal, redirectTo]);

  useEffect(() => {
    setShowFallback(false);
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, [redirectTo]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 text-white bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)]">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-white/20 bg-white/10 grid place-items-center">
          <div className="h-3 w-3 rounded-full bg-white/70 animate-pulse" />
        </div>
        <h1 className="text-lg font-semibold">A abrir registo</h1>
        <p className="mt-2 text-sm text-white/60">Só um instante.</p>

        {showFallback && !isOpen && (
          <div className="mt-5 flex items-center justify-center gap-3 text-sm">
            <button
              onClick={() => openModal({ mode: "signup", redirectTo })}
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

export default function SignupRedirectPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
