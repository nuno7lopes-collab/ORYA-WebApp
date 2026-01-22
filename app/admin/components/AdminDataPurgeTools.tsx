"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";
type PurgeMode = "ALL" | "KEEP_PROFILES";

const CONFIRM_ALL = "APAGAR TUDO";
const CONFIRM_KEEP = "APAGAR DADOS";

function getConfirmLabel(mode: PurgeMode) {
  return mode === "ALL" ? CONFIRM_ALL : CONFIRM_KEEP;
}

function getConfirmPrompt(mode: PurgeMode) {
  if (mode === "ALL") {
    return (
      "Isto vai apagar absolutamente todos os dados, incluindo perfis e contas auth.\n\n" +
      "Esta a\u00e7\u00e3o \u00e9 irrevers\u00edvel. Queres continuar?"
    );
  }
  return (
    "Isto vai apagar todos os dados exceto perfis e contas auth.\n\n" +
    "Esta a\u00e7\u00e3o \u00e9 irrevers\u00edvel. Queres continuar?"
  );
}

export default function AdminDataPurgeTools() {
  const [allConfirm, setAllConfirm] = useState("");
  const [keepConfirm, setKeepConfirm] = useState("");
  const [allStatus, setAllStatus] = useState<Status>("idle");
  const [keepStatus, setKeepStatus] = useState<Status>("idle");
  const [allMessage, setAllMessage] = useState<string | null>(null);
  const [keepMessage, setKeepMessage] = useState<string | null>(null);

  const anyLoading = allStatus === "loading" || keepStatus === "loading";
  const allReady = allConfirm.trim().toUpperCase() === CONFIRM_ALL;
  const keepReady = keepConfirm.trim().toUpperCase() === CONFIRM_KEEP;

  const handlePurge = async (mode: PurgeMode) => {
    const expected = getConfirmLabel(mode);
    const confirmValue = mode === "ALL" ? allConfirm : keepConfirm;
    const ready = mode === "ALL" ? allReady : keepReady;
    const setStatus = mode === "ALL" ? setAllStatus : setKeepStatus;
    const setMessage = mode === "ALL" ? setAllMessage : setKeepMessage;

    if (!ready) {
      setStatus("error");
      setMessage(`Escreve exatamente: ${expected}.`);
      return;
    }

    const confirmed = window.confirm(getConfirmPrompt(mode));
    if (!confirmed) return;

    setStatus("loading");
    setMessage(null);

    try {
      const res = await fetch("/api/admin/data/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, confirm: confirmValue.trim().toUpperCase() }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setStatus("error");
        setMessage(json?.error || "N\u00e3o foi poss\u00edvel apagar os dados.");
        return;
      }
      setStatus("success");
      setMessage("Dados apagados com sucesso.");
      if (mode === "ALL") {
        setAllConfirm("");
      } else {
        setKeepConfirm("");
      }
    } catch (err) {
      console.error("[admin/data/purge]", err);
      setStatus("error");
      setMessage("Erro inesperado ao apagar os dados.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[12px] text-rose-100">
        <p className="font-semibold">Zona cr\u00edtica</p>
        <p className="mt-1 text-rose-100/80">
          Opera\u00e7\u00f5es irrevers\u00edveis. Usa apenas em ambientes de teste ou staging.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="admin-card-soft space-y-3 p-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">N\u00edvel 1</p>
            <h3 className="text-sm font-semibold text-white">Apagar dados mantendo perfis</h3>
            <p className="mt-1 text-[12px] text-white/60">
              Remove tudo exceto perfis e contas auth. Mant\u00e9m logins e perfis intactos.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-white/60">Escreve {CONFIRM_KEEP} para confirmar</label>
            <input
              type="text"
              value={keepConfirm}
              onChange={(e) => setKeepConfirm(e.target.value)}
              className="admin-input"
              placeholder={CONFIRM_KEEP}
              disabled={anyLoading}
            />
          </div>
          <button
            type="button"
            onClick={() => handlePurge("KEEP_PROFILES")}
            disabled={!keepReady || anyLoading}
            className="admin-button-secondary px-3 py-2 text-[11px] disabled:opacity-60"
          >
            {keepStatus === "loading" ? "A apagar..." : "Apagar dados (manter perfis)"}
          </button>
          {keepMessage && (
            <p className={`text-[11px] ${keepStatus === "success" ? "text-emerald-200" : "text-rose-200"}`}>
              {keepMessage}
            </p>
          )}
        </div>

        <div className="admin-card-soft space-y-3 p-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">N\u00edvel 2</p>
            <h3 className="text-sm font-semibold text-white">Apagar tudo (inclui perfis)</h3>
            <p className="mt-1 text-[12px] text-white/60">
              Apaga absolutamente todos os dados, incluindo perfis e auth.users.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-white/60">Escreve {CONFIRM_ALL} para confirmar</label>
            <input
              type="text"
              value={allConfirm}
              onChange={(e) => setAllConfirm(e.target.value)}
              className="admin-input"
              placeholder={CONFIRM_ALL}
              disabled={anyLoading}
            />
          </div>
          <button
            type="button"
            onClick={() => handlePurge("ALL")}
            disabled={!allReady || anyLoading}
            className="admin-button-secondary px-3 py-2 text-[11px] text-rose-100 border-rose-500/50 disabled:opacity-60"
          >
            {allStatus === "loading" ? "A apagar..." : "Apagar tudo"}
          </button>
          {allMessage && (
            <p className={`text-[11px] ${allStatus === "success" ? "text-emerald-200" : "text-rose-200"}`}>
              {allMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
