"use client";

type PurchaseModeSelectorProps = {
  mode: "guest" | "auth";
  onSelect: (mode: "guest" | "auth") => void;
};

export default function PurchaseModeSelector({ mode, onSelect }: PurchaseModeSelectorProps) {
  return (
    <div className="flex items-center gap-2 text-[11px] bg-white/10 rounded-full p-1 border border-white/15 w-fit backdrop-blur">
      <button
        type="button"
        onClick={() => onSelect("guest")}
        className={`px-3 py-1 rounded-full ${
          mode === "guest" ? "bg-white text-black font-semibold" : "text-white/70"
        }`}
      >
        Comprar como convidado
      </button>
      <button
        type="button"
        onClick={() => onSelect("auth")}
        className={`px-3 py-1 rounded-full ${
          mode === "auth" ? "bg-white text-black font-semibold" : "text-white/70"
        }`}
      >
        Entrar / Criar conta
      </button>
    </div>
  );
}
