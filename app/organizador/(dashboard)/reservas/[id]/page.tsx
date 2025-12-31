"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_DANGER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/organizador/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Service = {
  id: number;
  policyId: number | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
  policy?: {
    id: number;
    name: string;
    policyType: string;
    cancellationWindowMinutes: number | null;
  } | null;
};

type Availability = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  status: string;
  _count?: { bookings: number };
};

export default function ServicoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const idRaw = params?.id;
  const serviceId = useMemo(() => {
    const value = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [idRaw]);

  const serviceKey = serviceId ? `/api/organizador/servicos/${serviceId}` : null;
  const availabilityKey = serviceId ? `/api/organizador/servicos/${serviceId}/disponibilidade` : null;

  const { data: serviceData, mutate: mutateService } = useSWR<{ ok: boolean; service: Service }>(
    serviceKey,
    fetcher,
  );
  const { data: availabilityData, mutate: mutateAvailability } = useSWR<{ ok: boolean; items: Availability[] }>(
    availabilityKey,
    fetcher,
  );
  const { data: policiesData } = useSWR<{ ok: boolean; items: { id: number; name: string }[] }>(
    "/api/organizador/policies",
    fetcher,
  );

  const service = serviceData?.service;
  const availabilities = availabilityData?.items ?? [];
  const policies = policiesData?.items ?? [];

  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState("");
  const [policyError, setPolicyError] = useState<string | null>(null);

  useEffect(() => {
    if (service?.policyId != null) {
      setPolicyId(String(service.policyId));
    } else if (!policyId && policies.length > 0) {
      setPolicyId(String(policies[0].id));
    }
  }, [service?.policyId, policies, policyId]);

  const createAvailability = async () => {
    if (!serviceId) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/organizador/servicos/${serviceId}/disponibilidade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          durationMinutes: durationMinutes ? Number(durationMinutes) : service?.durationMinutes,
          capacity: Number(capacity),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar disponibilidade.");
      }
      setStartsAt("");
      setDurationMinutes("");
      setCapacity("1");
      mutateAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar disponibilidade.");
    } finally {
      setSaving(false);
    }
  };

  const cancelAvailability = async (availabilityId: number) => {
    if (!serviceId) return;
    try {
      await fetch(`/api/organizador/servicos/${serviceId}/disponibilidade/${availabilityId}`, {
        method: "DELETE",
      });
      mutateAvailability();
    } catch {
      // ignore
    }
  };

  const toggleService = async () => {
    if (!serviceId || !service) return;
    await fetch(`/api/organizador/servicos/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    mutateService();
  };

  const updatePolicy = async (value: string) => {
    if (!serviceId) return;
    setPolicyError(null);
    setPolicyId(value);
    try {
      const res = await fetch(`/api/organizador/servicos/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: value ? Number(value) : null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar política.");
      }
      mutateService();
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Erro ao atualizar política.");
    }
  };

  if (!serviceId) {
    return <div className="text-white/70">Serviço inválido.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>Serviço</p>
        <h1 className="text-2xl font-semibold text-white">{service?.name || "Serviço"}</h1>
        <p className={DASHBOARD_MUTED}>
          {service
            ? `${service.durationMinutes} min · ${(service.price / 100).toFixed(2)} ${service.currency}`
            : "A carregar detalhes..."}
        </p>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-3")}>
        <div>
          <h2 className="text-base font-semibold text-white">Política de cancelamento</h2>
          <p className={DASHBOARD_MUTED}>Escolhe a regra aplicada às novas reservas.</p>
        </div>

        <select
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
          value={policyId}
          onChange={(e) => updatePolicy(e.target.value)}
        >
          {policies.length === 0 && <option value="">Sem políticas disponíveis</option>}
          {policies.map((policy) => (
            <option key={policy.id} value={policy.id}>
              {policy.name}
            </option>
          ))}
        </select>

        {service?.policy && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
            {service.policy.name}
            {service.policy.cancellationWindowMinutes
              ? ` · ${Math.round(service.policy.cancellationWindowMinutes / 60)}h`
              : ""}
          </div>
        )}

        {policyError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {policyError}
          </div>
        )}
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Disponibilidade</h2>
            <p className={DASHBOARD_MUTED}>Adiciona horários e controla vagas.</p>
          </div>
          {service && (
            <button type="button" className={CTA_SECONDARY} onClick={toggleService}>
              {service.isActive ? "Desativar serviço" : "Ativar serviço"}
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/80">Data e hora</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Duração (min)</label>
            <input
              type="number"
              min="5"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder={service?.durationMinutes?.toString() ?? "60"}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Capacidade</label>
            <input
              type="number"
              min="1"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={CTA_PRIMARY} onClick={createAvailability} disabled={saving}>
            {saving ? "A guardar..." : "Adicionar horário"}
          </button>
          <button type="button" className={CTA_SECONDARY} onClick={() => router.push("/organizador/reservas")}
          >
            Voltar
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {availabilities.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Sem horários registados.
            </div>
          )}
          {availabilities.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {new Date(item.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="text-[12px] text-white/60">
                    {item.durationMinutes} min · {item.capacity} vagas · {item._count?.bookings ?? 0} reservas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                    {item.status}
                  </span>
                  {item.status !== "CANCELLED" && (
                    <button type="button" className={CTA_DANGER} onClick={() => cancelAvailability(item.id)}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
