"use client";

import { useEffect, useState, useTransition } from "react";
import { CTA_PRIMARY } from "@/app/organizador/dashboardUi";
import { cn } from "@/lib/utils";

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
      className={cn(
        "disabled:opacity-60",
        isFollowing
          ? "inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[12px] font-semibold text-white/65 transition hover:bg-white/12"
          : cn(CTA_PRIMARY, "px-4 py-2 text-[12px]"),
      )}
    >
      {isFollowing ? "A seguir" : "Seguir"}
    </button>
  );
}
