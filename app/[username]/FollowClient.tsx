"use client";

import { useEffect, useState, useTransition } from "react";
import { CTA_PRIMARY } from "@/app/org/_shared/dashboardUi";
import { cn } from "@/lib/utils";

type Props = {
  targetUserId: string;
  initialIsFollowing: boolean;
  onChange?: (next: boolean) => void;
  onMutualChange?: (next: boolean) => void;
};

type FollowState = "following" | "requested" | "none";

export default function FollowClient({ targetUserId, initialIsFollowing, onChange, onMutualChange }: Props) {
  const [status, setStatus] = useState<FollowState>(initialIsFollowing ? "following" : "none");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFollower, setIsFollower] = useState(false);
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
          const nextPrivate = json.targetVisibility === "PRIVATE";
          setIsPrivate(Boolean(nextPrivate));
          setIsFollower(Boolean(json.isFollower));
          onMutualChange?.(Boolean(json.isMutual));
          if (json.isFollowing) {
            setStatus("following");
          } else if (json.requestPending && nextPrivate) {
            setStatus("requested");
          } else {
            setStatus("none");
            onMutualChange?.(false);
          }
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
  }, [targetUserId, onMutualChange]);

  const toggleFollow = async () => {
    if (status === "following") {
      setStatus("none");
    } else if (status === "requested") {
      setStatus("none");
    } else {
      setStatus(isPrivate ? "requested" : "following");
    }
    startTransition(async () => {
      try {
        if (status === "following") {
          const res = await fetch("/api/social/unfollow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.ok) {
            setStatus("following");
          } else {
            onChange?.(false);
            onMutualChange?.(false);
          }
          return;
        }
        if (status === "requested") {
          const res = await fetch("/api/social/follow-requests/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.ok) {
            setStatus("requested");
          }
          return;
        }

        const res = await fetch("/api/social/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setStatus("none");
          return;
        }
        if (json.status === "REQUESTED") {
          setStatus("requested");
          onMutualChange?.(false);
          return;
        }
        if (json.status === "FOLLOWING") {
          setStatus("following");
          onChange?.(true);
          onMutualChange?.(isFollower);
        }
      } catch {
        if (status === "following") {
          setStatus("following");
        } else if (status === "requested") {
          setStatus("requested");
        } else {
          setStatus("none");
        }
      }
    });
  };

  const label =
    status === "following"
      ? "A seguir"
      : status === "requested"
        ? "Pedido enviado"
        : isPrivate
          ? "Pedir para seguir"
          : "Seguir";

  return (
    <button
      type="button"
      disabled={fetching || isPending}
      onClick={toggleFollow}
      className={cn(
        "disabled:opacity-60",
        status !== "none"
          ? "inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[12px] font-semibold text-white/65 transition hover:bg-white/12"
          : cn(CTA_PRIMARY, "px-4 py-2 text-[12px]"),
      )}
    >
      {label}
    </button>
  );
}
