
import clsx from "clsx";

type ProfileStatsBarProps = {
  /**
   * Indica se é o próprio utilizador a ver o perfil.
   * Se true → mostra "Total investido".
   * Se false → mostra "Desde ..." (se existir).
   */
  isOwner?: boolean;

  /**
   * Número total de eventos com bilhete ligados a esta conta.
   */
  totalTickets: number;

  /**
   * Número de eventos futuros (data >= hoje).
   */
  upcomingTickets: number;

  /**
   * Número de eventos passados (data &lt; hoje).
   */
  pastTickets: number;

  /**
   * Total estimado gasto em bilhetes ORYA (em euros, por agora).
   * Apenas mostrado quando isOwner = true.
   */
  totalSpentEuros?: number | null;

  /**
   * Texto amigável para "membro desde" (ex: "2024", "Jan 2025").
   * Usado em modo público (isOwner = false).
   */
  memberSinceLabel?: string | null;

  /**
   * Classe extra opcional para ajustar margem/padding onde for usado.
   */
  className?: string;
};

function formatPlural(count: number, singular: string, plural: string) {
  if (!Number.isFinite(count)) return `0 ${plural}`;
  if (count === 1) return `1 ${singular}`;
  if (count < 0) return `0 ${plural}`;
  return `${count} ${plural}`;
}

export function ProfileStatsBar({
  isOwner = false,
  totalTickets,
  upcomingTickets,
  pastTickets,
  totalSpentEuros,
  memberSinceLabel,
  className,
}: ProfileStatsBarProps) {
  const hasSpentInfo =
    isOwner && totalSpentEuros != null && Number.isFinite(totalSpentEuros);

  const memberSinceText =
    !isOwner && memberSinceLabel
      ? `Na ORYA desde ${memberSinceLabel}`
      : null;

  return (
    <section
      aria-label="Estatísticas de eventos"
      className={clsx(
        "w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 md:px-6 md:py-4 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Título + subtítulo */}
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Resumo da tua vida ORYA
          </p>
          <p className="text-sm text-white/80">
            Uma visão rápida dos eventos onde já estiveste e dos próximos que
            vêm aí.
          </p>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 gap-2 text-[11px] md:flex md:flex-row md:items-stretch md:gap-3">
          {/* Total de eventos com bilhete */}
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/55">
              Eventos com bilhete
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {totalTickets}
            </p>
            <p className="mt-0.5 text-[10px] text-white/55">
              {formatPlural(totalTickets, "evento", "eventos")}
            </p>
          </div>

          {/* Próximos eventos */}
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/80">
              Próximos
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-100">
              {upcomingTickets}
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-100/70">
              {upcomingTickets === 0
                ? "Ainda não tens nada marcado"
                : formatPlural(upcomingTickets, "evento marcado", "eventos marcados")}
            </p>
          </div>

          {/* Eventos já vividos */}
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-white/15 bg-white/3 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/55">
              Já vividos
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {pastTickets}
            </p>
            <p className="mt-0.5 text-[10px] text-white/55">
              {pastTickets === 0
                ? "Tudo ainda por acontecer"
                : formatPlural(pastTickets, "evento passado", "eventos passados")}
            </p>
          </div>

          {/* Total investido (privado) OU "Na ORYA desde" (público) */}
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-white/15 bg-gradient-to-r from-[#FF00C8]/10 via-[#6BFFFF]/10 to-[#1646F5]/15 px-3 py-2.5">
            {isOwner ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">
                  Total investido
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {hasSpentInfo
                    ? `${totalSpentEuros!.toFixed(2)} €`
                    : "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-white/60">
                  {hasSpentInfo
                    ? "Valor aproximado em bilhetes ORYA."
                    : "Assim que começares a comprar bilhetes, este valor aparece aqui."}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">
                  Perfil público
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {memberSinceLabel ?? "ORYA Explorer"}
                </p>
                <p className="mt-0.5 text-[10px] text-white/60">
                  {memberSinceText ??
                    "Explorador ORYA — presença em eventos reais."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProfileStatsBar;
