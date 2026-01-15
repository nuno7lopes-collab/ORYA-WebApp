import { useId } from "react";

type LogoTone = "full" | "mono" | "shadow";

type LogoRingProps = {
  size?: number;
  tone?: LogoTone;
};

function LogoRing({ size, tone = "full" }: LogoRingProps) {
  const uid = useId();
  const palette =
    tone === "mono"
      ? {
          ringBright: "#F7F3FF",
          ringMid: "#D9CEFF",
          ringDark: "#BFB1F0",
          glowStrong: "rgba(255,255,255,0.45)",
          glowSoft: "rgba(186,172,255,0.2)",
          fade: "rgba(255,255,255,0.22)",
        }
      : tone === "shadow"
        ? {
            ringBright: "rgba(255,255,255,0.45)",
            ringMid: "rgba(255,255,255,0.22)",
            ringDark: "rgba(255,255,255,0.08)",
            glowStrong: "rgba(255,255,255,0.2)",
            glowSoft: "rgba(134,110,255,0.14)",
            fade: "rgba(255,255,255,0.12)",
          }
        : {
            ringBright: "#F8F6FF",
            ringMid: "#DDD3FF",
            ringDark: "#C7B4FF",
            glowStrong: "rgba(167,118,255,0.7)",
            glowSoft: "rgba(96,104,220,0.35)",
            fade: "rgba(255,255,255,0.32)",
          };
  const ringId = `ring-${uid}-${tone}`;
  const innerId = `ring-inner-${uid}-${tone}`;
  const highlightId = `ring-highlight-${uid}-${tone}`;
  const glowId = `ring-glow-${uid}-${tone}`;
  const sweepId = `ring-sweep-${uid}-${tone}`;
  const dimension = size ? `${size}px` : "100%";

  return (
    <div className="relative" style={{ width: dimension, height: dimension }}>
      <svg
        viewBox="0 0 240 240"
        width={dimension}
        height={dimension}
        aria-hidden="true"
        className="relative z-10"
      >
        <defs>
          <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.ringBright} />
            <stop offset="55%" stopColor={palette.ringMid} />
            <stop offset="100%" stopColor={palette.ringDark} />
          </linearGradient>
          <linearGradient id={innerId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={palette.ringMid} />
            <stop offset="50%" stopColor={palette.ringBright} />
            <stop offset="100%" stopColor={palette.ringMid} />
          </linearGradient>
          <linearGradient id={highlightId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor={palette.fade} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={sweepId} cx="72%" cy="38%" r="70%">
            <stop offset="0%" stopColor={palette.glowStrong} />
            <stop offset="60%" stopColor={palette.glowSoft} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="6"
              floodColor={palette.glowStrong}
              floodOpacity="0.65"
            />
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="14"
              floodColor={palette.glowSoft}
              floodOpacity="0.6"
            />
          </filter>
        </defs>
        <circle
          cx="120"
          cy="120"
          r="108"
          fill={`url(#${sweepId})`}
          opacity={tone === "shadow" ? 0.3 : 0.55}
        />
        <g filter={`url(#${glowId})`} transform="rotate(-8 120 120)">
          <circle
            cx="120"
            cy="120"
            r="88"
            fill="none"
            stroke={`url(#${ringId})`}
            strokeWidth="16.5"
            strokeDasharray="480 73"
            strokeDashoffset="28"
            strokeLinecap="round"
          />
          <circle
            cx="120"
            cy="120"
            r="70"
            fill="none"
            stroke={`url(#${innerId})`}
            strokeWidth="11"
            strokeDasharray="360 79"
            strokeDashoffset="205"
            strokeLinecap="round"
          />
          <circle
            cx="120"
            cy="120"
            r="79"
            fill="none"
            stroke={`url(#${highlightId})`}
            strokeWidth="2.6"
            strokeDasharray="130 440"
            strokeDashoffset="120"
            strokeLinecap="round"
            opacity={tone === "shadow" ? 0.3 : 0.6}
          />
        </g>
        <g transform="rotate(-8 120 120)">
          <circle
            cx="120"
            cy="120"
            r="81.5"
            fill="none"
            stroke="rgba(106,92,170,0.45)"
            strokeWidth="1.6"
            strokeDasharray="480 73"
            strokeDashoffset="28"
            strokeLinecap="round"
          />
          <circle
            cx="120"
            cy="120"
            r="64.5"
            fill="none"
            stroke="rgba(106,92,170,0.38)"
            strokeWidth="1.4"
            strokeDasharray="360 79"
            strokeDashoffset="205"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}

export default function LogoPage() {
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.7) 100%), radial-gradient(circle at 64% 46%, rgba(164,112,255,0.68), transparent 40%), radial-gradient(circle at 30% 68%, rgba(30,40,110,0.38), transparent 56%), linear-gradient(135deg, #05050b 0%, #080814 35%, #120b26 58%, #20103b 76%, #2c1350 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-30 mix-blend-soft-light"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 45%), repeating-linear-gradient(120deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 22px)",
        }}
      />
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="w-[72vw] max-w-[460px] aspect-square">
          <LogoRing tone="full" />
        </div>
      </div>
    </div>
  );
}
