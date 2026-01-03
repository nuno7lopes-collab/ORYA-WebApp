"use client";

import { useState, useTransition } from "react";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";

type OrganizationFollowClientProps = {
  organizationId: number;
  initialIsFollowing: boolean;
  onChange?: (next: boolean) => void;
};

export default function OrganizationFollowClient({
  organizationId,
  initialIsFollowing,
  onChange,
}: OrganizationFollowClientProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();

  const toggleFollow = () => {
    const next = !isFollowing;
    setIsFollowing(next);
    onChange?.(next);
    startTransition(async () => {
      try {
        const res = await fetch(next ? "/api/social/follow-organization" : "/api/social/unfollow-organization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
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
