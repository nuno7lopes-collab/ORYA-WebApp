"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { Avatar } from "@/components/ui/avatar";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import { cn } from "@/lib/utils";
import { INTEREST_OPTIONS } from "@/lib/interests";
import InterestIcon from "@/app/components/interests/InterestIcon";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SuggestedPerson = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  mutualsCount: number;
  isFollowing: boolean;
};

export default function RedePage() {
  const { user, isLoggedIn } = useUser();
  const { openModal: openAuthModal, isOpen: isAuthOpen } = useAuthModal();
  const { data } = useSWR(
    isLoggedIn ? "/api/social/suggestions?limit=12" : null,
    fetcher,
  );
  const [people, setPeople] = useState<SuggestedPerson[]>([]);
  const [followPending, setFollowPending] = useState<Record<string, boolean>>({});
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    if (data?.items) {
      setPeople(data.items as SuggestedPerson[]);
    }
  }, [data?.items]);

  const peopleSameEvent = useMemo(() => people.slice(0, 6), [people]);
  const peopleCommonFollowers = useMemo(() => people.slice(0, 6), [people]);
  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const setFollowPendingFlag = (key: string, value: boolean) => {
    setFollowPending((prev) => ({ ...prev, [key]: value }));
  };

  const toggleUserFollow = async (targetId: string, next: boolean) => {
    if (!isLoggedIn) {
      if (!isAuthOpen) {
        openAuthModal({ mode: "login", redirectTo: "/rede", showGoogle: true });
      }
      return;
    }

    const key = `user_${targetId}`;
    setFollowPendingFlag(key, true);
    setPeople((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, isFollowing: next } : item,
      ),
    );

    try {
      const res = await fetch(next ? "/api/social/follow" : "/api/social/unfollow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      if (!res.ok) {
        setPeople((prev) =>
          prev.map((item) =>
            item.id === targetId ? { ...item, isFollowing: !next } : item,
          ),
        );
      }
    } catch {
      setPeople((prev) =>
        prev.map((item) =>
          item.id === targetId ? { ...item, isFollowing: !next } : item,
        ),
      );
    } finally {
      setFollowPendingFlag(key, false);
    }
  };

  return (
    <main className="min-h-screen text-white pb-24">
      <MobileTopBar />
      <section className="orya-page-width px-4 md:px-8 py-6 space-y-6">
        <div className="space-y-2">
          <p className="orya-mobile-kicker">Rede</p>
          <h1 className="text-[20px] font-semibold text-white">A tua rede ORYA</h1>
          <p className="text-[12px] text-white/60">
            Liga-te a pessoas que estiveram nos mesmos eventos e têm interesses em comum.
          </p>
        </div>

        {!isLoggedIn && (
          <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/70">
            <p>Entra para veres a tua rede.</p>
            <button
              type="button"
              onClick={() => {
                if (!isAuthOpen) {
                  openAuthModal({ mode: "login", redirectTo: "/rede", showGoogle: true });
                }
              }}
              className="btn-orya mt-3 inline-flex text-[11px] font-semibold"
            >
              Entrar
            </button>
          </div>
        )}

        {isLoggedIn && (
          <>
            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-[16px] font-semibold text-white">Pessoas do mesmo evento</p>
                <p className="text-[11px] text-white/60">Baseado nos teus eventos recentes.</p>
              </div>
              {peopleSameEvent.length === 0 ? (
                <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                  Sem pessoas para sugerir.
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {peopleSameEvent.map((person) => {
                    const label = person.fullName || person.username || "Utilizador ORYA";
                    const pending = followPending[`user_${person.id}`] === true;
                    return (
                      <div
                        key={person.id}
                        className="min-w-[150px] orya-mobile-surface-soft p-3 space-y-3"
                      >
                        <Avatar
                          src={person.avatarUrl}
                          name={label}
                          className="h-14 w-14 border border-white/12"
                          textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                          fallbackText="OR"
                        />
                        <div className="space-y-1">
                          <p className="text-[13px] font-semibold text-white line-clamp-1">{label}</p>
                          <p className="text-[10px] text-white/60 line-clamp-1">
                            Evento recente
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleUserFollow(person.id, !person.isFollowing)}
                          disabled={pending}
                          className={cn(
                            "w-full rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                            person.isFollowing
                              ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                              : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15",
                            pending && "opacity-60",
                          )}
                        >
                          {pending ? "..." : person.isFollowing ? "A seguir" : "Seguir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-[16px] font-semibold text-white">Interesses</p>
                <p className="text-[11px] text-white/60">Seleciona interesses para encontrares pessoas.</p>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {INTEREST_OPTIONS.map((interest) => {
                  const active = selectedInterests.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      aria-pressed={active}
                      className={cn(
                        "group flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-[10px] font-semibold transition",
                        active
                          ? "border-[#6BFFFF]/40 bg-[#6BFFFF]/10 text-white shadow-[0_0_18px_rgba(107,255,255,0.25)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5",
                          active && "border-[#6BFFFF]/40 bg-[#6BFFFF]/15",
                        )}
                      >
                        <InterestIcon
                          id={interest.id}
                          className={cn("h-4 w-4", active ? "text-white" : "text-white/70")}
                        />
                      </span>
                      <span className="text-[10px] text-white/70">{interest.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-[16px] font-semibold text-white">Seguidores em comum</p>
                <p className="text-[11px] text-white/60">Pessoas que seguem o mesmo que tu.</p>
              </div>
              {peopleCommonFollowers.length === 0 ? (
                <div className="orya-mobile-surface-soft p-4 text-[12px] text-white/60">
                  Sem recomendações por agora.
                </div>
              ) : (
                <div className="space-y-3">
                  {peopleCommonFollowers.map((person) => {
                    const label = person.fullName || person.username || "Utilizador ORYA";
                    const pending = followPending[`user_${person.id}`] === true;
                    const mutualLabel =
                      person.mutualsCount > 0
                        ? `${person.mutualsCount} seguidores em comum`
                        : "Sem seguidores em comum";
                    return (
                      <div
                        key={person.id}
                        className="orya-mobile-surface-soft flex items-center justify-between gap-3 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={person.avatarUrl}
                            name={label}
                            className="h-12 w-12 border border-white/12"
                            textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                            fallbackText="OR"
                          />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-white line-clamp-1">{label}</p>
                            <p className="text-[10px] text-white/60 line-clamp-1">{mutualLabel}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleUserFollow(person.id, !person.isFollowing)}
                          disabled={pending}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                            person.isFollowing
                              ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                              : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/15",
                            pending && "opacity-60",
                          )}
                        >
                          {pending ? "..." : person.isFollowing ? "A seguir" : "Seguir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
