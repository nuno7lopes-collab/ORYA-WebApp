"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getEventCoverUrl } from "@/lib/eventCover";
import ReservasBookingClient from "@/app/[username]/_components/ReservasBookingClient";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type ReservationAssignmentMode =
  | "PROFESSIONAL_ONLY"
  | "RESOURCE_ONLY"
  | "PROFESSIONAL_AND_RESOURCE";

type Service = {
  id: number;
  selectionKey?: string | null;
  courtId?: number | null;
  backingServiceId?: number | null;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  kind?: string | null;
  bookingVertical?: "COURT" | "CLASS" | "SERVICE" | null;
  assignmentMode?: ReservationAssignmentMode | null;
  partySizeRequired?: boolean;
  partySizeMin?: number;
  partySizeMax?: number;
  partySizeStep?: number;
  category?: {
    id: number;
    slug: string;
    label: string;
    domain: "COURT" | "CLASS" | "SERVICE";
  } | null;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode: "FIXED" | "CHOOSE_AT_BOOKING";
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null } | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
  addons?: Array<{
    id: number;
    label: string;
    description: string | null;
    deltaMinutes: number;
    deltaPriceCents: number;
    maxQty: number | null;
    category: string | null;
    sortOrder: number;
  }>;
  packages?: Array<{
    id: number;
    label: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    recommended: boolean;
    sortOrder: number;
  }>;
  durationPrices?: Array<{
    durationMinutes: number;
    priceCents: number;
    isActive: boolean;
  }>;
};

type Professional = {
  id: number;
  name: string;
  roleTitle: string | null;
  avatarUrl: string | null;
  username: string | null;
};

type Resource = {
  id: number;
  label: string;
  capacity: number;
};

type ReservasBookingSectionProps = {
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city?: string | null;
    address?: string | null;
    username: string | null;
    timezone: string | null;
    addressId?: string | null;
    addressRef?: { formattedAddress?: string | null } | null;
    reservationAssignmentMode: ReservationAssignmentMode;
  };
  services: Service[];
  professionals: Professional[];
  resources: Resource[];
  initialServiceKey?: string | null;
  initialServiceId?: number | null;
  featuredServiceIds?: number[];
  servicesLayout?: "grid" | "carousel";
  acceptNewBookings?: boolean;
  hubMode?: "legacy" | "club";
};

const cardBaseClass =
  "group relative overflow-hidden rounded-[28px] border border-white/15 bg-[#0a111d] p-4 text-left shadow-[0_26px_70px_rgba(0,0,0,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-white/35";

const cardActiveClass =
  "border-white/50 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_32px_80px_rgba(0,0,0,0.55)]";

const modalShellClass =
  "relative mx-auto w-full max-w-6xl overflow-hidden rounded-none border border-white/10 bg-[#050810] shadow-[0_30px_80px_rgba(0,0,0,0.7)] sm:rounded-[32px]";

const toggleBaseClass =
  "rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function getServiceSelectionKey(service: Service) {
  return service.selectionKey?.trim() || `service-${service.id}`;
}

