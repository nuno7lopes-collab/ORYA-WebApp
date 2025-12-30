"use client";

import { useRouter } from "next/navigation";

type Props = {
  hrefFallback?: string;
  label?: string;
  className?: string;
};

export default function BackLink({ hrefFallback = "/", label = "Voltar", className = "" }: Props) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.push(hrefFallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 ${className}`}
    >
      <span className="text-lg leading-none">←</span>
      <span>{label}</span>
    </button>
  );
}
