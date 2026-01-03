"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CTA_PRIMARY, CTA_SECONDARY, DASHBOARD_CARD, DASHBOARD_LABEL, DASHBOARD_MUTED } from "@/app/organizacao/dashboardUi";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NovoServicoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [price, setPrice] = useState("20");
  const [currency, setCurrency] = useState("EUR");
  const [policyId, setPolicyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: policiesData } = useSWR<{ ok: boolean; items: { id: number; name: string }[] }>(
    "/api/organizacao/policies",
    fetcher,
  );
  const policies = policiesData?.items ?? [];

  useEffect(() => {
    if (!policyId && policies.length > 0) {
      setPolicyId(String(policies[0].id));
    }
  }, [policies, policyId]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/organizacao/servicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          durationMinutes: Number(durationMinutes),
          price: Math.round(Number(price) * 100),
          currency,
          policyId: policyId ? Number(policyId) : null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar serviço.");
      }

      router.push(`/organizacao/reservas/${json.service.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar serviço.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>Reservas</p>
        <h1 className="text-2xl font-semibold text-white">Novo serviço</h1>
        <p className={DASHBOARD_MUTED}>Define o serviço que os clientes vão reservar.</p>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}> 
        <div>
          <label className="text-sm text-white/80">Nome do serviço</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Corte + barba"
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Descrição</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Resumo rápido do serviço"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/80">Duração (min)</label>
            <input
              type="number"
              min="5"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Preço</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Moeda</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/80">Política de cancelamento</label>
          <select
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
          >
            {policies.length === 0 && <option value="">Sem políticas disponíveis</option>}
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-white/50">
            Define a regra que aparece na confirmação da reserva.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={CTA_PRIMARY}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "A criar..." : "Criar serviço"}
          </button>
          <button
            type="button"
            className={CTA_SECONDARY}
            onClick={() => router.push("/organizacao/reservas")}
          >
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}
