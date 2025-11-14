// app/u/[username]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PublicProfile = {
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  favourite_categories: string[] | null;
};

type PublicEvent = {
  id: string;
  title: string;
  city: string | null;
  start_at: string | null;
};

export default function PublicProfilePage() {
  const params = useParams() as { username: string };
  const router = useRouter();
  const username = params.username;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/profile/public?username=${encodeURIComponent(username)}`
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          setErrorMsg(json.error || "Perfil não encontrado.");
          return;
        }

        setProfile(json.profile);
        setEvents(json.events || []);
      } catch (err) {
        console.error(err);
        setErrorMsg("Erro a carregar o perfil público.");
      } finally {
        setLoading(false);
      }
    }

    if (username) load();
  }, [username]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#02030a] text-white flex items-center justify-center">
        <p className="text-white/60">A carregar perfil...</p>
      </main>
    );
  }

  if (errorMsg || !profile) {
    return (
      <main className="min-h-screen bg-[#02030a] text-white flex items-center justify-center px-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl px-6 py-5 max-w-md text-center">
          <p className="text-white mb-3 font-semibold">
            Este perfil não está disponível.
          </p>
          <p className="text-white/60 text-sm mb-4">{errorMsg}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium"
          >
            Voltar à ORYA
          </button>
        </div>
      </main>
    );
  }

  const displayName =
    profile.full_name || profile.username || profile.username;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#02030a] via-[#050316] to-black text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/40 mb-1">
              Perfil público
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">
              {displayName} <span className="text-white/40">/ ORYA</span>
            </h1>
            {profile.username && (
              <p className="text-white/50 text-sm mt-1">
                @{profile.username}
              </p>
            )}
          </div>

          {/* Botão Juntar (por enquanto só manda para login) */}
          <button
            className="px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] shadow-[0_0_16px_rgba(22,70,245,0.5)]"
            onClick={() => router.push("/login")}
          >
            Juntar-me
          </button>
        </div>

        {/* Card principal */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-[#1646F5]/20 p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl bg-[radial-gradient(circle_at_top,_#FF00C8_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#6BFFFF_0,_transparent_55%)]" />

          <div className="relative flex gap-6">
            {/* Avatar */}
            <div className="shrink-0">
              <div className="w-24 h-24 rounded-full border-2 border-[#6BFFFF] bg-black/60 overflow-hidden flex items-center justify-center text-3xl font-bold">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-2">
              <p className="text-white/70 text-sm">
                {profile.bio || "Este utilizador ainda não escreveu uma bio."}
              </p>

              <div className="flex flex-wrap gap-3 text-xs mt-2">
                {profile.city && (
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">
                    📍 {profile.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interesses */}
          {profile.favourite_categories &&
          profile.favourite_categories.length > 0 ? (
            <div className="relative mt-6">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50 mb-3">
                INTERESSES
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.favourite_categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 rounded-full bg-white/8 border border-white/15 text-xs text-white/80"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Eventos públicos */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-3">
            Eventos públicos onde vai
          </h2>

          {events.length === 0 ? (
            <p className="text-white/40 text-sm">
              Este utilizador ainda não tem eventos públicos.
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-sm">{ev.title}</p>
                    <p className="text-xs text-white/50">
                      {ev.city || "Local a anunciar"}{" "}
                      {ev.start_at
                        ? `• ${new Date(ev.start_at).toLocaleString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}
                    </p>
                  </div>
                  <button className="text-xs px-3 py-1 rounded-full bg-white text-black font-medium">
                    Ver evento
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}