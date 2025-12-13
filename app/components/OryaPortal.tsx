"use client";

import type { CSSProperties } from "react";

type PortalState = "idle" | "hover" | "press" | "loader" | "empty";
type PortalVariant = "full" | "eyes";

type Props = {
  size?: number;
  state?: PortalState;
  variant?: PortalVariant;
};

export function OryaPortal({ size = 44, state = "idle", variant = "full" }: Props) {
  const headLiftMap: Record<PortalState, number> = {
    idle: 8,
    hover: 12,
    press: 14,
    loader: 10,
    empty: 6,
  };

  const glowMap: Record<PortalState, number> = {
    idle: 1,
    hover: 1.2,
    press: 1.35,
    loader: 1.3,
    empty: 0.9,
  };

  const showOrbs = state === "loader" || state === "hover" || state === "press";
  const eyesOnly = variant === "eyes";

  const styleVars: CSSProperties = {
    "--portal-size": `${size}px`,
    "--head-lift": `${headLiftMap[state]}px`,
    "--glow-scale": glowMap[state],
  } as CSSProperties;

  return (
    <div className="relative inline-block" style={styleVars} aria-hidden="true">
      <div className="portal-shell">
        <div className={`portal-ring ${state !== "empty" ? "animate-breathe" : ""}`} />
        <div className="portal-inner" />

        {!eyesOnly && (
          <div className={`character ${state !== "empty" ? "animate-bob" : ""}`}>
            <div className="head">
              <span className="eye eye-left" />
              <span className="eye eye-right" />
              <span className="hand hand-left" />
              <span className="hand hand-right" />
            </div>
          </div>
        )}

        {eyesOnly && (
          <div className="eyes-only">
            <span className="eye eye-left small" />
            <span className="eye eye-right small" />
          </div>
        )}

        {showOrbs && (
          <>
            <span className="orb orb-a" />
            <span className="orb orb-b" />
          </>
        )}
      </div>

      <style jsx>{`
        .portal-shell {
          position: relative;
          width: var(--portal-size);
          height: var(--portal-size);
        }

        .portal-ring {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: conic-gradient(
            from 90deg,
            #ff00c8,
            #7300ff,
            #6bffff,
            #1646f5,
            #ff00c8
          );
          box-shadow: 0 0 24px rgba(107, 255, 255, 0.35);
          -webkit-mask: radial-gradient(circle at center, transparent 60%, black 60%);
                  mask: radial-gradient(circle at center, transparent 60%, black 60%);
          transform: scale(var(--glow-scale));
          transition: transform 240ms ease, box-shadow 240ms ease;
        }

        .portal-inner {
          position: absolute;
          inset: 4px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, rgba(40, 60, 90, 0.4), rgba(6, 10, 18, 0.95));
          box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.6);
        }

        .character {
          position: absolute;
          left: 50%;
          bottom: 8px;
          transform: translate(-50%, calc(-1 * var(--head-lift)));
          width: 62%;
          height: 62%;
        }

        .head {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.08), rgba(12, 18, 32, 0.9));
          box-shadow: inset 0 -6px 12px rgba(0, 0, 0, 0.35);
        }

        .eye {
          position: absolute;
          top: 44%;
          width: 16%;
          height: 16%;
          border-radius: 999px;
          background: linear-gradient(120deg, #e5f9ff, #9ee7ff);
          box-shadow: 0 0 6px rgba(107, 255, 255, 0.5);
          animation: blink 7s ease-in-out infinite;
        }
        .eye-left {
          left: 33%;
          animation-delay: 0.6s;
        }
        .eye-right {
          right: 33%;
          animation-delay: 1.1s;
        }
        .eye.small {
          top: 47%;
          width: 14%;
          height: 14%;
        }

        .hand {
          position: absolute;
          bottom: 10%;
          width: 18%;
          height: 10%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
          opacity: 0.6;
        }
        .hand-left {
          left: 22%;
          transform: rotate(-8deg);
        }
        .hand-right {
          right: 22%;
          transform: rotate(8deg);
        }

        .eyes-only {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16%;
        }

        .orb {
          position: absolute;
          width: 16%;
          height: 16%;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.45);
          top: 50%;
          left: 50%;
          transform-origin: -220% center;
          animation: orbitA 8s linear infinite;
          opacity: 0.8;
        }
        .orb-b {
          width: 12%;
          height: 12%;
          transform-origin: 200% center;
          animation: orbitB 10s linear infinite;
          background: radial-gradient(circle, rgba(107, 255, 255, 0.9), rgba(107, 255, 255, 0));
        }

        @keyframes orbitA {
          from {
            transform: rotate(0deg) translateX(-50%) translateY(-50%);
          }
          to {
            transform: rotate(360deg) translateX(-50%) translateY(-50%);
          }
        }
        @keyframes orbitB {
          from {
            transform: rotate(360deg) translateX(-50%) translateY(-50%);
          }
          to {
            transform: rotate(0deg) translateX(-50%) translateY(-50%);
          }
        }

        @keyframes breathe {
          0%,
          100% {
            box-shadow: 0 0 18px rgba(107, 255, 255, 0.28);
          }
          50% {
            box-shadow: 0 0 28px rgba(107, 255, 255, 0.46);
          }
        }
        .animate-breathe {
          animation: breathe 8s ease-in-out infinite;
        }

        @keyframes bob {
          0%,
          100% {
            transform: translate(-50%, calc(-1 * var(--head-lift)));
          }
          50% {
            transform: translate(-50%, calc(-1 * var(--head-lift) - 2px));
          }
        }
        .animate-bob {
          animation: bob 6s ease-in-out infinite;
        }

        @keyframes blink {
          0%,
          92%,
          100% {
            transform: scaleY(1);
          }
          94% {
            transform: scaleY(0.25);
          }
          96% {
            transform: scaleY(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-breathe,
          .animate-bob,
          .orb {
            animation: none;
          }
          .orb {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
