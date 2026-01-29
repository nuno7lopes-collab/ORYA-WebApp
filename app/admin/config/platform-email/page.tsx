"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";
import { isValidOfficialEmail, normalizeOfficialEmail } from "@/lib/organizationOfficialEmail";

type PlatformEmailResponse =
  | {
      ok: true;
      email?: string;
      data?: { email?: string };
      requestId?: string;
      correlationId?: string;
    }
  | {
      ok: false;
      error?: string;
      errorCode?: string;
      message?: string;
      requestId?: string;
      correlationId?: string;
    };

function extractRequestInfo(res: Response, json: PlatformEmailResponse | null) {
  const requestId =
    json?.requestId ??
    res.headers.get("x-orya-request-id") ??
    res.headers.get("x-request-id") ??
    null;
  const correlationId =
    json?.correlationId ??
    res.headers.get("x-orya-correlation-id") ??
    res.headers.get("x-correlation-id") ??
    null;
  return { requestId, correlationId };
}

export default function PlatformEmailConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestMeta, setRequestMeta] = useState<{ requestId?: string | null; correlationId?: string | null }>({});
  const [accessIssue, setAccessIssue] = useState<"UNAUTH" | "FORBIDDEN" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEmail() {
      setLoading(true);
      setErrorMessage(null);
      setStatusMessage(null);
      setAccessIssue(null);
      try {
        const res = await fetch("/api/admin/config/platform-email", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as PlatformEmailResponse | null;
        const meta = extractRequestInfo(res, json);
        if (cancelled) return;
        setRequestMeta(meta);

        if (res.status === 401) {
          setAccessIssue("UNAUTH");
          return;
        }
        if (res.status === 403) {
          setAccessIssue("FORBIDDEN");
          return;
        }
        if (!res.ok || !json || json.ok === false) {
          const errorCode =
            json && "errorCode" in json && typeof json.errorCode === "string"
              ? json.errorCode
              : json && "error" in json && typeof json.error === "string"
                ? json.error
                : "UNKNOWN_ERROR";
          setErrorMessage(`Erro: ${errorCode}`);
          return;
        }

        const nextEmail =
          typeof json.data?.email === "string"
            ? json.data.email
            : typeof json.email === "string"
              ? json.email
              : "";
        setCurrentEmail(nextEmail || null);
        setEmail(nextEmail || "");
      } catch (err) {
        if (cancelled) return;
        console.error("[admin/config/platform-email] load", err);
        setErrorMessage("Erro inesperado ao carregar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEmail();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedEmail = useMemo(() => normalizeOfficialEmail(email), [email]);
  const isValid = useMemo(
    () => Boolean(normalizedEmail && isValidOfficialEmail(normalizedEmail)),
    [normalizedEmail],
  );

  const handleSave = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setAccessIssue(null);

    if (!normalizedEmail || !isValid) {
      setErrorMessage("Email inválido. Usa um email válido para a plataforma.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/config/platform-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const json = (await res.json().catch(() => null)) as PlatformEmailResponse | null;
      const meta = extractRequestInfo(res, json);
      setRequestMeta(meta);

      if (res.status === 401) {
        setAccessIssue("UNAUTH");
        return;
      }
      if (res.status === 403) {
        setAccessIssue("FORBIDDEN");
        return;
      }
      if (!res.ok || !json || json.ok === false) {
        const errorCode =
          json && "errorCode" in json && typeof json.errorCode === "string"
            ? json.errorCode
            : json && "error" in json && typeof json.error === "string"
              ? json.error
              : "UNKNOWN_ERROR";
        setErrorMessage(`Erro: ${errorCode}`);
        return;
      }

      setCurrentEmail(normalizedEmail);
      setEmail(normalizedEmail);
      setStatusMessage("Guardado.");
    } catch (err) {
      console.error("[admin/config/platform-email] save", err);
      setErrorMessage("Erro inesperado ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const requestIdLabel = requestMeta.requestId ? `requestId: ${requestMeta.requestId}` : null;
  const correlationIdLabel = requestMeta.correlationId ? `correlationId: ${requestMeta.correlationId}` : null;

  return (
    <AdminLayout
      title="Configuração"
      subtitle="Configurações globais de suporte/contato da plataforma."
    >
      <section className="space-y-6">
        <AdminPageHeader
          title="Email oficial da plataforma"
          subtitle="Define o email global usado para comunicações administrativas."
          eyebrow="Admin • Config"
        />

        <div className="admin-card space-y-4 p-4">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Estado atual</p>
            <p className="text-sm text-white/80">
              Atual:{" "}
              <span className="font-semibold text-white/90">
                {currentEmail ?? (loading ? "A carregar..." : "—")}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] uppercase tracking-[0.18em] text-white/50">
              Email da plataforma
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@plataforma.pt"
              className="admin-input w-full"
              disabled={loading || saving}
            />
            {!loading && email && !isValid && (
              <p className="text-[12px] text-amber-200/80">
                Email inválido. Usa um email válido para a plataforma.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="admin-button px-4 py-2 text-[12px]"
              onClick={handleSave}
              disabled={saving || loading || !isValid}
            >
              {saving ? "A guardar..." : "Guardar"}
            </button>
            {statusMessage && <p className="text-[12px] text-emerald-200">{statusMessage}</p>}
            {errorMessage && <p className="text-[12px] text-amber-200">{errorMessage}</p>}
            {accessIssue && (
              <p className="text-[12px] text-amber-200">
                Sem permissões (ADMIN).
              </p>
            )}
          </div>

          {(requestIdLabel || correlationIdLabel) && (
            <div className="text-[11px] text-white/50">
              {requestIdLabel ? <span>{requestIdLabel}</span> : null}
              {requestIdLabel && correlationIdLabel ? <span> · </span> : null}
              {correlationIdLabel ? <span>{correlationIdLabel}</span> : null}
            </div>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
