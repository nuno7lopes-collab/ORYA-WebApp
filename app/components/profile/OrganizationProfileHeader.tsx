"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
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

type SocialIconLinkProps = {
  href: string;
  ariaLabel: string;
  tooltipText: string;
  className: string;
  external?: boolean;
  children: ReactNode;
};

function compactTooltipText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 84) return compact;
  return `${compact.slice(0, 81).trimEnd()}...`;
}

function decodeUrlValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveRedirectLabel(href: string, fallback?: string | null) {
  const fallbackLabel = fallback?.trim() ?? "";
  const normalizedHref = href.trim();
  if (!normalizedHref) return compactTooltipText(fallbackLabel || "destino externo");

  if (normalizedHref.toLowerCase().startsWith("mailto:")) {
    const email = normalizedHref.replace(/^mailto:/i, "").trim();
    return compactTooltipText(email || fallbackLabel || "email");
  }

  try {
    const url = new URL(normalizedHref);
    const queryHint = url.searchParams.get("query") ?? url.searchParams.get("q");
    if (queryHint) {
      const decodedQuery = decodeUrlValue(queryHint.replace(/\+/g, " "));
      if (decodedQuery.trim()) return compactTooltipText(decodedQuery);
    }
    const host = url.hostname.replace(/^www\./i, "");
    const path = decodeUrlValue(url.pathname).replace(/\/$/, "");
    const destination = `${host}${path}${url.search}${url.hash}`.trim();
    return compactTooltipText(destination || host || fallbackLabel || normalizedHref);
  } catch {
    return compactTooltipText(fallbackLabel || normalizedHref);
  }
}

