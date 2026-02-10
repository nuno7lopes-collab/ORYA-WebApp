"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type HomeCityPickerProps = {
  baseHref?: string;
};

export default function HomeCityPicker({ baseHref = "/descobrir" }: HomeCityPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const applyCity = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const target = `${baseHref}?city=${encodeURIComponent(trimmed)}`;
    router.push(target);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/30 hover:bg-white/10 transition"
      >
        Selecionar cidade
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyCity();
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Escreve a cidade"
        className="h-8 w-40 rounded-full border border-white/15 bg-white/5 px-3 text-[11px] text-white/80 outline-none focus:border-white/30"
      />
      <button
        type="button"
        onClick={applyCity}
        className="h-8 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] text-white/85 hover:border-white/35 hover:bg-white/15 transition"
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-8 rounded-full border border-white/10 px-2 text-[11px] text-white/60 hover:text-white/80 transition"
      >
        ✕
      </button>
    </div>
  );
}
