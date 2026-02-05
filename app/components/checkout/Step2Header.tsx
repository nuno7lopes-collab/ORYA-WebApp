"use client";

type Step2HeaderProps = {
  isGratisScenario: boolean;
  freeHeaderLabel: string;
  freeDescription: string;
  scenario?: string | null;
  scenarioCopy: Record<string, string>;
};

export default function Step2Header({
  isGratisScenario,
  freeHeaderLabel,
  freeDescription,
  scenario,
  scenarioCopy,
}: Step2HeaderProps) {
  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Passo 2 de 3</p>
          <h2 className="text-2xl font-semibold leading-tight">
            {isGratisScenario ? freeHeaderLabel : "Pagamento"}
          </h2>
          <p className="text-[11px] text-white/60 max-w-xs">
            {isGratisScenario ? freeDescription : "Pagamento seguro processado pela Stripe."}
          </p>
          {scenario && scenarioCopy[scenario] ? (
            <p className="text-[11px] text-white/75 max-w-sm">{scenarioCopy[scenario]}</p>
          ) : null}
        </div>
      </header>

      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] animate-pulse" />
      </div>
    </>
  );
}
