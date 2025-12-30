"use client";

import { useRef, useEffect } from "react";

interface RingProps {
  size?: number;
  speed?: number;
  glow?: boolean;
  bloom?: boolean;
}

export default function Ring({
  size = 120,
  speed = 1,
  glow = true,
  bloom = true,
}: RingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    let frame = 0;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * DPR;
    canvas.height = size * DPR;

    const CX = canvas.width / 2;
    const CY = canvas.height / 2;
    const R = (size * 0.42) * DPR;
    const THICK = (size * 0.11) * DPR;

    const COLORS = ["#6BFFFF", "#45E5FF", "#7300FF", "#FF00C8", "#6BFFFF"];

    function conicGradient(angle = 0) {
      const g = ctx.createConicGradient(angle, CX, CY);
      const step = 1 / (COLORS.length - 1);
      COLORS.forEach((c, i) => g.addColorStop(i * step, c));
      return g;
    }

    function draw() {
      frame += 0.0025 * speed;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = THICK;
      ctx.lineCap = "round";

      // ANEL PRINCIPAL
      ctx.strokeStyle = conicGradient(frame);
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.stroke();

      // INNER CLEAR
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(CX, CY, R - THICK * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      requestAnimationFrame(draw);
    }

    draw();
  }, []);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >

      {/* OUTER GLOW */}
      {glow && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: size * 1.35,
            height: size * 1.35,
            filter: "blur(48px)",
            opacity: 0.7,
            background:
              "conic-gradient(from 0deg, #6BFFFF, #45E5FF, #7300FF, #FF00C8, #6BFFFF)",
            mask: "radial-gradient(circle, transparent 58%, black 75%)",
            WebkitMask: "radial-gradient(circle, transparent 58%, black 75%)",
          }}
        ></div>
      )}

      {/* INNER BLOOM */}
      {bloom && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: size * 0.9,
            height: size * 0.9,
            filter: "blur(32px)",
            opacity: 0.35,
            background:
              "radial-gradient(circle, rgba(255,0,200,0.18), rgba(80,0,120,0.08), transparent 70%)",
          }}
        ></div>
      )}

      {/* CANVAS */}
      <canvas ref={canvasRef} className="relative z-10" />
    </div>
  );
}