"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { DASHBOARD_LABEL, DASHBOARD_TITLE, DASHBOARD_MUTED, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ResourceItem = {
  id: number;
  label: string;
};

export default function RecursoDisponibilidadePage() {
  const params = useParams();
  const idRaw = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const resourceId = Number(idRaw);
  const { data } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    "/api/organizacao/reservas/recursos",
    fetcher,
  );

  const resource = useMemo(() => {
    if (!Number.isFinite(resourceId)) return null;
    return data?.items?.find((item) => item.id === resourceId) ?? null;
  }, [data?.items, resourceId]);

  if (!Number.isFinite(resourceId)) {
    return <div className="text-white">Recurso invalido.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className={DASHBOARD_TITLE}>
            Disponibilidade · {resource?.label ?? "Recurso"}
          </h1>
          <p className={DASHBOARD_MUTED}>Configura horarios e excecoes.</p>
        </div>
        <Link href="/organizacao/reservas/recursos" className={CTA_SECONDARY}>
          Voltar
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h2 className="text-base font-semibold text-white">Agenda central</h2>
        <p className={DASHBOARD_MUTED}>
          A disponibilidade do recurso é gerida no calendário principal, usando o filtro de recursos.
        </p>
        <Link
          href={`/organizacao/reservas?tab=availability&resourceId=${resourceId}`}
          className={CTA_SECONDARY}
        >
          Abrir agenda
        </Link>
      </div>
    </div>
  );
}
