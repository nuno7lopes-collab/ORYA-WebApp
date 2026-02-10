"use client";

import { useState } from "react";

type HomeHeroMediaProps = {
  videoSrc?: string | null;
};

export default function HomeHeroMedia({ videoSrc }: HomeHeroMediaProps) {
  const [videoOk, setVideoOk] = useState(Boolean(videoSrc));

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-white">
      {videoOk && videoSrc ? (
        <video
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoOk(false)}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
