"use client";

import { useState } from "react";
import { shareLink } from "@/lib/share/shareLink";
import { CTA_SECONDARY } from "@/app/org/_shared/dashboardUi";

type EventShareButtonProps = {
  url: string;
  title: string;
};

export default function EventShareButton({ url, title }: EventShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={async () => {
          if (isBusy) return;
          setIsBusy(true);
          try {
            const result = await shareLink({
              url,
              title,
              text: "Vê este evento na ORYA",
            });
            if (!result.ok) {
              setFeedback("Não foi possível partilhar agora.");
            } else if (result.method === "clipboard") {
              setFeedback("Link copiado.");
            } else {
              setFeedback("Partilhado.");
            }
          } catch {
            setFeedback("Não foi possível partilhar agora.");
          } finally {
            setIsBusy(false);
            window.setTimeout(() => setFeedback(null), 1600);
          }
        }}
        className={`${CTA_SECONDARY} h-9 px-3.5 py-1 text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60`}
        aria-label="Partilhar evento"
      >
        Partilhar
      </button>
      {feedback ? <span className="text-[11px] text-white/70">{feedback}</span> : null}
    </div>
  );
}
