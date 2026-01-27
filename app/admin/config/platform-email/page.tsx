"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

type ApiResponse =
  | {
      ok: true;
      email: string;
      source?: string;
      requestId?: string;
      correlationId?: string;
    }
  | {
      ok: false;
      error?: string;
      requestId?: string;
      correlationId?: string;
    };

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<ApiResponse>);

function normalizeOfficialEmail(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function AdminPlatformEmailPage() {
  const { data, isLoading, mutate } = useSWR<ApiResponse>("/api/admin/config/platform-email", fetcher, {
    revalidateOnFocus: false,
  });

  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentEmail = data && data.ok ? data.email : "";

  useEffect(() => {
    if (currentEmail) {
      setEmail(currentEmail);
    }
  }, [currentEmail]);

  const normalizedEmail = useMemo(() => normalizeOfficialEmail(email), [email]);
  const isInvalid = Boolean(normalizedEmail) && !isValidEmail(normalizedEmail);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!normalizedEmail || isInvalid) {
      setError("Email inválido. Confirma o formato.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/config/platform-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json || !("ok" in json) || !json.ok) {
        const isUnauthorized = res.status === 401 || res.status === 403;
        const requestId = json && typeof json === "object" && "requestId" in json ? json.requestId : undefined;
        if (isUnauthorized) {
          setError(`Sem permissões (ADMIN)${requestId ? ` • ${requestId}` : ""}`);
          return;
        }
        const msg = typeof json?.error === "string" ? json.error : "Não foi possível guardar.";
        setError(`${msg}${requestId ? ` • ${requestId}` : ""}`);
        return;
      }

      setSuccess(`Guardado${json.requestId ? ` • ${json.requestId}` : ""}`);
      await mutate();
    } catch (err) {
      console.error("Erro ao guardar platform email", err);
      setError("Erro inesperado ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Configurações" subtitle="Email oficial da plataforma.">
      <section className="space-y-6">
        <AdminPageHeader
          title="Email oficial da plataforma"
          subtitle="Define o endereço usado para verificações e comunicações administrativas."
          eyebrow="Admin • Config"
        />

        <div className="admin-card p-4 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Atual</p>
            <p className="mt-1 text-sm text-white/80">{currentEmail || "—"}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.2em] text-white/50">Novo email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input w-full"
              placeholder="admin@orya.pt"
            />
            {isInvalid && <p className="text-[12px] text-red-400">Formato inválido.</p>}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="admin-button-primary px-4 py-2 text-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "A guardar..." : "Guardar"}
            </button>
            {success && <p className="text-[12px] text-emerald-300">{success}</p>}
            {error && <p className="text-[12px] text-red-400">{error}</p>}
          </div>

          {!isLoading && data && !data.ok && data.error && (
            <p className="text-[12px] text-red-400">
              {data.error}
              {data.requestId ? ` • ${data.requestId}` : ""}
            </p>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
