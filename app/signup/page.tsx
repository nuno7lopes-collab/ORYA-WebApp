"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

function SignupContent() {
  const { openModal } = useAuthModal();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  useEffect(() => {
    openModal({ mode: "signup", redirectTo });
  }, [openModal, redirectTo]);

  return (
    <main className="min-h-screen flex items-center justify-center text-white">
      <p>
        Se o modal não abriu,{" "}
        <button
          onClick={() => openModal({ mode: "signup", redirectTo })}
          className="underline"
        >
          clica aqui
        </button>
        .
      </p>
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
