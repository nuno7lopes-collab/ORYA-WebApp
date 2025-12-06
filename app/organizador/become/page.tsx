export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import BecomeOrganizerForm from "@/components/organizer/BecomeOrganizerForm";
import BackLink from "@/components/BackLink";

// app/organizador/become/page.tsx

export default async function BecomeOrganizerPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizador/become");
  }

  return (
    <div className="orya-body-bg min-h-screen px-4 py-12 text-white">
      <div className="mx-auto max-w-[1160px] space-y-10">
        <div className="flex items-center justify-start">
          <BackLink hrefFallback="/explorar" label="Voltar" />
        </div>

        <header className="space-y-2.5 text-center md:space-y-3">
          <div className="mx-auto inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/70">
            Organizador • Onboarding
          </div>
          <h1 className="text-3xl font-semibold md:text-[32px]">Cria a tua organização na ORYA</h1>
          <p className="mx-auto max-w-3xl text-[15px] text-white/75 md:text-base">
            Em menos de 1 minuto ficas pronto para vender bilhetes, sem burocracias.
          </p>
        </header>

        <BecomeOrganizerForm />

        <footer className="pt-4 text-center text-[12px] text-white/60">
          Ao continuar, confirmas que representas esta entidade e aceitas os{" "}
          <a href="#" className="underline underline-offset-2 hover:text-white">
            Termos do Organizador da ORYA
          </a>
          .
        </footer>
      </div>
    </div>
  );
}