"use client";

import { useEffect, useRef } from "react";

 export default function OryaLogo({ small = false }) {
  return (
    <div
      className={`relative flex items-center justify-center ${
        small ? "w-10 h-10" : "w-40 h-40"
      }`}
    >
      {/* Canvas do anel */}
      <canvas
        id={small ? "oryaLogoSmall" : "oryaLogoBig"}
        className="absolute inset-0"
      />

      {/* Texto ORYA */}
      <span
        className={`font-bold tracking-tight bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#FF00C8] bg-clip-text text-transparent ${
          small ? "text-sm" : "text-4xl"
        }`}
      >
        ORYA
      </span>
    </div>
  );
}