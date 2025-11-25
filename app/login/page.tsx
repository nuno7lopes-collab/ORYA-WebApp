"use client";
import { useEffect } from "react";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

export default function LoginRedirectPage() {
  const { openModal } = useAuthModal();

  useEffect(() => {
    openModal({ mode: "login", redirectTo: "/" });
  }, [openModal]);

  return (
    <main className="min-h-screen flex items-center justify-center text-white">
      <p>Se o modal não abriu, <button onClick={() => openModal({ mode: "login", redirectTo: "/" })} className="underline">clica aqui</button>.</p>
    </main>
  );
}
