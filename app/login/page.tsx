"use client";
import { Suspense, useEffect, useState } from "react";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function LoginContent() {
  const { openModal, isOpen } = useAuthModal();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirectTo") ?? "/me";
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      const { data, error } = await supabaseBrowser.auth.getUser();
      if (cancelled) return;
      if (!error && data?.user) {
        router.replace(redirectTo);
        return;
      }
      if (!isOpen) {
        openModal({ mode: "login", redirectTo });
      }
      setChecked(true);
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [openModal, redirectTo, router, isOpen]);

  return (
    <main className="min-h-screen flex items-center justify-center text-white">
      <p>
        {checked
          ? "Se o modal não abriu,"
          : "A preparar sessão..."}{" "}
        {checked && (
          <button
            onClick={() => openModal({ mode: "login", redirectTo })}
            className="underline"
          >
            clica aqui
          </button>
        )}
      </p>
    </main>
  );
}

export default function LoginRedirectPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
