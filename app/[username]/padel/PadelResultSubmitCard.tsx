"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

type MatchStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "RESULT_SUBMITTED"
  | "PENDING_CONFIRMATION"
  | "PENDING_REVIEW_EXPIRED"
  | "DISPUTED"
  | "OFFICIAL"
  | "WALKOVER"
  | "RETIRED"
  | "CANCELLED"
  | string;

type ScoreMode = "SETS" | "TIMED_GAMES";

const LOCKED_STATUSES = new Set<MatchStatus>([
  "PENDING_CONFIRMATION",
  "PENDING_REVIEW_EXPIRED",
  "DISPUTED",
  "OFFICIAL",
  "WALKOVER",
  "RETIRED",
  "CANCELLED",
]);

const PRESETS_SETS = ["6-4, 6-4", "6-3, 6-4", "7-6, 6-4"];
const PRESETS_TIMED: Array<{ a: number; b: number }> = [
  { a: 6, b: 4 },
  { a: 7, b: 5 },
  { a: 4, b: 4 },
];

const parseSets = (raw: string) => {
  const chunks = raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length === 0) return null;
  const parsed = chunks.map((chunk) => {
    const parts = chunk.split("-").map((part) => Number(part.trim()));
    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
      return null;
    }
    const teamA = Math.floor(parts[0] as number);
    const teamB = Math.floor(parts[1] as number);
    if (teamA < 0 || teamB < 0) return null;
    return { teamA, teamB };
  });
  if (parsed.some((row) => row === null)) return null;
  return parsed as Array<{ teamA: number; teamB: number }>;
};

function statusLockHint(status: MatchStatus) {
  if (status === "PENDING_CONFIRMATION") return "Resultado já submetido e pendente de confirmação.";
  if (status === "PENDING_REVIEW_EXPIRED") return "Resultado expirado e em revisão pela organização.";
  if (status === "DISPUTED") return "Jogo em disputa. Aguarda resolução.";
  if (status === "OFFICIAL" || status === "WALKOVER" || status === "RETIRED") return "Resultado final oficial.";
  if (status === "CANCELLED") return "Jogo cancelado.";
  return "Submissão indisponível neste estado.";
}

function parseServerError(code: string | null | undefined) {
  if (!code) return "Não foi possível submeter o resultado.";
  if (code === "PLAYER_SUBMISSION_DISABLED") return "A organização desativou submissão por jogador.";
  if (code === "RESULT_REVIEW_IN_PROGRESS") return "Resultado já está em revisão/validação.";
  if (code === "MATCH_FINALIZED_USE_RESULT_WORKFLOW") return "Este jogo já está fechado.";
  if (code === "INVALID_SCORE") return "Score inválido. Revê os valores.";
  if (code === "MISSING_CLIENT_REQUEST_ID") return "Falha de idempotência. Tenta novamente.";
  return sanitizeUiErrorMessage(code, "Não foi possível submeter o resultado.");
}

