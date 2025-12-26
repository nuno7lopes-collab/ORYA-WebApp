"use client";

import { useState, useTransition } from "react";

type OrganizerFollowClientProps = {
  organizerId: number;
  initialIsFollowing: boolean;
  onChange?: (next: boolean) => void;
};

export default function OrganizerFollowClient({
  organizerId,
  initialIsFollowing,
  onChange,
}: OrganizerFollowClientProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();

  const toggleFollow = () => {
    const next = !isFollowing;
    setIsFollowing(next);
    onChange?.(next);
    startTransition(async () => {
      try {
        const res = await fetch(next ? "/api/social/follow-organizer" : "/api/social/unfollow-organizer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizerId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setIsFollowing(!next);
          onChange?.(!next);
        }
      } catch {
        setIsFollowing(!next);
        onChange?.(!next);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={isPending}
      className={`inline-flex items-center rounded-full px-4 py-2 text-[12px] font-semibold transition ${
        isFollowing
          ? "border border-white/20 bg-white/8 text-white/65 hover:bg-white/12"
          : "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow-[0_0_22px_rgba(107,255,255,0.45)] hover:scale-[1.02]"
      } disabled:opacity-60`}
    >
      {isFollowing ? "A seguir" : "Seguir"}
    </button>
  );
}
