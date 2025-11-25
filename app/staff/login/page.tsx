"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

export default function StaffLoginPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const { openModal } = useAuthModal();

  // Se já estiver autenticado, manda logo para a lista de eventos de staff
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/staff/events");
    }
  }, [user, isLoading, router]);

  const handleLoginClick = () => {
    openModal({
      mode: "login",
      redirectTo: "/staff/events",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <p>A carregar a tua sessão…</p>
      </div>
    );
  }

  // Se ainda não estiver autenticado, mostra explicação + botão para entrar
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Modo Staff ORYA</h1>
          <p className="text-sm text-white/70">
            Entra com a tua conta ORYA para aceder à área de staff e fazer o
            check-in dos participantes nos eventos onde tens permissão.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoginClick}
          className="w-full bg-[#FF00C8] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
        >
          Entrar com a minha conta ORYA
        </button>
      </div>
    </div>
  );
}
