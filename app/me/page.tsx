// app/me/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutBtn from "../components/LogoutBtn";

type OryaUser = {
  id: string;
  email: string;
  created_at?: string;
};

type OryaProfile = {
  username?: string | null;
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  mode?: string | null;
  favourite_categories?: string[] | null;
  instagram?: string | null;
  tiktok?: string | null;
};

export default function MePage() {
  const [user, setUser] = useState<OryaUser | null>(null);
  const [profile, setProfile] = useState<OryaProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const json = await res.json();

        if (!json.success) {
          setError(json.error || "Erro ao carregar o perfil.");
          return;
        }

        const profileFromApi = json.profile;
        const authFromApi = json.user || {};
        setUser({
          id: profileFromApi.id,
          email: authFromApi.email,
          created_at: authFromApi.created_at,
        });

        setProfile(json.profile || null);
      } catch (err) {
        console.error(err);
        setError("Erro a carregar os dados.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#02030a] text-white flex items-center justify-center">
        <p className="text-white/60">A carregar a tua conta...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#02030a] text-white flex items-center justify-center">
        <div className="bg-white/5 border border-red-500/40 rounded-2xl px-6 py-4">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium"
          >
            Ir para login
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#02030a] text-white flex items-center justify-center">
        <p className="text-white/60">Sem dados de utilizador.</p>
      </main>
    );
  }

  const displayName =
    profile?.full_name || profile?.username || user.email.split("@")[0];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#02030a] via-[#050316] to-black text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">
            A tua conta <span className="text-white/40">/ ORYA</span>
          </h1>
          <button
            onClick={() => router.push("/me/edit")}
            className="px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
          >
            Editar perfil
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          {/* Card principal */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-[#1646F5]/20 p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.7)]">
            <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl bg-[radial-gradient(circle_at_top,_#FF00C8_0,_transparent_60%),_radial-gradient(circle_at_bottom,_#6BFFFF_0,_transparent_55%)]" />

            <div className="relative flex gap-6">
              {/* Avatar */}
              <div className="shrink-0">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-2 border-[#6BFFFF] bg-black/60 overflow-hidden flex items-center justify-center text-3xl font-bold">
                    {profile?.avatar_url ? (
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
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#00ffba] flex items-center justify-center text-[10px] font-bold text-black shadow-lg">
                    ●
                  </div>
                </div>
              </div>

              {/* Texto principal */}
              <div className="flex-1 space-y-1">
                <h2 className="text-2xl md:text-3xl font-bold">{displayName}</h2>
                {profile?.username && (
                  <p className="text-white/60 text-sm">@{profile.username}</p>
                )}
                <p className="text-white/70 text-sm mt-2">
                  {profile?.bio || "Ainda não escreveste uma bio."}
                </p>

                <div className="flex flex-wrap gap-3 mt-4 text-xs">
                  {profile?.city && (
                    <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">
                      📍 {profile.city}
                    </span>
                  )}
                  {profile?.mode && (
                    <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">
                      🎭 {profile.mode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Interesses */}
            {profile?.favourite_categories?.length ? (
              <div className="relative mt-6">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50 mb-3">
                  INTERESSES PRINCIPAIS
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.favourite_categories.map((cat: string) => (
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

          {/* Card lateral */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col gap-4">
            <h2 className="text-xl font-semibold mb-1">Sessão</h2>
            <p className="text-white/60 text-sm">
              Estás autenticado na ORYA com:
            </p>
            <p className="text-sm font-mono bg-black/40 border border-white/10 rounded-xl px-3 py-2 break-all">
              {user.email}
            </p>

            {user.created_at && (
              <p className="text-xs text-white/40">
                Conta criada em{" "}
                {new Date(user.created_at).toLocaleString("pt-PT")}
              </p>
            )}

            <div className="mt-4">
              <LogoutBtn />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}