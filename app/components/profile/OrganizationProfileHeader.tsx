"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OrganizerFollowClient from "@/app/components/profile/OrganizerFollowClient";
import ProfileHeaderLayout, {
  ProfileStatPill,
  ProfileVerifiedBadge,
} from "@/app/components/profile/ProfileHeaderLayout";
import { Avatar } from "@/components/ui/avatar";

type OrganizationProfileHeaderProps = {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  city: string | null;
  followersCount?: number | null;
  followingCount?: number | null;
  organizerId: number;
  initialIsFollowing?: boolean;
  canEdit?: boolean;
  isPublic?: boolean;
  isVerified?: boolean;
  instagramHref?: string | null;
  youtubeHref?: string | null;
  websiteHref?: string | null;
  contactEmail?: string | null;
};

export default function OrganizationProfileHeader({
  name,
  username,
  avatarUrl,
  coverUrl,
  bio,
  city,
  followersCount,
  followingCount,
  organizerId,
  initialIsFollowing = false,
  canEdit,
  isPublic = true,
  isVerified = false,
  instagramHref,
  youtubeHref,
  websiteHref,
  contactEmail,
}: OrganizationProfileHeaderProps) {
  const displayName = name?.trim() || "Organização ORYA";
  const handle = username?.trim() || null;
  const [followersDisplay, setFollowersDisplay] = useState(followersCount ?? 0);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const mailtoHref = contactEmail ? `mailto:${contactEmail}` : null;
  const iconBaseClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/8 text-white/85 transition hover:border-white/40 hover:bg-white/12";

  useEffect(() => {
    setAvatar(avatarUrl);
  }, [avatarUrl]);

  const handleAvatarError = () => {
    if (!avatar) return;
    setAvatar(null);
  };

  const statsSlot = (
    <>
      <ProfileStatPill label="Seguidores" value={followersDisplay ?? "—"} />
      <ProfileStatPill label="A seguir" value={followingCount ?? 0} />
    </>
  );

  const titleSlot = (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-[22px] sm:text-3xl font-semibold tracking-tight text-white truncate">
        {displayName}
      </h1>
      {isVerified && <ProfileVerifiedBadge />}
    </div>
  );

  const metaSlot = (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/80">
      {handle && (
        <span className="rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white">
          @{handle}
        </span>
      )}
      {city && <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">{city}</span>}
    </div>
  );

  const bioSlot = (
    <p className="max-w-xl text-sm text-white/85 leading-relaxed">
      {bio?.trim() || "Sem bio no momento."}
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
      href="/organizador#perfil-publico"
      className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/12"
    >
      Editar perfil
    </Link>
  ) : (
    <OrganizerFollowClient
      organizerId={organizerId}
      initialIsFollowing={initialIsFollowing}
      onChange={(next) => {
        setFollowersDisplay((prev) => Math.max(0, (prev ?? 0) + (next ? 1 : -1)));
      }}
    />
  );

  const avatarSlot = (
    <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] p-[2px] shadow-[0_0_24px_rgba(255,0,200,0.26)] sm:h-28 sm:w-28">
      <Avatar
        src={avatar}
        name={displayName}
        className="h-full w-full"
        textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
        onError={handleAvatarError}
      />
    </div>
  );

  return (
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
  );
}
