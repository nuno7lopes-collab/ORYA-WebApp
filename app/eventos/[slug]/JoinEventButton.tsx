// app/eventos/[slug]/JoinEventButton.tsx
"use client";

import { useState } from "react";

type JoinEventButtonProps = {
  initialGoingCount: number;
};

export default function JoinEventButton({
  initialGoingCount,
}: JoinEventButtonProps) {
  const [count, setCount] = useState(initialGoingCount);

  return (
    <button
      type="button"
      onClick={() => setCount((c) => c + 1)}
      className="w-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold py-3 rounded-xl hover:scale-105 transition-all shadow-lg shadow-[#6bffff33]"
    >
      Juntar-me ao evento ({count})
    </button>
  );
}