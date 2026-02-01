"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { shareLink } from "@/lib/share/shareLink";

type InvitePeopleCardProps = {
  href?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  className?: string;
};

export default function InvitePeopleCard({
  href = "https://orya.pt",
  title = "Convida pessoas",
  description = "Partilha o teu link e traz a tua rede para os eventos.",
  ctaLabel = "Convidar",
  className,
}: InvitePeopleCardProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const res = await shareLink({ url: href, title, text: description });
      if (res.ok && res.method === "clipboard") {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      // fallback below
    }
  };

  return (
    <div className={cn("orya-mobile-surface-soft p-4", className)}>
      <p className="orya-mobile-kicker">Rede ORYA</p>
      <h3 className="mt-2 text-[15px] font-semibold text-white">{title}</h3>
      <p className="mt-2 text-[12px] text-white/70">{description}</p>
      <button
        type="button"
        onClick={handleShare}
        className="btn-orya mt-4 inline-flex text-[11px] font-semibold"
      >
        {copied ? "Link copiado" : ctaLabel}
      </button>
    </div>
  );
}
