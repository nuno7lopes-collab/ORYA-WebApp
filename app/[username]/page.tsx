import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ProfileHeader from "@/app/components/profile/ProfileHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

async function getViewerId() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

function formatDate(date?: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type OrganizationCategory = "EVENTOS" | "PADEL" | "VOLUNTARIADO";

const CATEGORY_META: Record<
  OrganizationCategory,
  { label: string; cta: string; noun: string; nounPlural: string }
> = {
  EVENTOS: {
    label: "Eventos",
    cta: "Ver eventos",
    noun: "evento",
    nounPlural: "eventos",
  },
  PADEL: {
    label: "PADEL",
    cta: "Ver torneios",
    noun: "torneio",
    nounPlural: "torneios",
  },
  VOLUNTARIADO: {
    label: "Voluntariado",
    cta: "Participar",
    noun: "ação",
    nounPlural: "ações",
  },
};

const CATEGORY_TEMPLATE: Record<OrganizationCategory, "PADEL" | "VOLUNTEERING" | null> = {
  EVENTOS: null,
  PADEL: "PADEL",
  VOLUNTARIADO: "VOLUNTEERING",
};

const UPDATE_CATEGORY_LABELS: Record<string, string> = {
  TODAY: "Hoje",
  CHANGES: "Alterações",
  RESULTS: "Resultados",
  CALL_UPS: "Convocatórias",
};

function formatEventDateRange(start: Date | null, end: Date | null, timezone: string) {
  if (!start) return "Data a definir";
  const optsDay: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
  };
  const optsTime: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const dayStr = new Intl.DateTimeFormat("pt-PT", { ...optsDay, timeZone: timezone }).format(start);
  const startTimeStr = new Intl.DateTimeFormat("pt-PT", { ...optsTime, timeZone: timezone }).format(start);
  const endTimeStr = end
    ? new Intl.DateTimeFormat("pt-PT", { ...optsTime, timeZone: timezone }).format(end)
    : null;
  return `${dayStr} · ${startTimeStr}${endTimeStr ? ` – ${endTimeStr}` : ""}`;
}

