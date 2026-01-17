"use client";

import Link from "next/link";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";

export default function NovaEventoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 text-white">
      <div className="orya-page-width flex justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/70">Criação de eventos</p>
          <h1 className="mt-2 text-2xl font-semibold">Agora tudo acontece pelas organizações</h1>
          <p className="mt-3 text-sm text-white/70">
            Para manter a plataforma limpa e profissional, os eventos passam a ser criados e geridos dentro do dashboard da
            organização.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/organizacao/become" className={CTA_PRIMARY}>
              Criar organização
            </Link>
            <Link href="/organizacao?tab=create" className={CTA_SECONDARY}>
              Ir para o dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
