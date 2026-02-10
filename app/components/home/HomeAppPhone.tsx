"use client";

import { useState } from "react";

type HomeAppPhoneProps = {
  videoSrc?: string | null;
  posterSrc?: string | null;
};

export default function HomeAppPhone({ videoSrc, posterSrc }: HomeAppPhoneProps) {
  const [videoOk, setVideoOk] = useState(Boolean(videoSrc));

  return (
    <div className="relative mx-auto w-full max-w-[260px] lg:max-w-[280px]">
      <div
        className="relative rounded-[36px] border border-white/12 bg-[#0f141a] p-3 shadow-[0_30px_70px_rgba(0,0,0,0.55)]"
        style={{ aspectRatio: "9 / 16" }}
      >
        <div className="absolute left-1/2 top-3 h-3.5 w-16 -translate-x-1/2 rounded-full border border-white/10 bg-black/60" />
        <div className="absolute inset-2 rounded-[30px] border border-white/8 bg-[#0b1014] overflow-hidden">
          {videoOk && videoSrc ? (
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              poster={posterSrc ?? undefined}
              onError={() => setVideoOk(false)}
            >
              <source src={videoSrc} type="video/mp4" />
            </video>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#111720,#0b1014)]">
              <div className="rounded-full border border-white/20 bg-white/5 p-4 text-white/70">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
        <div className="absolute inset-x-8 bottom-4 h-9 rounded-full border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}
