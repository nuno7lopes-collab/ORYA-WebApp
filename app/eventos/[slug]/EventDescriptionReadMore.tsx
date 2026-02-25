"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { t } from "@/lib/i18n";

type EventDescriptionReadMoreProps = {
  text: string;
  locale?: string | null;
  collapsedLines?: number;
};

export default function EventDescriptionReadMore({
  text,
  locale,
  collapsedLines = 6,
}: EventDescriptionReadMoreProps) {
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const collapsedStyle = useMemo<CSSProperties>(
    () => ({
      display: "-webkit-box",
      WebkitLineClamp: collapsedLines,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    }),
    [collapsedLines],
  );

  useEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph || expanded) return;

    const checkOverflow = () => {
      const overflow = paragraph.scrollHeight > paragraph.clientHeight + 1;
      setHasOverflow(overflow);
    };

    checkOverflow();

    const scheduleCheck = () => {
      window.requestAnimationFrame(checkOverflow);
    };

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleCheck)
        : null;

    observer?.observe(paragraph);
    window.addEventListener("resize", scheduleCheck);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleCheck);
    };
  }, [collapsedLines, expanded, text]);

  return (
    <div className="mt-3">
      <div className="relative">
        <p
          ref={paragraphRef}
          className="whitespace-pre-line text-sm leading-relaxed text-white/80 md:text-base"
          style={expanded ? undefined : collapsedStyle}
        >
          {text}
        </p>

        {!expanded && hasOverflow ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />
        ) : null}
      </div>

      {!expanded && hasOverflow ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-white/90 transition hover:text-white"
        >
          {t("readMoreLabel", locale)}
          <span aria-hidden="true" className="text-xs">↓</span>
        </button>
      ) : null}
    </div>
  );
}
