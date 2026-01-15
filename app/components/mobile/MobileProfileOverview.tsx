"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import FollowClient from "@/app/[username]/FollowClient";
import { FilterChip } from "@/app/components/mobile/MobileFilters";
import InterestIcon from "@/app/components/interests/InterestIcon";
import { normalizeInterestSelection, resolveInterestLabel } from "@/lib/interests";
import { EventListCard } from "@/app/components/mobile/MobileCards";
import { getEventCoverUrl } from "@/lib/eventCover";

type RecentEvent = {
  id: string;
  title: string;
  venueName: string | null;
  coverUrl: string | null;
  startAt: string | null;
  isUpcoming: boolean;
  slug: string | null;
};

type MobileProfileOverviewProps = {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | number | null;
  coverUrl?: string | null;
  city?: string | null;
  isOwner: boolean;
  targetUserId?: string | null;
  initialIsFollowing?: boolean;
  followersCount?: number | null;
  followingCount?: number | null;
  eventsCount?: number | null;
  interests?: string[];
  recentEvents?: RecentEvent[];
};

function formatDateLabel(value?: string | null) {
  if (!value) return "Data a anunciar";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
  return parsed.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export default function MobileProfileOverview({
  name,
  username,
  avatarUrl,
  avatarUpdatedAt,
  coverUrl,
  city,
  isOwner,
  targetUserId,
  initialIsFollowing,
  followersCount,
  followingCount,
  eventsCount,
  interests,
  recentEvents,
}: MobileProfileOverviewProps) {
  const [isFollowListOpen, setIsFollowListOpen] = useState(false);
  const [activeList, setActiveList] = useState<"followers" | "following">("followers");
  const [listLoading, setListLoading] = useState(false);
  const [listItems, setListItems] = useState<
    Array<{ userId: string; username: string | null; fullName: string | null; avatarUrl: string | null }>
  >([]);
  const followers = followersCount ?? 0;
  const following = followingCount ?? 0;
  const interestsList = normalizeInterestSelection(interests ?? []);
  const interestsTotal = interestsList.length;
  const eventTotal = eventsCount ?? 0;

  const fetchList = async (mode: "followers" | "following") => {
    if (!targetUserId) return [];
    const res = await fetch(`/api/social/${mode}?userId=${targetUserId}&limit=50`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !Array.isArray(json.items)) return [];
    return json.items as Array<{ userId: string; username: string | null; fullName: string | null; avatarUrl: string | null }>;
  };

  const openList = async (mode: "followers" | "following") => {
    if (!targetUserId) return;
    setActiveList(mode);
    setIsFollowListOpen(true);
    setListLoading(true);
    try {
      setListItems(await fetchList(mode));
    } catch {
      setListItems([]);
    } finally {
      setListLoading(false);
    }
  };

  const upcoming = useMemo(
    () => (recentEvents ?? []).filter((item) => item.isUpcoming).slice(0, 3),
    [recentEvents],
  );
  const past = useMemo(
    () => (recentEvents ?? []).filter((item) => !item.isUpcoming).slice(0, 3),
    [recentEvents],
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="relative orya-profile-cover overflow-hidden rounded-b-[28px] border-b border-white/10">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt="Cover"
              fill
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full orya-profile-cover-fallback" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/90" />
        </div>
        <div className="absolute left-1/2 bottom-[-40px] -translate-x-1/2">
          <div className="rounded-full p-[3px] bg-[linear-gradient(135deg,var(--orya-neon-pink),var(--orya-neon-cyan))] shadow-[0_0_26px_rgba(107,255,255,0.25),0_0_26px_rgba(255,0,200,0.18)]">
            <Avatar
              src={avatarUrl}
              name={name}
              version={avatarUpdatedAt ?? undefined}
              className="h-20 w-20 border border-white/10"
              textClassName="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/80"
              fallbackText="OR"
            />
          </div>
        </div>
      </div>

      <div className="mt-14 flex flex-col items-center text-center space-y-2">
        <h1 className="text-[20px] font-semibold text-white">{name}</h1>
        {username && <p className="text-[12px] text-white/60">@{username}</p>}
        {city && <p className="text-[11px] text-white/55">{city}</p>}
      </div>

      <div className="flex items-center justify-center gap-3">
        {isOwner ? (
          <Link
            href="/me/settings"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold text-white/80"
          >
            Editar perfil
          </Link>
        ) : targetUserId ? (
          <>
            <FollowClient targetUserId={targetUserId} initialIsFollowing={Boolean(initialIsFollowing)} />
            <button
              type="button"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold text-white/70"
              disabled
            >
              Mensagem
            </button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        <button
          type="button"
          onClick={() => openList("followers")}
          className="rounded-2xl border border-white/12 bg-white/5 py-3 text-center"
        >
          <p className="text-[15px] font-semibold text-white">{followers}</p>
          <p className="text-[10px] text-white/60">Seguidores</p>
        </button>
        <button
          type="button"
          onClick={() => openList("following")}
          className="rounded-2xl border border-white/12 bg-white/5 py-3 text-center"
        >
          <p className="text-[15px] font-semibold text-white">{following}</p>
          <p className="text-[10px] text-white/60">A seguir</p>
        </button>
        <div className="rounded-2xl border border-white/12 bg-white/5 py-3 text-center">
          <p className="text-[15px] font-semibold text-white">{eventTotal}</p>
          <p className="text-[10px] text-white/60">Eventos</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/5 py-3 text-center">
          <p className="text-[15px] font-semibold text-white">{interestsTotal}</p>
          <p className="text-[10px] text-white/60">Interesses</p>
        </div>
      </div>

      <section className="space-y-3 px-4">
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-white">Interesses</p>
          <p className="text-[11px] text-white/60">O que te inspira.</p>
        </div>
        {interestsList.length === 0 ? (
          <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60 space-y-3">
            <p>Interesses por definir.</p>
            {isOwner && (
              <Link
                href="/me/settings"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/80"
              >
                Adicionar interesses
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {interestsList.map((interest) => (
              <FilterChip
                key={interest}
                label={resolveInterestLabel(interest) ?? interest}
                icon={<InterestIcon id={interest} className="h-3 w-3" />}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 px-4">
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-white">Eventos seguintes</p>
          <p className="text-[11px] text-white/60">Agenda a curto prazo.</p>
        </div>
        {upcoming.length === 0 ? (
          <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
            Sem eventos marcados.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((event) => {
              const cover = getEventCoverUrl(event.coverUrl, {
                seed: event.id,
                width: 600,
                quality: 70,
                format: "webp",
                square: true,
              });
              const href = event.slug ? `/eventos/${event.slug}` : "/eventos";
              return (
                <EventListCard
                  key={event.id}
                  href={href}
                  imageUrl={cover}
                  title={event.title}
                  subtitle={event.venueName}
                  dateLabel={formatDateLabel(event.startAt)}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 px-4">
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-white">Eventos passados</p>
          <p className="text-[11px] text-white/60">Momentos recentes.</p>
        </div>
        {past.length === 0 ? (
          <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
            Sem eventos anteriores.
          </div>
        ) : (
          <div className="space-y-3">
            {past.map((event) => {
              const cover = getEventCoverUrl(event.coverUrl, {
                seed: event.id,
                width: 600,
                quality: 70,
                format: "webp",
                square: true,
              });
              const href = event.slug ? `/eventos/${event.slug}` : "/eventos";
              return (
                <EventListCard
                  key={event.id}
                  href={href}
                  imageUrl={cover}
                  title={event.title}
                  subtitle={event.venueName}
                  dateLabel={formatDateLabel(event.startAt)}
                />
              );
            })}
          </div>
        )}
      </section>

      {isFollowListOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[#0b0f18] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-white">
                {activeList === "followers" ? "Seguidores" : "A seguir"}
              </p>
              <button
                type="button"
                onClick={() => setIsFollowListOpen(false)}
                className="text-[11px] text-white/60 hover:text-white"
              >
                Fechar
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              {[
                { value: "followers", label: "Seguidores", count: followers },
                { value: "following", label: "A seguir", count: following },
              ].map((tab) => {
                const isActive = activeList === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      void openList(tab.value as "followers" | "following");
                    }}
                    className={`flex-1 rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                      isActive ? "bg-white/15 text-white" : "text-white/60 hover:text-white/80"
                    }`}
                  >
                    {tab.label} · {tab.count}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              {listLoading ? (
                <div className="space-y-2">
                  <div className="h-12 rounded-xl orya-skeleton-surface animate-pulse" />
                  <div className="h-12 rounded-xl orya-skeleton-surface animate-pulse" />
                </div>
              ) : listItems.length === 0 ? (
                <p className="text-[12px] text-white/70">
                  {activeList === "followers"
                    ? "Sem seguidores por agora."
                    : "Ainda não segues ninguém."}
                </p>
              ) : (
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {listItems.map((item) => (
                    <Link
                      key={item.userId}
                      href={item.username ? `/${item.username}` : "/me"}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2 hover:border-white/20 hover:bg-white/8 transition-colors"
                      onClick={() => setIsFollowListOpen(false)}
                    >
                      <Avatar
                        src={item.avatarUrl}
                        name={item.fullName || item.username || "Utilizador ORYA"}
                        className="h-10 w-10 border border-white/12"
                        textClassName="text-[11px] font-semibold uppercase text-white/80"
                        fallbackText="OR"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {item.fullName || item.username || "Utilizador ORYA"}
                        </p>
                        {item.username && (
                          <p className="text-[11px] text-white/65 truncate">@{item.username}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
