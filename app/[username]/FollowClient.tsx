"use client";

import { useEffect, useState, useTransition } from "react";

type Props = {
  targetUserId: string;
  initialIsFollowing: boolean;
  onChange?: (next: boolean) => void;
};

export default function FollowClient({ targetUserId, initialIsFollowing, onChange }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [fetching, setFetching] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setFetching(true);
      try {
        const res = await fetch(`/api/social/follow-status?userId=${targetUserId}`);
        const json = await res.json();
        if (mounted && res.ok && json?.ok) {
          setIsFollowing(Boolean(json.isFollowing));
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setFetching(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [targetUserId]);

  const toggleFollow = async () => {
    const next = !isFollowing;
    setIsFollowing(next);
    onChange?.(next);
    startTransition(async () => {
      try {
        const res = await fetch(next ? "/api/social/follow" : "/api/social/unfollow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        const json = await res.json();
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
      disabled={fetching || isPending}
      onClick={toggleFollow}
      className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold transition ${
        isFollowing
          ? "border border-white/25 bg-white/10 text-white/80 hover:bg-white/15"
          : "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow-[0_0_18px_rgba(107,255,255,0.35)] hover:scale-[1.02]"
      } disabled:opacity-60`}
    >
      {isFollowing ? "A seguir" : "Seguir"}
    </button>
  );
}