export default function ReservasBookingSection({
  organization,
  services,
  professionals,
  resources,
  initialServiceKey,
  initialServiceId,
  featuredServiceIds = [],
  servicesLayout = "grid",
  acceptNewBookings = true,
  hubMode = "legacy",
}: ReservasBookingSectionProps) {
  const resolveServiceVertical = (service: Service): "COURT" | "CLASS" | "SERVICE" => {
    const byVertical =
      typeof service.bookingVertical === "string"
        ? service.bookingVertical.trim().toUpperCase()
        : "";
    if (byVertical === "COURT") return "COURT";
    if (byVertical === "CLASS") return "CLASS";
    if (byVertical === "SERVICE") return "SERVICE";
    const byKind = typeof service.kind === "string" ? service.kind.trim().toUpperCase() : "";
    if (byKind === "COURT") return "COURT";
    if (byKind === "CLASS") return "CLASS";
    return "SERVICE";
  };
  const activeServices = useMemo(
    () => services.filter((service) => service.isActive),
    [services],
  );
  const [activeHubTab, setActiveHubTab] = useState<"courts" | "classes" | "services">("courts");
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"services" | "professionals">("services");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalServiceKey, setModalServiceKey] = useState<string | null>(null);
  const [modalProfessionalId, setModalProfessionalId] = useState<number | null>(null);
  const [modalInitialServiceKey, setModalInitialServiceKey] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!acceptNewBookings) return;
    const initialService =
      (initialServiceKey
        ? activeServices.find((service) => getServiceSelectionKey(service) === initialServiceKey)
        : null) ??
      (initialServiceId ? activeServices.find((service) => service.id === initialServiceId) : null);
    if (!initialService) return;
    const serviceKey = getServiceSelectionKey(initialService);
    setSelectedServiceKey(serviceKey);
    setModalServiceKey(serviceKey);
    setModalProfessionalId(null);
    setModalInitialServiceKey(serviceKey);
    setModalOpen(true);
  }, [acceptNewBookings, activeServices, initialServiceId, initialServiceKey]);

  useEffect(() => {
    if (acceptNewBookings) return;
    setModalOpen(false);
    setModalServiceKey(null);
    setModalProfessionalId(null);
    setModalInitialServiceKey(null);
  }, [acceptNewBookings]);

  useEffect(() => {
    if (!modalOpen || typeof document === "undefined") return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [modalOpen]);

  const openModal = (serviceKey: string) => {
    if (!acceptNewBookings) return;
    setSelectedServiceKey(serviceKey);
    setModalServiceKey(serviceKey);
    setModalProfessionalId(null);
    setModalInitialServiceKey(serviceKey);
    setModalOpen(true);
  };

  const openModalWithProfessional = (serviceKey: string, professionalId: number) => {
    if (!acceptNewBookings) return;
    setSelectedServiceKey(serviceKey);
    setModalServiceKey(serviceKey);
    setModalProfessionalId(professionalId);
    setModalInitialServiceKey(serviceKey);
    setModalOpen(true);
  };

  const openModalForProfessional = (professionalId: number) => {
    if (!acceptNewBookings) return;
    const candidate =
      servicesByProfessional.get(professionalId)?.[0] ?? null;
    const candidateKey = candidate ? getServiceSelectionKey(candidate) : null;
    setModalServiceKey(null);
    setModalProfessionalId(professionalId);
    setModalInitialServiceKey(candidateKey);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalServiceKey(null);
    setModalProfessionalId(null);
    setModalInitialServiceKey(null);
  };

  const activeProfessionals = professionals;
  const orderedServices = useMemo(() => {
    const normalizedIds = featuredServiceIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    const uniqueFeaturedIds = Array.from(new Set(normalizedIds));
    const featured = uniqueFeaturedIds
      .map((id) => activeServices.find((service) => service.id === id))
      .filter((service): service is Service => Boolean(service));
    const featuredSelectionKeys = new Set(featured.map((service) => getServiceSelectionKey(service)));
    const remaining = activeServices.filter(
      (service) => !featuredSelectionKeys.has(getServiceSelectionKey(service)),
    );
    return [...featured, ...remaining];
  }, [activeServices, featuredServiceIds]);
  const courtServices = useMemo(
    () => orderedServices.filter((service) => resolveServiceVertical(service) === "COURT"),
    [orderedServices],
  );
  const classServices = useMemo(
    () => orderedServices.filter((service) => resolveServiceVertical(service) === "CLASS"),
    [orderedServices],
  );
  const generalServices = useMemo(
    () => orderedServices.filter((service) => resolveServiceVertical(service) === "SERVICE"),
    [orderedServices],
  );
  const servicesForCards = useMemo(() => {
    if (hubMode !== "club") return orderedServices;
    if (activeHubTab === "courts") return courtServices;
    if (activeHubTab === "classes") return classServices;
    return generalServices;
  }, [activeHubTab, classServices, courtServices, generalServices, hubMode, orderedServices]);
  const servicesByProfessional = useMemo(() => {
    const map = new Map<number, Service[]>();
    activeProfessionals.forEach((professional) => {
      const list = activeServices.filter((service) => {
        const links = service.professionalLinks ?? [];
        if (links.length === 0) return true;
        return links.some((link) => link.professionalId === professional.id);
      });
      map.set(professional.id, list);
    });
    return map;
  }, [activeProfessionals, activeServices]);
  useEffect(() => {
    if (hubMode !== "club") return;
    if (activeHubTab === "courts" && courtServices.length > 0) return;
    if (activeHubTab === "classes" && classServices.length > 0) return;
    if (activeHubTab === "services" && generalServices.length > 0) return;
    if (courtServices.length > 0) {
      setActiveHubTab("courts");
      return;
    }
    if (classServices.length > 0) {
      setActiveHubTab("classes");
      return;
    }
    setActiveHubTab("services");
  }, [activeHubTab, classServices.length, courtServices.length, generalServices.length, hubMode]);
  const sectionTitle =
    hubMode === "club"
      ? activeHubTab === "courts"
        ? "Campos"
        : activeHubTab === "classes"
          ? "Aulas"
          : "Serviços"
      : viewMode === "services"
        ? "Serviços"
        : "Profissionais";
  const sectionLabel = "Reservas";

  const updateScrollState = useCallback(() => {
    const node = carouselRef.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 8);
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
  }, []);

  useEffect(() => {
    if (servicesLayout !== "carousel") return;
    updateScrollState();
    const node = carouselRef.current;
    if (!node) return;
    const handleResize = () => updateScrollState();
    node.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", handleResize);
    return () => {
      node.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", handleResize);
    };
  }, [servicesLayout, updateScrollState]);

  const scrollCarousel = useCallback((direction: "left" | "right") => {
    const node = carouselRef.current;
    if (!node) return;
    const offset = node.clientWidth * 0.85 * (direction === "left" ? -1 : 1);
    node.scrollBy({ left: offset, behavior: "smooth" });
  }, []);

  const renderServiceCard = (service: Service, extraClassName = "") => {
    const serviceKey = getServiceSelectionKey(service);
    const coverUrl = getEventCoverUrl(service.coverImageUrl, {
      seed: serviceKey,
      width: 900,
      quality: 70,
      format: "webp",
    });
    const isSelected = serviceKey === selectedServiceKey;
    const vertical = resolveServiceVertical(service);
    const durationPrices = (service.durationPrices ?? [])
      .filter((item) => item.isActive !== false)
      .slice()
      .sort((a, b) => a.durationMinutes - b.durationMinutes || a.priceCents - b.priceCents);
    const cheapestDurationPrice = durationPrices[0] ?? null;
    const durationLabel =
      vertical === "COURT" && durationPrices.length > 0
        ? durationPrices.slice(0, 3).map((item) => `${item.durationMinutes}m`).join(" · ")
        : `${service.durationMinutes} min`;
    const priceLabel =
      vertical === "COURT" && cheapestDurationPrice
        ? `Desde ${formatMoney(cheapestDurationPrice.priceCents, service.currency)}`
        : service.unitPriceCents > 0
          ? formatMoney(service.unitPriceCents, service.currency)
          : "Grátis";
    const badgeLabel = vertical === "COURT" ? "Campo" : vertical === "CLASS" ? "Aula" : "Serviço";
    const badgeTone =
      vertical === "COURT"
        ? "border-cyan-200/40 bg-cyan-300/15 text-cyan-50"
        : vertical === "CLASS"
          ? "border-emerald-200/35 bg-emerald-300/15 text-emerald-50"
          : "border-white/25 bg-white/12 text-white/85";
    const trainerCount = service.professionalLinks?.length ?? 0;
    const categoryLabel = service.category?.label ?? service.categoryTag ?? null;
    return (
      <button
        key={serviceKey}
        type="button"
        className={`${cardBaseClass} ${isSelected ? cardActiveClass : ""} ${extraClassName} ${acceptNewBookings ? "" : "cursor-not-allowed opacity-70"}`}
        onClick={() => openModal(serviceKey)}
        disabled={!acceptNewBookings}
      >
        <div className="absolute inset-0">
          <Image
            src={coverUrl}
            alt={service.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-[#05070d]/70 to-[#05070d]/15" />
        <div className="relative z-10 flex h-full min-h-[210px] flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", badgeTone)}>
              {badgeLabel}
            </span>
            <span className="rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[10px] text-white/80">
              {acceptNewBookings ? "Abrir" : "Fechado"}
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <p className="line-clamp-1 text-base font-semibold text-white">{service.title}</p>
              {service.description ? (
                <p className="line-clamp-1 text-[12px] text-white/68">{service.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] text-white/85">
                {durationLabel}
              </span>
              <span className="inline-flex rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] text-white/85">
                {priceLabel}
              </span>
              {vertical === "CLASS" && trainerCount > 0 ? (
                <span className="inline-flex rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] text-white/80">
                  {trainerCount} treinador{trainerCount === 1 ? "" : "es"}
                </span>
              ) : null}
              {vertical === "COURT" && durationPrices.length > 1 ? (
                <span className="inline-flex rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] text-white/80">
                  {durationPrices.length} durações
                </span>
              ) : null}
              {categoryLabel ? (
                <span className="inline-flex rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] text-white/80">
                  {categoryLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    );
  };

  if (activeServices.length === 0) {
    return (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-4 text-[12px] text-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5">
        Sem serviços disponíveis neste momento.
      </div>
    );
  }

  return (
    <>
      <section className="space-y-4 rounded-[30px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(107,255,255,0.14),transparent_38%),linear-gradient(160deg,rgba(7,11,20,0.88),rgba(4,6,12,0.95))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.5)] sm:p-5">
        {!acceptNewBookings ? (
          <div className="rounded-2xl border border-amber-300/35 bg-amber-400/10 p-3 text-[12px] text-amber-100">
            Reservas indisponíveis de momento.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">{sectionLabel}</p>
            <h3 className="text-xl font-semibold text-white">{sectionTitle}</h3>
          </div>
          <div className="flex items-center gap-2">
            {hubMode === "club" ? (
              <div className="inline-flex rounded-full border border-white/15 bg-white/6 p-1">
                <button
                  type="button"
                  onClick={() => setActiveHubTab("courts")}
                  className={cn(
                    toggleBaseClass,
                    activeHubTab === "courts"
                      ? "border-white/35 bg-white/22 text-white"
                      : "border-transparent text-white/65 hover:text-white",
                  )}
                >
                  Campos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHubTab("classes")}
                  className={cn(
                    toggleBaseClass,
                    activeHubTab === "classes"
                      ? "border-white/35 bg-white/22 text-white"
                      : "border-transparent text-white/65 hover:text-white",
                  )}
                >
                  Aulas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHubTab("services")}
                  className={cn(
                    toggleBaseClass,
                    activeHubTab === "services"
                      ? "border-white/35 bg-white/22 text-white"
                      : "border-transparent text-white/65 hover:text-white",
                  )}
                >
                  Serviços
                </button>
              </div>
            ) : (
              <div className="inline-flex rounded-full border border-white/15 bg-white/6 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("services")}
                  className={cn(
                    toggleBaseClass,
                    viewMode === "services"
                      ? "border-white/35 bg-white/22 text-white"
                      : "border-transparent text-white/65 hover:text-white",
                  )}
                >
                  Serviços
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("professionals")}
                  className={cn(
                    toggleBaseClass,
                    viewMode === "professionals"
                      ? "border-white/35 bg-white/22 text-white"
                      : "border-transparent text-white/65 hover:text-white",
                  )}
                >
                  Profissionais
                </button>
              </div>
            )}
            <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] text-white/75">
              {hubMode === "club"
                ? servicesForCards.length
                : viewMode === "services"
                  ? activeServices.length
                  : activeProfessionals.length}
            </span>
          </div>
        </div>
        {hubMode === "club" || viewMode === "services" ? (
          servicesLayout === "carousel" ? (
            <div className="relative">
              <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
              >
                {servicesForCards.map((service) => (
                  <div
                    key={getServiceSelectionKey(service)}
                    className="min-w-[240px] snap-start sm:min-w-[280px] lg:min-w-[320px]"
                  >
                    {renderServiceCard(service, "w-full")}
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-2">
                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollCarousel("left")}
                    disabled={!canScrollLeft}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 transition ${
                      canScrollLeft ? "hover:bg-black/80" : "opacity-40"
                    }`}
                    aria-label="Anterior"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel("right")}
                    disabled={!canScrollRight}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 transition ${
                      canScrollRight ? "hover:bg-black/80" : "opacity-40"
                    }`}
                    aria-label="Seguinte"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {servicesForCards.length === 0 ? (
                <div className="rounded-3xl border border-white/12 bg-white/5 p-4 text-[12px] text-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5">
                  {hubMode === "club"
                    ? activeHubTab === "courts"
                      ? "Sem campos disponíveis."
                      : activeHubTab === "classes"
                        ? "Sem aulas disponíveis."
                        : "Sem serviços disponíveis."
                    : "Sem serviços disponíveis."}
                </div>
              ) : null}
              {servicesForCards.map((service) => renderServiceCard(service))}
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeProfessionals.length === 0 ? (
              <div className="rounded-3xl border border-white/12 bg-white/5 p-4 text-[12px] text-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5">
                Sem profissionais disponíveis.
              </div>
            ) : null}
            {activeProfessionals.map((professional) => {
              const proServices = servicesByProfessional.get(professional.id) ?? [];
              return (
                <div key={professional.id} className={cardBaseClass}>
                  <div className="relative z-10 flex min-h-[180px] flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={professional.avatarUrl}
                          name={professional.name}
                          className="h-11 w-11"
                          textClassName="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75"
                          fallbackText={professional.name?.slice(0, 2).toUpperCase() || "PR"}
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">{professional.name}</p>
                          <p className="text-[12px] text-white/60">{professional.roleTitle || "Profissional"}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-[12px] text-white/60">
                        {proServices.length} serviços disponíveis
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {proServices.slice(0, 3).map((service) => (
                          <button
                            key={`${professional.id}-${getServiceSelectionKey(service)}`}
                            type="button"
                            onClick={() => openModalWithProfessional(getServiceSelectionKey(service), professional.id)}
                            disabled={!acceptNewBookings}
                            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70 transition hover:border-white/35 hover:bg-white/15"
                          >
                            {service.title}
                          </button>
                        ))}
                        {proServices.length === 0 && (
                          <span className="text-[11px] text-white/50">Sem serviços atribuídos.</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                        <button
                          type="button"
                          onClick={() => openModalForProfessional(professional.id)}
                          disabled={proServices.length === 0 || !acceptNewBookings}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition hover:border-white/35 hover:bg-white/10 disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:bg-white/5"
                        >
                          Ver serviços
                        </button>
                        {professional.username ? (
                          <span className="text-white/50">@{professional.username}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {acceptNewBookings && modalOpen && activeServices.length > 0 ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative max-h-[100dvh] w-full p-0 sm:p-6">
            <div className={modalShellClass}>
              <ReservasBookingClient
                mode="modal"
                fixedServiceKey={modalServiceKey ?? undefined}
                fixedProfessionalId={modalProfessionalId ?? undefined}
                onClose={closeModal}
                organization={organization}
                services={services}
                professionals={professionals}
                resources={resources}
                initialServiceKey={modalServiceKey ?? modalInitialServiceKey ?? null}
                initialServiceId={initialServiceId ?? null}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
