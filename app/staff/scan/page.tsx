"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { CheckinScanner } from "@/app/components/checkin/CheckinScanner";

export default function StaffScanPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/staff/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center px-6">
        <p>A carregar a tua sessão…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center px-6">
        <p>A redirecionar…</p>
      </main>
    );
  }

  return (
    <CheckinScanner
      backHref="/staff/eventos"
      backLabel="Voltar aos eventos"
      title="Modo Receção · Staff"
      subtitle="Valida os participantes em 2 passos com confirmação explícita."
    />
  );
}
