"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import ProfileSectionTransition from "@/app/[username]/_components/ProfileSectionTransition";

type ProfileSectionNavItem = {
  id: string;
  label: string;
  href: string;
};

type ProfileSectionPayload = {
  id: string;
  content: ReactNode;
};

type ProfileSectionsShellProps = {
  navItems: ProfileSectionNavItem[];
  defaultSectionId: string;
  serverSection: ProfileSectionPayload | null;
  emptyContent: ReactNode;
};

function upsertSectionCache(cache: ProfileSectionPayload[], section: ProfileSectionPayload): ProfileSectionPayload[] {
  const existingIndex = cache.findIndex((entry) => entry.id === section.id);
  if (existingIndex === -1) return [...cache, section];
  const next = [...cache];
  next[existingIndex] = section;
  return next;
}

function resolveSectionFromUrl(defaultSectionId: string, validSectionIds: Set<string>): string {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("sec");
  if (requested && validSectionIds.has(requested)) return requested;
  return defaultSectionId;
}

export default function ProfileSectionsShell({
  navItems,
  defaultSectionId,
  serverSection,
  emptyContent,
}: ProfileSectionsShellProps) {
  const [activeSectionId, setActiveSectionId] = useState<string>(serverSection?.id ?? defaultSectionId);
  const [cache, setCache] = useState<ProfileSectionPayload[]>(() => (serverSection ? [serverSection] : []));

  const validSectionIds = useMemo(() => new Set(navItems.map((item) => item.id)), [navItems]);
  const cachedSectionIds = useMemo(() => new Set(cache.map((item) => item.id)), [cache]);

  useEffect(() => {
    if (!serverSection) return;
    setCache((prev) => upsertSectionCache(prev, serverSection));
    setActiveSectionId(serverSection.id);
  }, [serverSection]);

  useEffect(() => {
    setCache((prev) => {
      const filtered = prev.filter((entry) => validSectionIds.has(entry.id));
      return filtered.length === prev.length ? prev : filtered;
    });
    setActiveSectionId((current) =>
      validSectionIds.has(current) ? current : (serverSection?.id ?? defaultSectionId),
    );
  }, [defaultSectionId, serverSection?.id, validSectionIds]);

  useEffect(() => {
    const handlePopState = () => {
      const resolvedSectionId = resolveSectionFromUrl(defaultSectionId, validSectionIds);
      if (cachedSectionIds.has(resolvedSectionId)) {
        setActiveSectionId(resolvedSectionId);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [cachedSectionIds, defaultSectionId, validSectionIds]);

  const activeSectionContent = useMemo(() => {
    const cached = cache.find((entry) => entry.id === activeSectionId);
    if (cached) return cached.content;
    if (serverSection) return serverSection.content;
    return emptyContent;
  }, [activeSectionId, cache, emptyContent, serverSection]);

  const handleTabClick = (event: MouseEvent<HTMLAnchorElement>, item: ProfileSectionNavItem) => {
    if (!cachedSectionIds.has(item.id)) return;

    event.preventDefault();
    setActiveSectionId(item.id);

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === item.href) return;
    window.history.pushState(window.history.state, "", item.href);
  };

  return (
    <>
      {navItems.length >= 2 ? (
        <nav className="overflow-x-auto border-b border-white/12">
          <div className="flex min-w-max items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.id === activeSectionId;
              return (
                <Link
                  key={`profile-nav-${item.id}`}
                  href={item.href}
                  scroll={false}
                  prefetch
                  onClick={(event) => handleTabClick(event, item)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative rounded-t-xl px-4 py-3 text-[12px] font-semibold transition ${
                    isActive ? "text-white" : "text-white/78 hover:text-white"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full transition ${
                      isActive ? "bg-white" : "bg-transparent"
                    }`}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      <ProfileSectionTransition sectionId={activeSectionId}>{activeSectionContent}</ProfileSectionTransition>
    </>
  );
}
