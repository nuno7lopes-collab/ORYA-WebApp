import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProfileCoverUrl } from "@/lib/profileCover";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { username: string; trainer: string } | Promise<{ username: string; trainer: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function TrainerProfilePage({ params }: PageProps) {
  const resolved = await params;
  const orgUsername = resolved.username;
  const trainerParam = resolved.trainer;

  const organization = await prisma.organization.findFirst({
    where: { username: orgUsername, status: "ACTIVE" },
    select: { id: true, publicName: true, username: true, brandingCoverUrl: true },
  });

  if (!organization) notFound();

  const profile = await prisma.trainerProfile.findFirst({
    where: {
      organizationId: organization.id,
      isPublished: true,
      reviewStatus: "APPROVED",
      user: {
        OR: [
          { username: trainerParam },
          ...(isUuid(trainerParam) ? [{ id: trainerParam }] : []),
        ],
      },
    },
    include: {
      user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
    },
  });

  if (!profile || !profile.user) notFound();

  const services = await prisma.service.findMany({
    where: {
      organizationId: organization.id,
      instructorId: profile.userId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      durationMinutes: true,
      unitPriceCents: true,
      currency: true,
    },
  });

  const displayName = profile.user.fullName || profile.user.username || "Treinador";
  const certifications = profile.certifications
    ? profile.certifications
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const trainerCoverUrl = getProfileCoverUrl(
    profile.coverImageUrl || organization.brandingCoverUrl || null,
    {
      width: 900,
      height: 900,
      quality: 70,
      format: "webp",
    },
  );

  return (
    <main className="min-h-screen w-full text-white">
      <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-12">
        <div className="rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-white/15 bg-white/10">
              {profile.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.user.avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
              ) : null}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Treinador</p>
              <h1 className="text-2xl font-semibold text-white">{displayName}</h1>
              <p className="text-sm text-white/60">
                {organization.publicName || "Clube"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="aspect-square w-full max-w-sm overflow-hidden rounded-3xl border border-white/12 bg-black/30">
              {trainerCoverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trainerCoverUrl}
                  alt="Capa do treinador"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>

          {(profile.bio || profile.specialties.length > 0) && (
            <div className="mt-5 space-y-3">
              {profile.bio && <p className="text-sm text-white/75">{profile.bio}</p>}
              {profile.specialties.length > 0 && (
                <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                  {profile.specialties.map((item) => (
                    <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {certifications.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Certificações</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/70">
                {certifications.map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {services.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Aulas disponíveis</p>
              <div className="grid gap-3 md:grid-cols-2">
                {services.map((service) => (
                  <Link
                    key={service.id}
                    href={`/${organization.username}?serviceId=${service.id}`}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80 transition hover:border-white/35 hover:bg-white/10"
                  >
                    <p className="text-base font-semibold text-white">{service.title}</p>
                    <p className="text-[12px] text-white/60">
                      {service.durationMinutes} min · {(service.unitPriceCents / 100).toFixed(2)} {service.currency}
                    </p>
                    {service.description && (
                      <p className="mt-2 text-[12px] text-white/60 line-clamp-2">{service.description}</p>
                    )}
                    <span className="mt-3 inline-flex rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                      Reservar aula
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {services.length === 0 && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              Aulas ainda não disponíveis.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