export default function PadelResultSubmitCard({
  matchId,
  status,
  playerSubmissionEnabled,
  validationMode,
}: {
  matchId: number;
  status: MatchStatus;
  playerSubmissionEnabled: boolean;
  validationMode: "IMMEDIATE_OFFICIAL" | "IMMEDIATE_PENDING_THEN_OFFICIAL" | string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ScoreMode>("SETS");
  const [setsText, setSetsText] = useState("");
  const [gamesA, setGamesA] = useState("");
  const [gamesB, setGamesB] = useState("");
  const [allowDraw, setAllowDraw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmitByStatus = !LOCKED_STATUSES.has(status);
  const canSubmit = playerSubmissionEnabled && canSubmitByStatus;
  const submissionHint = useMemo(() => {
    if (!playerSubmissionEnabled) return "Submissão por jogador está desativada para este torneio.";
    if (!canSubmitByStatus) return statusLockHint(status);
    if (validationMode === "IMMEDIATE_PENDING_THEN_OFFICIAL") {
      return "Ao submeter, o resultado fica pendente de confirmação da organização.";
    }
    return "Ao submeter, o resultado pode ficar oficial de imediato.";
  }, [canSubmitByStatus, playerSubmissionEnabled, status, validationMode]);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setError(null);
    setSuccess(null);

    const scorePayload: Record<string, unknown> = {
      resultType: "NORMAL",
    };

    if (mode === "SETS") {
      const sets = parseSets(setsText);
      if (!sets || sets.length === 0) {
        setError("Indica sets válidos (ex: 6-4, 6-4).");
        return;
      }
      scorePayload.sets = sets;
    } else {
      const a = Number(gamesA);
      const b = Number(gamesB);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
        setError("Indica jogos válidos para A/B.");
        return;
      }
      scorePayload.mode = "TIMED_GAMES";
      scorePayload.gamesA = Math.floor(a);
      scorePayload.gamesB = Math.floor(b);
      scorePayload.allowDraw = allowDraw;
    }

    setBusy(true);
    try {
      const clientRequestId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res = await fetch(`/api/padel/matches/${matchId}/result/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId,
          score: scorePayload,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(parseServerError(typeof json?.error === "string" ? json.error : null));
        return;
      }
      const nextStatus = typeof json?.match?.status === "string" ? json.match.status : null;
      if (nextStatus === "PENDING_CONFIRMATION") {
        setSuccess("Resultado enviado. Aguarda confirmação da organização.");
      } else {
        setSuccess("Resultado submetido com sucesso.");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError("Erro ao submeter resultado.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-[11px] text-white/80">
      <p className="font-semibold text-white">Submissão de resultado (jogador)</p>
      <p className="text-white/65">{submissionHint}</p>

      {success && (
        <div className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-2 py-1 text-emerald-100">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-rose-100">
          {error}
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!canSubmit || busy}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/85 hover:bg-white/10 disabled:opacity-55"
        >
          Submeter resultado
        </button>
      )}

      {open && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("SETS")}
              className={`rounded-full border px-3 py-1 ${
                mode === "SETS"
                  ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100"
                  : "border-white/20 text-white/80 hover:bg-white/10"
              }`}
            >
              Sets
            </button>
            <button
              type="button"
              onClick={() => setMode("TIMED_GAMES")}
              className={`rounded-full border px-3 py-1 ${
                mode === "TIMED_GAMES"
                  ? "border-cyan-300/60 bg-cyan-500/15 text-cyan-100"
                  : "border-white/20 text-white/80 hover:bg-white/10"
              }`}
            >
              Tempo (jogos)
            </button>
          </div>

          {mode === "SETS" ? (
            <div className="space-y-2">
              <input
                type="text"
                value={setsText}
                onChange={(e) => setSetsText(e.target.value)}
                placeholder="6-4, 6-4"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] text-white"
              />
              <div className="flex flex-wrap gap-2">
                {PRESETS_SETS.map((preset) => (
                  <button
                    key={`${matchId}-sets-${preset}`}
                    type="button"
                    onClick={() => setSetsText(preset)}
                    className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/10"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={gamesA}
                  onChange={(e) => setGamesA(e.target.value)}
                  placeholder="Jogos A"
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] text-white"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={gamesB}
                  onChange={(e) => setGamesB(e.target.value)}
                  placeholder="Jogos B"
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-white/75">
                <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} />
                Permitir empate
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESETS_TIMED.map((preset) => (
                  <button
                    key={`${matchId}-timed-${preset.a}-${preset.b}`}
                    type="button"
                    onClick={() => {
                      setGamesA(String(preset.a));
                      setGamesB(String(preset.b));
                    }}
                    className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/10"
                  >
                    {preset.a}-{preset.b}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !canSubmit}
              className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black disabled:opacity-60"
            >
              {busy ? "A submeter..." : "Confirmar submissão"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={busy}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
