"use client";
import { Suspense, useEffect, useState } from "react";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function LoginContent() {
  const { openModal, isOpen } = useAuthModal();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const [checked, setChecked] = useState(false);
  const [openedOnce, setOpenedOnce] = useState(false);
  const [fallback, setFallback] = useState<string>("/");
  const [mounted, setMounted] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFallback(redirectTo || sameOriginRef || "/");
    }
  }, [redirectTo]);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      const { data, error } = await supabaseBrowser.auth.getUser();
      if (cancelled) return;
      if (!error && data?.user) {
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
    <main className="min-h-screen flex items-center justify-center text-white">
      <div className="text-center space-y-2">
        <p>{checked ? "Se o modal não abriu," : "A preparar sessão..."}</p>
        {checked && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() =>
                openModal({ mode: "login", redirectTo, showGoogle: true })
              }
              className="underline"
            >
              abrir modal
            </button>
            <button
              onClick={() => router.replace(redirectTo)}
              className="underline"
            >
              sair e voltar
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
        <main className="min-h-screen flex items-center justify-center text-white">
          <p className="text-sm text-white/60">A preparar sessão...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
