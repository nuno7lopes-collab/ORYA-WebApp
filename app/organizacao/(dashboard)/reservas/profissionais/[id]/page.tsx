"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { DASHBOARD_LABEL, DASHBOARD_TITLE, DASHBOARD_MUTED, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
};

export default function ProfissionalDisponibilidadePage() {
  const params = useParams();
  const idRaw = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const professionalId = Number(idRaw);
  const { data } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    "/api/organizacao/reservas/profissionais",
    fetcher,
  );

  const professional = useMemo(() => {
    if (!Number.isFinite(professionalId)) return null;
    return data?.items?.find((item) => item.id === professionalId) ?? null;
  }, [data?.items, professionalId]);

  if (!Number.isFinite(professionalId)) {
    return <div className="text-white">Profissional invalido.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className={DASHBOARD_TITLE}>
            Disponibilidade · {professional?.name ?? "Profissional"}
          </h1>
          <p className={DASHBOARD_MUTED}>Configura horarios e excecoes.</p>
        </div>
        <Link href="/organizacao/reservas/profissionais" className={CTA_SECONDARY}>
          Voltar
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h2 className="text-base font-semibold text-white">Agenda central</h2>
        <p className={DASHBOARD_MUTED}>
          A disponibilidade do profissional é gerida no calendario principal, usando o filtro de profissionais.
        </p>
        <Link
          href={`/organizacao/reservas?tab=availability&professionalId=${professionalId}`}
          className={CTA_SECONDARY}
        >
          Abrir agenda
        </Link>
      </div>
    </div>
  );
}
