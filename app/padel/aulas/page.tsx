import Link from "next/link";
import { headers } from "next/headers";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

type PadelServiceItem = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  categoryLabel: string | null;
  addressFormatted: string | null;
  organization: {
    publicName: string | null;
    businessName: string | null;
    username: string | null;
  };
  instructor: {
    fullName: string | null;
    username: string | null;
  } | null;
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

function formatPrice(cents: number, currency: string) {
  if (!cents) return "Grátis";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

async function fetchLessons() {
  const hdrs = await headers();
  const origin = resolveRequestOrigin(hdrs);
  const res = await fetch(`${origin}/api/padel/public/services?kind=CLASS&limit=24`, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    items?: PadelServiceItem[];
  } | null;
  if (!res.ok || !data?.ok) return [];
  return data.items ?? [];
}

export default async function PadelLessonsPage() {
  const items = await fetchLessons();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <section className="orya-page-width px-6 pb-8 pt-12 md:px-10">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050810]/90 p-6 shadow-[0_24px_65px_rgba(0,0,0,0.55)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Aulas</p>
          <h1 className="mt-2 text-3xl font-semibold">Aulas de padel com treinador</h1>
          <p className="mt-2 text-sm text-white/70">
            Marca sessões técnicas e acelera evolução de jogo com oferta local.
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
            Sem aulas públicas disponíveis neste momento.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const organizationName =
                item.organization.publicName || item.organization.businessName || "Organização";
              const href = item.organization.username
                ? `/${item.organization.username}?serviceId=${item.id}`
                : `/servicos/${item.id}`;
              return (
                <Link
                  key={item.id}
                  href={href}
                  className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.4)] transition hover:-translate-y-[2px] hover:border-white/20"
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Aula</p>
                  <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
                  <p className="text-xs text-white/65">{organizationName}</p>
                  {item.description ? (
                    <p className="mt-2 text-xs text-white/70 line-clamp-2">{item.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-white/75">
                    <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
                      {item.durationMinutes} min
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
                      {formatPrice(item.unitPriceCents, item.currency)}
                    </span>
                    {item.categoryLabel ? (
                      <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5">
                        {item.categoryLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[11px] text-white/60">
                    {item.instructor?.fullName || item.instructor?.username || "Treinador a confirmar"}
                  </p>
                  <p className="mt-1 text-[11px] text-white/55">
                    {item.addressFormatted || "Local a anunciar"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