function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "OR";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function UserProfilePage({ params }: PageProps) {
  const resolvedParams = await params;
  const usernameParam = resolvedParams?.username;

  if (!usernameParam || usernameParam.toLowerCase() === "me") {
    redirect("/me");
  }

  const [viewerId, profile, organizerProfileRaw] = await Promise.all([
    getViewerId(),
    prisma.profile.findUnique({
      where: { username: usernameParam },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        city: true,
        visibility: true,
        createdAt: true,
      },
    }),
    prisma.organizer.findFirst({
      where: { username: usernameParam, status: "ACTIVE" },
      select: {
        id: true,
        username: true,
        publicName: true,
        businessName: true,
        city: true,
        organizationCategory: true,
        brandingAvatarUrl: true,
        officialEmail: true,
        publicListingEnabled: true,
        status: true,
        publicWebsite: true,
        publicDescription: true,
        publicHours: true,
        infoRules: true,
        infoFaq: true,
        infoRequirements: true,
        infoPolicies: true,
        infoLocationNotes: true,
        address: true,
        showAddressPublicly: true,
      },
    }),
  ]);

  const organizerProfile =
    organizerProfileRaw && organizerProfileRaw.publicListingEnabled !== false ? organizerProfileRaw : null;

  if (!profile?.username && !organizerProfile) {
    notFound();
  }

  if (!profile?.username && organizerProfile) {
    const now = new Date();
    const organizationCategory =
      (organizerProfile.organizationCategory as OrganizationCategory | null) ?? "EVENTOS";
    const categoryMeta = CATEGORY_META[organizationCategory];
    const categoryTemplate = CATEGORY_TEMPLATE[organizationCategory];
    const orgDisplayName =
      organizerProfile.publicName?.trim() ||
      organizerProfile.businessName?.trim() ||
      "Organização ORYA";
    const orgInitials = initialsFromName(orgDisplayName);
    const contactEmail = organizerProfile.officialEmail?.trim() || null;
    const publicWebsite = organizerProfile.publicWebsite?.trim() || null;
    const publicWebsiteHref = publicWebsite
      ? (() => {
          const normalized = /^https?:\/\//i.test(publicWebsite)
            ? publicWebsite
            : `https://${publicWebsite}`;
          try {
            new URL(normalized);
            return normalized;
          } catch {
            return null;
          }
        })()
      : null;
    const publicWebsiteLabel = publicWebsiteHref
      ? publicWebsiteHref.replace(/^https?:\/\//i, "").replace(/\/$/, "")
      : "A definir";
    const publicHours = organizerProfile.publicHours?.trim() || null;
    const publicDescription = organizerProfile.publicDescription?.trim() || null;
    const showAddress = organizerProfile.showAddressPublicly && organizerProfile.address;

    const events = await prisma.event.findMany({
      where: {
        organizerId: organizerProfile.id,
        status: "PUBLISHED",
        isDeleted: false,
        type: "ORGANIZER_EVENT",
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        endsAt: true,
        locationName: true,
        locationCity: true,
        address: true,
        isFree: true,
        timezone: true,
        templateType: true,
        coverImageUrl: true,
        ticketTypes: { select: { price: true } },
      },
    });

    const updates = await prisma.organizationUpdate.findMany({
      where: { organizerId: organizerProfile.id, status: "PUBLISHED" },
      include: {
        event: { select: { slug: true, title: true } },
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
    });

    const formattedUpdates = updates.map((update) => ({
      ...update,
      dateLabel: formatDate(update.publishedAt ?? update.createdAt),
      categoryLabel: UPDATE_CATEGORY_LABELS[update.category] ?? update.category,
    }));

    const categoryEvents = categoryTemplate
      ? events.filter(
          (event) =>
            event.templateType === categoryTemplate ||
            event.templateType === null ||
            event.templateType === "OTHER",
        )
      : events;
    const upcomingEvents = categoryEvents.filter(
      (event) => event.startsAt && event.startsAt >= now,
    );
    const pastEvents = categoryEvents.filter((event) => event.startsAt && event.startsAt < now);
    const nextEvent = upcomingEvents[0] ?? null;

    const padelPlayersCount =
      organizationCategory === "PADEL"
        ? await prisma.padelPlayerProfile.count({ where: { organizerId: organizerProfile.id } })
        : 0;

    const padelTopPlayers =
      organizationCategory === "PADEL"
        ? await prisma.padelPlayerProfile.findMany({
            where: { organizerId: organizerProfile.id, isActive: true },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
              id: true,
              displayName: true,
              fullName: true,
              level: true,
              gender: true,
            },
          })
        : [];

    const highlights = [
      {
        label: `Próximo ${categoryMeta.noun}`,
        value: nextEvent ? formatDate(nextEvent.startsAt) : "Por anunciar",
        hint: nextEvent ? nextEvent.title : `Sem ${categoryMeta.nounPlural} publicados`,
      },
      {
        label: `${categoryMeta.nounPlural} publicados`,
        value: categoryEvents.length,
        hint: categoryEvents.length ? "Ativos no perfil público" : "Começa pela primeira publicação",
      },
      organizationCategory === "PADEL"
        ? {
            label: "Jogadores registados",
            value: padelPlayersCount,
            hint: padelPlayersCount ? "Perfis ativos em competição" : "Ainda sem atletas",
          }
        : {
            label: "Histórico recente",
            value: pastEvents.length,
            hint: pastEvents.length ? "Eventos concluídos" : "Sem histórico",
      },
    ];

    const infoBlocks = [
      { key: "rules", title: "Regras", body: organizerProfile.infoRules },
      { key: "faq", title: "FAQ", body: organizerProfile.infoFaq },
      { key: "requirements", title: "Requisitos", body: organizerProfile.infoRequirements },
      { key: "policies", title: "Políticas", body: organizerProfile.infoPolicies },
      { key: "location", title: "Chegar lá", body: organizerProfile.infoLocationNotes },
    ].filter((block) => block.body && block.body.trim().length > 0);

    const ctaHref = nextEvent ? `/eventos/${nextEvent.slug}` : "#agenda";
    const ctaLabel = nextEvent ? categoryMeta.cta : "Ver agenda";

    return (
      <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
        </div>

        <section className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
          <header className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#050914]/85 to-[#05070f]/95 p-6 shadow-[0_26px_80px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-tr from-[#FF00C8]/60 via-[#6BFFFF]/40 to-[#1646F5]/60 p-[1px]">
                    <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-black/80 text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                      {organizerProfile.brandingAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={organizerProfile.brandingAvatarUrl}
                          alt={orgDisplayName}
                          className="h-full w-full rounded-[14px] object-cover"
                        />
                      ) : (
                        orgInitials
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
                      {categoryMeta.label}
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold text-white">{orgDisplayName}</h1>
                    <p className="text-sm text-white/60">
                      @{organizerProfile.username ?? usernameParam}
                      {organizerProfile.city ? ` · ${organizerProfile.city}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/65">
                  {nextEvent ? (
                    <>
                      <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">
                        Próximo: {formatEventDateRange(nextEvent.startsAt, nextEvent.endsAt, nextEvent.timezone)}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">
                        {nextEvent.locationCity || nextEvent.locationName}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">
                      Agenda em preparação
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start gap-2">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_25px_rgba(107,255,255,0.35)] transition hover:brightness-110"
                >
                  {ctaLabel}
                </Link>
                <span className="text-[11px] text-white/55">
                  {nextEvent ? "Segue para o destaque principal" : "Agenda a atualizar"}
                </span>
              </div>
            </div>
          </header>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Destaques</p>
                <h2 className="text-xl font-semibold text-white">O essencial agora</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0a1122]/80 to-[#05070f]/90 p-4 text-sm shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-[12px] text-white/60">{item.hint}</p>
              </div>
            ))}
            </div>
          </section>

          <section id="agenda" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
                  {categoryMeta.nounPlural}
                </p>
                <h2 className="text-xl font-semibold text-white">Agenda pública</h2>
              </div>
              <Link href={ctaHref} className="text-sm text-white/60 hover:text-white">
                {categoryMeta.cta}
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                Ainda não existem {categoryMeta.nounPlural} publicados. Assim que houver datas confirmadas, aparecem aqui.
              </div>
            ) : (
              <div className="grid gap-3">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <Link
                    key={event.id}
                    href={`/eventos/${event.slug}`}
                    className="group rounded-2xl border border-white/12 bg-white/5 p-4 text-sm transition hover:border-white/30 hover:bg-white/10"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">
                          {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}
                        </p>
                        <p className="text-base font-semibold text-white">{event.title}</p>
                        <p className="text-[12px] text-white/60">
                          {event.locationName}
                          {event.locationCity ? ` · ${event.locationCity}` : ""}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] text-white/70 transition group-hover:border-white/40 group-hover:text-white">
                        Ver detalhe →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Canal oficial</p>
              <h2 className="text-xl font-semibold text-white">Atualizações da organização</h2>
            </div>
            {formattedUpdates.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                Sem atualizações oficiais por agora. As novidades aparecem sempre aqui primeiro.
              </div>
            ) : (
              <div className="grid gap-3">
                {formattedUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                          {update.categoryLabel}
                          {update.isPinned ? " · Fixado" : ""}
                        </p>
                        <h3 className="text-base font-semibold text-white">{update.title}</h3>
                        {update.event?.slug && (
                          <Link
                            href={`/eventos/${update.event.slug}`}
                            className="text-[12px] text-white/60 hover:text-white"
                          >
                            Evento: {update.event.title}
                          </Link>
                        )}
                      </div>
                      <span className="text-[11px] text-white/55">{update.dateLabel}</span>
                    </div>
                    {update.body && (
                      <p className="mt-2 text-[12px] text-white/70 whitespace-pre-line">
                        {update.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {organizationCategory === "PADEL" && (
            <section className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Centro de competição</p>
                <h2 className="text-xl font-semibold text-white">PADEL oficial</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Jogadores</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{padelPlayersCount}</p>
                  <p className="text-[12px] text-white/60">Perfis ativos na competição.</p>
                  {padelTopPlayers.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-white/70">
                      {padelTopPlayers.map((player) => (
                        <span
                          key={player.id}
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1"
                        >
                          {player.displayName || player.fullName || "Jogador"}{player.level ? ` · ${player.level}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[12px] text-white/50">Top players a definir.</p>
                  )}
                </div>
                <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Ranking & histórico</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    Aqui vês rankings, campeões e resultados oficiais assim que forem publicados.
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                    Temporada atual em preparação.
                  </div>
                </div>
              </div>
            </section>
          )}

          {organizationCategory === "VOLUNTARIADO" && (
            <section className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Missão</p>
                <h2 className="text-xl font-semibold text-white">Impacto e participação</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Missão</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    {publicDescription ||
                      "Esta organização cria ações com impacto real. A missão e os objetivos serão atualizados em breve."}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Como participar</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    {organizerProfile.infoRequirements ||
                      organizerProfile.infoRules ||
                      "Segue a organização, inscreve-te nas próximas ações e confirma a tua disponibilidade."}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Informação</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Sobre esta organização</h3>
              <p className="mt-2 text-[12px] text-white/60">
                {publicDescription ||
                  `Esta página representa a estrutura oficial para ${categoryMeta.nounPlural}. Mais detalhes e regras serão adicionados em breve.`}
              </p>
              <div className="mt-4 space-y-2 text-[12px]">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Localização base</span>
                  <span className="font-semibold text-white">{organizerProfile.city ?? "Por definir"}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Morada pública</span>
                  <span className="font-semibold text-white">
                    {showAddress ? organizerProfile.address : "Apenas na confirmação"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0a1122]/80 to-[#05070f]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Contacto oficial</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Fala com a equipa</h3>
              <p className="mt-2 text-[12px] text-white/60">
                Mensagens importantes, alterações e confirmações chegam sempre pelos canais oficiais.
              </p>
              <div className="mt-4 space-y-2 text-[12px]">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Website</span>
                  {publicWebsiteHref ? (
                    <a
                      href={publicWebsiteHref}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-white hover:text-white/80"
                    >
                      {publicWebsiteLabel}
                    </a>
                  ) : (
                    <span className="font-semibold text-white">{publicWebsiteLabel}</span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Email</span>
                  <span className="font-semibold text-white">{contactEmail ?? "A definir"}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>Horário</span>
                  <span className="font-semibold text-white">{publicHours ?? "A definir"}</span>
                </div>
              </div>
            </div>
          </section>

          {infoBlocks.length > 0 && (
            <section className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Blocos de informação</p>
                <h2 className="text-xl font-semibold text-white">Detalhes úteis</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {infoBlocks.map((block) => (
                  <div
                    key={block.key}
                    className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{block.title}</p>
                    <p className="mt-2 text-[13px] text-white/80 whitespace-pre-line">{block.body?.trim()}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </main>
    );
  }

  const isOwner = viewerId === profile.id;
  const isPrivate = profile.visibility === "PRIVATE";
  const canShowPrivate = isOwner || !isPrivate;
  let initialIsFollowing = false;

  let stats = {
    total: 0,
    upcoming: 0,
    past: 0,
    totalSpent: "—",
  };
  let followersCount = 0;
  let followingCount = 0;

  let recent: Array<{
    id: string;
    title: string;
    venueName: string | null;
    coverUrl: string | null;
    startAt: Date | null;
    isUpcoming: boolean;
  }> = [];

  if (prisma.follows) {
    const [followers, following] = await Promise.all([
      prisma.follows.count({ where: { following_id: profile.id } }),
      prisma.follows.count({ where: { follower_id: profile.id } }),
    ]);
    followersCount = followers;
    followingCount = following;

    if (!isOwner && viewerId) {
      const followRow = await prisma.follows.findFirst({
        where: { follower_id: viewerId, following_id: profile.id },
        select: { id: true },
      });
      initialIsFollowing = Boolean(followRow);
    }
  }

  if (canShowPrivate && (prisma as any).entitlement) {
    const now = new Date();
    try {
      const [total, upcoming, past, recentEntitlements] = await Promise.all([
        (prisma as any).entitlement.count({ where: { ownerUserId: profile.id } }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: profile.id, snapshotStartAt: { gte: now } },
        }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: profile.id, snapshotStartAt: { lt: now } },
        }),
        (prisma as any).entitlement.findMany({
          where: { ownerUserId: profile.id },
          orderBy: [{ snapshotStartAt: "desc" }],
          take: 4,
          select: {
            id: true,
            snapshotTitle: true,
            snapshotVenueName: true,
            snapshotCoverUrl: true,
            snapshotStartAt: true,
          },
        }),
      ]);

      stats = {
        total,
        upcoming,
        past,
        totalSpent: "—",
      };

      recent = (recentEntitlements ?? []).map((r: any) => ({
        id: r.id,
            title: r.snapshotTitle,
            venueName: r.snapshotVenueName,
            coverUrl: r.snapshotCoverUrl,
            startAt: r.snapshotStartAt,
            isUpcoming: r.snapshotStartAt ? new Date(r.snapshotStartAt) >= now : false,
          }));
    } catch (err) {
      console.warn("[profile] falha ao carregar entitlements", err);
    }
  }

  const displayName =
    organizerProfile?.publicName?.trim() ||
    profile.fullName?.trim() ||
    profile.username ||
    "Utilizador ORYA";
  const isOrganizationProfile = Boolean(organizerProfile);

  return (
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_60%)]" />
      <section className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <ProfileHeader
          isOwner={isOwner}
          name={displayName}
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          bio={profile.bio}
          city={profile.city}
          visibility={profile.visibility as "PUBLIC" | "PRIVATE" | null}
          createdAt={profile.createdAt?.toISOString?.() ?? null}
          followers={followersCount}
          following={followingCount}
          targetUserId={profile.id}
          initialIsFollowing={initialIsFollowing}
          isOrganization={isOrganizationProfile}
        />

        {canShowPrivate ? (
          <>
            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Eventos com bilhete"
                  value={stats.total}
                  subtitle="Timeline ORYA."
                  tone="default"
                />
                <StatCard
                  title="Próximos"
                  value={stats.upcoming}
                  subtitle="O que vem aí."
                  tone="emerald"
                />
                <StatCard
                  title="Passados"
                  value={stats.past}
                  subtitle="Memórias."
                  tone="cyan"
                />
                <StatCard
                  title="Total investido"
                  value={stats.totalSpent}
                  subtitle="Bruto - taxas."
                  tone="purple"
                />
              </div>
            </section>

            {isOwner ? (
              <section className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-2xl p-5 space-y-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)] min-h-[280px] relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.03),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(255,255,255,0.03),transparent_40%)]" />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">
                      Carteira ORYA
                    </h2>
                    <p className="text-[11px] text-white/68">
                      Entitlements ativos primeiro; memórias logo atrás. Tudo num só lugar.
                    </p>
                  </div>
                  <Link
                    href="/me/carteira"
                    className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:border-white/45 hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
                  >
                    Ver carteira
                    <span className="text-[12px]">↗</span>
                  </Link>
                </div>

                {recent.length === 0 ? (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-sm text-white/80">
                    Ainda não tens bilhetes ORYA.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {recent.map((item) => (
                      <RecentCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <EventListCard
                  title="Próximos eventos"
                  items={recent.filter((r) => r.isUpcoming)}
                  emptyLabel="Sem eventos futuros para mostrar."
                />
                <EventListCard
                  title="Eventos passados"
                  items={recent.filter((r) => !r.isUpcoming)}
                  emptyLabel="Sem eventos passados para mostrar."
                />
              </div>
            )}
          </>
        ) : (
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-center">
            <h2 className="text-lg font-semibold text-white">Perfil privado</h2>
            <p className="mt-2 text-sm text-white/70">
              {displayName} mantém a timeline privada. Só o próprio consegue ver os eventos e
              bilhetes.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

type StatTone = "default" | "emerald" | "cyan" | "purple";

function toneClasses(tone: StatTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 from-emerald-500/16 via-emerald-500/9 to-[#0c1a14] shadow-[0_12px_26px_rgba(16,185,129,0.18)] text-emerald-50";
    case "cyan":
      return "border-cyan-300/30 from-cyan-500/16 via-cyan-500/9 to-[#08171c] shadow-[0_12px_26px_rgba(34,211,238,0.18)] text-cyan-50";
    case "purple":
      return "border-purple-300/30 from-purple-500/16 via-purple-500/9 to-[#120d1f] shadow-[0_12px_26px_rgba(168,85,247,0.18)] text-purple-50";
    default:
      return "border-white/15 from-white/12 via-[#0b1224]/78 to-[#0a0f1d] shadow-[0_12px_26px_rgba(0,0,0,0.45)] text-white";
  }
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: StatTone;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.65)] ${toneClasses(
        tone,
      )}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 mix-blend-screen" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-white/5 blur-2xl" />
      <p
        className={`text-[11px] uppercase tracking-[0.16em] ${
          tone === "default" ? "text-white/65" : "text-white/75"
        }`}
      >
        {title}
      </p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="text-[12px] text-white/70">{subtitle}</p>
    </div>
  );
}

function RecentCard({
  item,
}: {
  item: { id: string; title: string; venueName: string | null; coverUrl: string | null; startAt: Date | null };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55">
              ORYA
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
          <p className="text-[11px] text-white/70 line-clamp-1">{item.venueName || "Local a anunciar"}</p>
          <p className="text-[11px] text-white/60">{formatDate(item.startAt)}</p>
        </div>
      </div>
    </div>
  );
}

function EventListCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ id: string; title: string; venueName: string | null; coverUrl: string | null; startAt: Date | null }>;
  emptyLabel: string;
}) {
  return (
    <section className="rounded-3xl border border-white/15 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-6 text-[12px] text-white/80">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RecentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