function SocialIconLink({
  href,
  ariaLabel,
  tooltipText,
  className,
  external = true,
  children,
}: SocialIconLinkProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimer = () => {
    if (!hoverTimerRef.current) return;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  };

  useEffect(() => {
    return () => clearHoverTimer();
  }, []);

  const showTooltipWithDelay = () => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      setTooltipVisible(true);
    }, 1000);
  };

  const showTooltipImmediately = () => {
    clearHoverTimer();
    setTooltipVisible(true);
  };

  const hideTooltip = () => {
    clearHoverTimer();
    setTooltipVisible(false);
  };

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={className}
      aria-label={ariaLabel}
      onMouseEnter={showTooltipWithDelay}
      onMouseLeave={hideTooltip}
      onFocus={showTooltipImmediately}
      onBlur={hideTooltip}
      onTouchStart={hideTooltip}
    >
      {children}
      <span
        className={`pointer-events-none absolute bottom-[calc(100%+0.6rem)] left-1/2 z-30 w-max max-w-[17.75rem] -translate-x-1/2 rounded-md border border-white/15 bg-[#060913]/95 px-2.5 py-1.5 text-center text-[11px] leading-tight text-white/90 shadow-[0_14px_34px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-150 ${
          tooltipVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        {tooltipText}
      </span>
    </a>
  );
}

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
    "group relative inline-flex h-10 w-10 items-center justify-center rounded-full border text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition duration-200 hover:-translate-y-[1px] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050913]";
  const iconGlyphClass = "h-[18px] w-[18px]";
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
        <SocialIconLink
          href={instagramHref}
          className={`${iconBaseClass} border-[#f7d078]/80 bg-[linear-gradient(135deg,#f9ce34_0%,#ee2a7b_45%,#6228d7_100%)] text-white shadow-[0_10px_24px_rgba(214,51,132,0.48)] hover:shadow-[0_14px_30px_rgba(214,51,132,0.56)]`}
          ariaLabel="Instagram"
          tooltipText={`Vai para: ${resolveRedirectLabel(instagramHref)}`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`${iconGlyphClass} scale-[0.9]`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5" />
            <circle cx="12" cy="12" r="3.9" />
            <circle cx="17.2" cy="6.8" r="1.05" fill="currentColor" stroke="none" />
          </svg>
        </SocialIconLink>
      )}
      {youtubeHref && (
        <SocialIconLink
          href={youtubeHref}
          className={`${iconBaseClass} border-[#ffc1c1]/75 bg-[#ff0033] text-white shadow-[0_10px_24px_rgba(255,0,51,0.45)] hover:shadow-[0_14px_30px_rgba(255,0,51,0.55)]`}
          ariaLabel="YouTube"
          tooltipText={`Vai para: ${resolveRedirectLabel(youtubeHref)}`}
        >
          <svg
            viewBox="0 0 24 24"
            className={iconGlyphClass}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="6.5" width="17" height="11" rx="4.2" />
            <path
              d="m10 9.5 5 2.5-5 2.5Z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </SocialIconLink>
      )}
      {tiktokHref && (
        <SocialIconLink
          href={tiktokHref}
          className={`${iconBaseClass} border-white/55 bg-[#101014] text-white shadow-[0_10px_24px_rgba(0,0,0,0.52)] hover:shadow-[0_14px_30px_rgba(0,0,0,0.62)]`}
          ariaLabel="TikTok"
          tooltipText={`Vai para: ${resolveRedirectLabel(tiktokHref)}`}
        >
          <svg viewBox="0 0 24 24" className={iconGlyphClass} aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.6 4.2c.63 1.4 1.62 2.26 3.05 2.55V9.2c-1.08-.03-2.14-.35-3.05-.95v5.37a4.9 4.9 0 1 1-4.87-4.93c.34 0 .67.03 1 .1v2.47a2.34 2.34 0 1 0 1.33 2.1V4.2h2.48Z"
            />
          </svg>
        </SocialIconLink>
      )}
      {linkedinHref && (
        <SocialIconLink
          href={linkedinHref}
          className={`${iconBaseClass} border-[#b8dcff]/75 bg-[#0A66C2] text-white shadow-[0_10px_24px_rgba(10,102,194,0.45)] hover:shadow-[0_14px_30px_rgba(10,102,194,0.55)]`}
          ariaLabel="LinkedIn"
          tooltipText={`Vai para: ${resolveRedirectLabel(linkedinHref)}`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`${iconGlyphClass} scale-[0.9]`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4.1" y="4.1" width="15.8" height="15.8" rx="3.4" />
            <path
              fill="currentColor"
              d="M8.2 9.8a1.15 1.15 0 1 0 0-2.3a1.15 1.15 0 0 0 0 2.3Zm1.1 8.7V11.2H7.1v7.3h2.2Zm1.7-7.3h2.1v1.05h.03c.28-.53.97-1.2 2.22-1.2c2.37 0 2.8 1.56 2.8 3.59v3.74h-2.2v-3.3c0-.78-.02-1.8-1.1-1.8s-1.27.86-1.27 1.74v3.36H11v-7.18Z"
              stroke="none"
            />
          </svg>
        </SocialIconLink>
      )}
      {websiteHref && (
        <SocialIconLink
          href={websiteHref}
          className={`${iconBaseClass} border-[#c8f0ff]/75 bg-[#4cc9f0] text-[#05334a] shadow-[0_10px_24px_rgba(76,201,240,0.46)] hover:shadow-[0_14px_30px_rgba(76,201,240,0.56)]`}
          ariaLabel="Website"
          tooltipText={`Vai para: ${resolveRedirectLabel(websiteHref)}`}
        >
          <svg
            viewBox="0 0 24 24"
            className={iconGlyphClass}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="8.6" />
            <path d="M3.8 12h16.4" />
            <path d="M12 3.4c2.3 2.05 3.6 5.08 3.6 8.6c0 3.52-1.3 6.55-3.6 8.6c-2.3-2.05-3.6-5.08-3.6-8.6c0-3.52 1.3-6.55 3.6-8.6Z" />
          </svg>
        </SocialIconLink>
      )}
      {addressMapHref && addressLabel && (
        <SocialIconLink
          href={addressMapHref}
          className={`${iconBaseClass} border-[#c0ffe6]/75 bg-[#18b97c] text-[#07351f] shadow-[0_10px_24px_rgba(24,185,124,0.45)] hover:shadow-[0_14px_30px_rgba(24,185,124,0.55)]`}
          ariaLabel="Abrir morada no mapa"
          tooltipText={`Vai para: ${resolveRedirectLabel(addressMapHref, addressLabel)}`}
        >
          <svg
            viewBox="0 0 24 24"
            className={iconGlyphClass}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M12 20.9s-5.9-4.45-5.9-10a5.9 5.9 0 1 1 11.8 0c0 5.55-5.9 10-5.9 10Z"
            />
            <circle cx="12" cy="10.9" r="2.15" />
          </svg>
        </SocialIconLink>
      )}
      {mailtoHref && (
        <SocialIconLink
          href={mailtoHref}
          className={`${iconBaseClass} border-[#d2e6ff]/75 bg-[#67b0ff] text-[#082e58] shadow-[0_10px_24px_rgba(103,176,255,0.45)] hover:shadow-[0_14px_30px_rgba(103,176,255,0.55)]`}
          ariaLabel="Email"
          tooltipText={`Vai para: ${resolveRedirectLabel(mailtoHref, contactEmail)}`}
          external={false}
        >
          <svg
            viewBox="0 0 24 24"
            className={`${iconGlyphClass} scale-[0.9]`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M4.1 7.5a2.4 2.4 0 0 1 2.4-2.4h11a2.4 2.4 0 0 1 2.4 2.4v9a2.4 2.4 0 0 1-2.4 2.4h-11a2.4 2.4 0 0 1-2.4-2.4v-9Z"
            />
            <path d="m5.5 7.9 6.02 4.18a.8.8 0 0 0 .96 0l6.02-4.18" />
          </svg>
        </SocialIconLink>
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
      className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32"
      style={{
        width: "clamp(5.8rem, 10.8vw, 9rem)",
        height: "clamp(5.8rem, 10.8vw, 9rem)",
        minWidth: "5.8rem",
        minHeight: "5.8rem",
      }}
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
