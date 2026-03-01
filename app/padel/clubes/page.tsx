import Link from "next/link";
import { headers } from "next/headers";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

type ClubItem = {
  id: number;
  name: string;
  shortName: string;
  city: string | null;
  address: string | null;
  courtsCount: number;
  organizationUsername: string | null;
  courts: Array<{ id: number; name: string; indoor: boolean; surface: string | null }>;
};

function resolveRequestOrigin(hdrs: Awaited<ReturnType<typeof headers>>) {
  const forwardedHost = hdrs.get("x-forwarded-host");
  const host = (forwardedHost ?? hdrs.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return getAppBaseUrl();
  const forwardedProto = hdrs.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchClubs() {
  const hdrs = await headers();
  const origin = resolveRequestOrigin(hdrs);
  const res = await fetch(`${origin}/api/padel/public/clubs?includeCourts=1&limit=24`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; items?: ClubItem[] } | null;
  if (!res.ok || !data?.ok) return [];
  return data.items ?? [];
}

export default async function PadelClubsPage() {
  const items = await fetchClubs();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <section className="orya-page-width px-6 pb-8 pt-12 md:px-10">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050810]/90 p-6 shadow-[0_24px_65px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Clubes</p>
          <h1 className="mt-2 text-3xl font-semibold">Clubes de padel ativos</h1>
          <p className="mt-2 text-sm text-white/70">
            Explora clubes públicos, courts disponíveis e liga-te à comunidade local.
          </p>
          <Link
            href="/padel"
            className="mt-4 inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
          >
            Voltar ao Padel Hub
          </Link>
        </div>
      </section>

      <section className="orya-page-width px-6 pb-16 md:px-10">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
            Sem clubes públicos disponíveis neste momento.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((club) => {
              const href = club.organizationUsername ? `/${club.organizationUsername}` : null;
              const content = (
                <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.4)]">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Clube</p>
                  <h2 className="mt-1 text-xl font-semibold">{club.shortName || club.name}</h2>
                  <p className="text-xs text-white/65">
                    {club.city || "Portugal"} · {club.courtsCount} courts
                  </p>
                  <p className="mt-1 text-xs text-white/55">{club.address || "Morada a anunciar"}</p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(club.courts ?? []).slice(0, 4).map((court) => (
                      <div
                        key={court.id}
                        className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[11px] text-white/75"
                      >
                        <p className="font-semibold text-white/90">{court.name}</p>
                        <p className="text-[10px] text-white/55">
                          {court.indoor ? "Indoor" : "Outdoor"}
                          {court.surface ? ` · ${court.surface}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );

              return href ? (
                <Link key={club.id} href={href} className="block transition hover:-translate-y-[2px]">
                  {content}
                </Link>
              ) : (
                <div key={club.id}>{content}</div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
