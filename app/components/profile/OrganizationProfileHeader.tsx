"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import Link from "next/link";
import OrganizationFollowClient from "@/app/components/profile/OrganizationFollowClient";
import ProfileHeaderLayout, { ProfileStatPill } from "@/app/components/profile/ProfileHeaderLayout";
import { Avatar } from "@/components/ui/avatar";
import { buildOrgHref } from "@/lib/organizationIdUtils";

type OrganizationProfileHeaderProps = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  addressLabel?: string | null;
  addressMapHref?: string | null;
  linkedOrganizations?: Array<{
    id: number;
    username: string;
    name: string;
    avatarUrl?: string | null;
  }>;
  followersCount?: number | null;
  organizationId: number;
  initialIsFollowing?: boolean;
  canEdit?: boolean;
  isPublic?: boolean;
  isVerified?: boolean;
  instagramHref?: string | null;
  youtubeHref?: string | null;
  tiktokHref?: string | null;
  linkedinHref?: string | null;
  websiteHref?: string | null;
  contactEmail?: string | null;
};

type OrganizationFollowerItem = {
  userId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

function GroupOrganizationsChips({
  organizations,
  popoverOpen,
  onTogglePopover,
  onClosePopover,
  containerRef,
}: {
  organizations: Array<{
    id: number;
    username: string;
    name: string;
    avatarUrl?: string | null;
  }>;
  popoverOpen: boolean;
  onTogglePopover: () => void;
  onClosePopover: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const visible = useMemo(() => organizations.slice(0, 3), [organizations]);
  const hidden = useMemo(() => organizations.slice(3), [organizations]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {visible.map((organization) => (
          <Link
            key={`group-chip-${organization.id}`}
            href={`/${organization.username}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[11px] text-white/85 transition hover:border-white/30 hover:bg-white/12"
          >
            <Avatar
              src={organization.avatarUrl ?? null}
              name={organization.name}
              className="h-4 w-4"
              textClassName="text-[6px] tracking-[0.06em] text-white/80"
            />
            @{organization.username}
          </Link>
        ))}
        {hidden.length > 0 ? (
          <button
            type="button"
            onClick={onTogglePopover}
            className="inline-flex items-center rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white/80 transition hover:border-white/35 hover:text-white"
            aria-expanded={popoverOpen}
            aria-label={`Mostrar mais ${hidden.length} organizações associadas`}
          >
            +{hidden.length}
          </button>
        ) : null}
      </div>
      {hidden.length > 0 && popoverOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(22rem,92vw)] rounded-2xl border border-white/15 bg-[rgba(7,10,18,0.96)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl"
        >
          <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-white/55">Outras organizações do grupo</p>
          <div className="max-h-64 space-y-1 overflow-auto pr-1">
            {hidden.map((organization) => (
              <Link
                key={`group-popover-${organization.id}`}
                href={`/${organization.username}`}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-2 transition hover:border-white/25 hover:bg-white/8"
                onClick={onClosePopover}
              >
                <Avatar
                  src={organization.avatarUrl ?? null}
                  name={organization.name}
                  className="h-8 w-8"
                  textClassName="text-[9px] tracking-[0.12em] text-white/80"
                />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-white">{organization.name}</p>
                  <p className="truncate text-[11px] text-white/65">@{organization.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OrganizationProfileHeader({
  name,
  username,
  avatarUrl,
  coverUrl,
  bio,
  addressLabel,
  addressMapHref,
  linkedOrganizations = [],
  followersCount,
  organizationId,
  initialIsFollowing = false,
  canEdit,
  isPublic = true,
  instagramHref,
  youtubeHref,
  tiktokHref,
  linkedinHref,
  websiteHref,
  contactEmail,
}: OrganizationProfileHeaderProps) {
  const displayName = name?.trim() || "Organização ORYA";
  const handle = username?.trim() || null;
  const [followersDisplay, setFollowersDisplay] = useState(followersCount ?? 0);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listItems, setListItems] = useState<OrganizationFollowerItem[]>([]);
  const [linkedPopoverOpen, setLinkedPopoverOpen] = useState(false);
  const linkedPopoverContainerRef = useRef<HTMLDivElement | null>(null);
  const mailtoHref = contactEmail ? `mailto:${contactEmail}` : null;
  const iconBaseClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/8 text-white/85 transition hover:border-white/40 hover:bg-white/12";
  const editProfileHref = buildOrgHref(organizationId, "/settings");

  useEffect(() => {
    setAvatar(avatarUrl);
  }, [avatarUrl]);

  useEffect(() => {
    if (!linkedPopoverOpen) return;
    const handler = (event: MouseEvent) => {
      if (!linkedPopoverContainerRef.current) return;
      if (!linkedPopoverContainerRef.current.contains(event.target as Node)) {
        setLinkedPopoverOpen(false);
      }
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLinkedPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [linkedPopoverOpen]);

  const handleAvatarError = () => {
    if (!avatar) return;
    setAvatar(null);
  };

  const fetchFollowers = async () => {
    const res = await fetch(`/api/social/organization-followers?organizationId=${organizationId}&limit=50`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !Array.isArray(json.items)) return [];
    return json.items as OrganizationFollowerItem[];
  };

  const openFollowersModal = () => {
    if (!isPublic) return;
    setIsListModalOpen(true);
    setListLoading(true);
    fetchFollowers()
      .then((items) => setListItems(items))
      .catch(() => setListItems([]))
      .finally(() => setListLoading(false));
  };

  const statsSlot = (
    <>
      <ProfileStatPill
        label="Seguidores"
        value={followersDisplay ?? "—"}
        onClick={isPublic ? openFollowersModal : undefined}
      />
    </>
  );

  const orgBadge = (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100 shadow-[0_6px_18px_rgba(217,164,60,0.28)]">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-200" aria-hidden="true" />
      Organização
    </span>
  );

  const titleSlot = (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-[22px] sm:text-3xl font-semibold tracking-tight text-white truncate">
        {displayName}
      </h1>
      {orgBadge}
    </div>
  );

  const metaSlot = handle ? (
    <div className="space-y-2 text-[12px] text-white/80">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white">
          @{handle}
        </span>
      </div>
      {linkedOrganizations.length > 0 ? (
        <GroupOrganizationsChips
          organizations={linkedOrganizations}
          popoverOpen={linkedPopoverOpen}
          onTogglePopover={() => setLinkedPopoverOpen((prev) => !prev)}
          onClosePopover={() => setLinkedPopoverOpen(false)}
          containerRef={linkedPopoverContainerRef}
        />
      ) : null}
    </div>
  ) : null;

  const bioSlot = (
    <p className="max-w-xl text-sm text-white/85 leading-relaxed">
      {bio?.trim() || "Sem bio."}
    </p>
  );

  const linksSlot = (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/75">
      {instagramHref && (
        <a
          href={instagramHref}
          target="_blank"
          rel="noreferrer"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[1.5px] shadow-[0_10px_24px_rgba(238,42,123,0.25)]"
          aria-label="Instagram"
        >
          <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-[#0b0f1d] text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm0 2a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7Zm5 3.2a4.8 4.8 0 1 1 0 9.6a4.8 4.8 0 0 1 0-9.6Zm0 2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 0 0 0-5.6Zm5.3-1.6a1.1 1.1 0 1 1-2.2 0a1.1 1.1 0 0 1 2.2 0Z"
              />
            </svg>
          </span>
        </a>
      )}
      {youtubeHref && (
        <a
          href={youtubeHref}
          target="_blank"
          rel="noreferrer"
          className={`${iconBaseClass} border-red-400/45 bg-red-500/15 text-red-100`}
          aria-label="YouTube"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9A28.3 28.3 0 0 0 2 12a28.3 28.3 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28.3 28.3 0 0 0 22 12a28.3 28.3 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"
            />
          </svg>
        </a>
      )}
      {tiktokHref && (
        <a
          href={tiktokHref}
          target="_blank"
          rel="noreferrer"
          className={`${iconBaseClass} border-white/35 bg-white/14 text-white`}
          aria-label="TikTok"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.8 4.5c.6 1.1 1.5 1.8 2.8 2V9a7 7 0 0 1-2.8-.8v6.2a4.7 4.7 0 1 1-4.6-4.7c.3 0 .6 0 .9.1v2.5a2.1 2.1 0 1 0 1.2 2V4.5h2.5Z"
            />
          </svg>
        </a>
      )}
      {linkedinHref && (
        <a
          href={linkedinHref}
          target="_blank"
          rel="noreferrer"
          className={`${iconBaseClass} border-blue-300/45 bg-blue-500/14 text-blue-100`}
          aria-label="LinkedIn"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6.3 8.1a1.5 1.5 0 1 1 0-3a1.5 1.5 0 0 1 0 3ZM4.9 9.4h2.8V19H4.9V9.4Zm4.5 0H12v1.3h.1c.4-.8 1.4-1.6 2.8-1.6c3 0 3.6 2 3.6 4.5V19h-2.9v-4.9c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6V19H9.4V9.4Z"
            />
          </svg>
        </a>
      )}
      {websiteHref && (
        <a
          href={websiteHref}
          target="_blank"
          rel="noreferrer"
          className={`${iconBaseClass} border-sky-300/45 bg-sky-400/15 text-sky-100`}
          aria-label="Website"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm6.7 7h-3.1a15.2 15.2 0 0 0-1.2-4A7.2 7.2 0 0 1 18.7 10Zm-6.7-5c.7 1 1.4 2.6 1.8 5H10.2c.4-2.4 1.1-4 1.8-5Zm-2.4.3A15.2 15.2 0 0 0 8.4 10H5.3a7.2 7.2 0 0 1 4.3-4.7Zm-4.3 6.7h3.1a16.7 16.7 0 0 0 0 4H5.3a7.2 7.2 0 0 1 0-4Zm4.3 6.7A7.2 7.2 0 0 1 5.3 14h3.1c.3 1.6.7 3 1.2 4.7Zm2.4.3c-.7-1-1.4-2.6-1.8-5h3.6c-.4 2.4-1.1 4-1.8 5Zm2.4-.3c.5-1.6.9-3 1.2-4.7h3.1a7.2 7.2 0 0 1-4.3 4.7Zm1.4-6.7H10.2a15.4 15.4 0 0 1 0-4h3.6a15.4 15.4 0 0 1 0 4Z"
            />
          </svg>
        </a>
      )}
      {addressMapHref && addressLabel && (
        <a
          href={addressMapHref}
          target="_blank"
          rel="noreferrer"
          className={`${iconBaseClass} border-emerald-300/45 bg-emerald-400/14 text-emerald-100`}
          aria-label="Abrir morada no mapa"
          title={addressLabel}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M4 10.5L12 4l8 6.5V20H4V10.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M9.5 20v-5.3c0-.66.54-1.2 1.2-1.2h2.6c.66 0 1.2.54 1.2 1.2V20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
      {mailtoHref && (
        <a href={mailtoHref} className={iconBaseClass} aria-label="Email">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="m5.5 7.8l6.1 4.2c.24.16.56.16.8 0l6.1-4.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
      {!isPublic && (
        <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] text-white/75">
          Perfil privado
        </span>
      )}
    </div>
  );

  const actionsSlot = canEdit ? (
    <Link
      href={editProfileHref}
      className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/12"
    >
      Editar perfil
    </Link>
  ) : (
    <OrganizationFollowClient
      organizationId={organizationId}
      initialIsFollowing={initialIsFollowing}
      onChange={(next) => {
        setFollowersDisplay((prev) => Math.max(0, (prev ?? 0) + (next ? 1 : -1)));
      }}
    />
  );

  const avatarSlot = (
    <Avatar
      src={avatar}
      name={displayName}
      className="h-[clamp(5.8rem,10.8vw,9rem)] w-[clamp(5.8rem,10.8vw,9rem)]"
      textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
      onError={handleAvatarError}
    />
  );

  return (
    <>
      <ProfileHeaderLayout
        coverUrl={coverUrl}
        avatarSlot={avatarSlot}
        statsSlot={statsSlot}
        titleSlot={titleSlot}
        metaSlot={metaSlot}
        bioSlot={bioSlot}
        linksSlot={linksSlot}
        actionsSlot={actionsSlot}
      />
      {isListModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsListModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[rgba(8,10,18,0.92)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Seguidores</h3>
              <button
                onClick={() => setIsListModalOpen(false)}
                className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/15"
              >
                Fechar
              </button>
            </div>
            {listLoading ? (
              <div className="space-y-2">
                <div className="h-12 rounded-xl orya-skeleton-surface animate-pulse" />
                <div className="h-12 rounded-xl orya-skeleton-surface animate-pulse" />
              </div>
            ) : listItems.length === 0 ? (
              <p className="text-[12px] text-white/70">Sem seguidores por agora.</p>
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {listItems.map((item) => {
                  const handle = item.username || item.userId;
                  return (
                    <Link
                      key={item.userId}
                      href={item.username ? `/${item.username}` : `/me`}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2 transition-colors hover:border-white/20 hover:bg-white/8"
                      onClick={() => setIsListModalOpen(false)}
                    >
                      <Avatar
                        src={item.avatarUrl}
                        name={item.fullName || item.username || handle}
                        className="h-10 w-10 border border-white/12"
                        textClassName="text-[11px] font-semibold uppercase text-white/80"
                        fallbackText="OR"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {item.fullName || item.username || "Utilizador ORYA"}
                        </p>
                        {item.username && (
                          <p className="truncate text-[11px] text-white/65">@{item.username}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
