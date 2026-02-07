// app/organizacao/(dashboard)/eventos/[id]/edit/page.tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { EventEditClient } from "@/app/organizacao/(dashboard)/eventos/EventEditClient";
import { CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { cn } from "@/lib/utils";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationEventEditPage({ params }: PageProps) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return <AuthGate />;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      ticketTypes: {
        include: {
          padelEventCategoryLink: {
            include: {
              category: { select: { label: true } },
            },
          },
        },
      },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: {
          mode: true,
          guestCheckoutAllowed: true,
          inviteTokenAllowed: true,
          inviteIdentityMatch: true,
          inviteTokenTtlSeconds: true,
          requiresEntitlementForEntry: true,
          checkinMethods: true,
        },
      },
      addressRef: {
        select: {
          formattedAddress: true,
          canonical: true,
          latitude: true,
          longitude: true,
          sourceProvider: true,
          sourceProviderPlaceId: true,
          confidenceScore: true,
          validationStatus: true,
        },
      },
    },
  });

  if (!event || !event.organizationId) notFound();

  const isPadelEvent = event.templateType === "PADEL";
  const isGratis = deriveIsFreeEvent({
    pricingMode: event.pricingMode ?? undefined,
    ticketPrices: event.ticketTypes.map((t) => t.price ?? 0),
  });
  const eventRouteBase = isPadelEvent ? "/organizacao/padel/torneios" : "/organizacao/eventos";
  const primaryLabelTitle = isPadelEvent ? "Torneio" : "Evento";
  const fallbackHref = eventRouteBase;

  const { organization, membership } = await getActiveOrganizationForUser(data.user.id, {
    organizationId: event.organizationId,
    allowFallback: true,
  });

  if (!organization || !membership) {
    redirect(appendOrganizationIdToHref("/organizacao", event.organizationId));
  }
  const access = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: data.user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.EVENTOS,
    required: "EDIT",
  });
  if (!access.ok) {
    redirect(appendOrganizationIdToHref(fallbackHref, event.organizationId));
  }

  const tickets = event.ticketTypes.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price: t.price,
    currency: t.currency,
    totalQuantity: t.totalQuantity,
    soldQuantity: t.soldQuantity,
    status: t.status,
    startsAt: t.startsAt ? t.startsAt.toISOString() : null,
    endsAt: t.endsAt ? t.endsAt.toISOString() : null,
    padelEventCategoryLinkId: t.padelEventCategoryLinkId ?? null,
    padelCategoryLabel: t.padelEventCategoryLink?.category?.label ?? null,
  }));

  return (
    <div className={cn("w-full py-8 space-y-6 text-white")}>
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">Editar {primaryLabelTitle.toLowerCase()}</p>
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <p className="text-sm text-white/60">
              ID {event.id} · {event.slug}
            </p>
          </div>
          <a
            href={`/eventos/${event.slug}`}
            className={CTA_SECONDARY}
          >
            Ver página pública
          </a>
        </div>
      </div>

      <EventEditClient
        event={{
          id: event.id,
          organizationId: event.organizationId,
          slug: event.slug,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          locationName: event.locationName,
          locationCity: event.locationCity,
          address: event.addressRef?.formattedAddress ?? event.locationFormattedAddress ?? null,
          addressId: (event as { addressId?: string | null }).addressId ?? null,
          locationSource: event.locationSource,
          locationProviderId: event.locationProviderId,
          locationFormattedAddress: event.locationFormattedAddress,
          locationComponents: event.locationComponents as Record<string, unknown> | null,
          locationOverrides: event.locationOverrides as Record<string, unknown> | null,
          latitude: event.latitude,
          longitude: event.longitude,
          addressRef: event.addressRef
            ? {
                formattedAddress: event.addressRef.formattedAddress,
                canonical: event.addressRef.canonical as Record<string, unknown> | null,
                latitude: event.addressRef.latitude,
                longitude: event.addressRef.longitude,
                sourceProvider: event.addressRef.sourceProvider,
                sourceProviderPlaceId: event.addressRef.sourceProviderPlaceId,
                confidenceScore: event.addressRef.confidenceScore,
                validationStatus: event.addressRef.validationStatus,
              }
            : null,
          templateType: event.templateType,
          isGratis: isGratis,
          coverImageUrl: event.coverImageUrl,
          liveHubVisibility: event.liveHubVisibility,
          liveStreamUrl: event.liveStreamUrl,
          accessPolicy: event.accessPolicies?.[0] ?? null,
          payoutMode: event.payoutMode,
        }}
        tickets={tickets}
      />
    </div>
  );
}
