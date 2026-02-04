"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getEventCoverUrl } from "@/lib/eventCover";
import ReservasBookingClient from "@/app/[username]/_components/ReservasBookingClient";
import { cn } from "@/lib/utils";

type Service = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  kind?: string | null;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode: "FIXED" | "CHOOSE_AT_BOOKING";
  defaultLocationText?: string | null;
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
    city: string | null;
    username: string | null;
    timezone: string | null;
    address: string | null;
    reservationAssignmentMode: "PROFESSIONAL" | "RESOURCE";
  };
  services: Service[];
  professionals: Professional[];
  resources: Resource[];
  initialServiceId?: number | null;
  featuredServiceIds?: number[];
  servicesLayout?: "grid" | "carousel";
};

const cardBaseClass =
  "group relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-4 text-left shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition hover:border-white/30 hover:bg-white/10";

const cardActiveClass =
  "border-white/45 bg-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.55)]";

const modalShellClass =
  "relative mx-auto w-full max-w-6xl overflow-hidden rounded-none border border-white/10 bg-[#050810] shadow-[0_30px_80px_rgba(0,0,0,0.7)] sm:rounded-[32px]";

const toggleBaseClass =
  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition";

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function ReservasBookingSection({
  organization,
  services,
  professionals,
  resources,
  initialServiceId,
  featuredServiceIds = [],
  servicesLayout = "grid",
}: ReservasBookingSectionProps) {
  const activeServices = useMemo(
    () => services.filter((service) => service.isActive),
    [services],
  );
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"services" | "professionals">("services");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalServiceId, setModalServiceId] = useState<number | null>(null);
  const [modalProfessionalId, setModalProfessionalId] = useState<number | null>(null);
  const [modalInitialServiceId, setModalInitialServiceId] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!initialServiceId) return;
    if (!activeServices.some((service) => service.id === initialServiceId)) return;
    setSelectedServiceId(initialServiceId);
    setModalServiceId(initialServiceId);
    setModalProfessionalId(null);
    setModalInitialServiceId(initialServiceId);
    setModalOpen(true);
  }, [activeServices, initialServiceId]);

  useEffect(() => {
    if (!modalOpen || typeof document === "undefined") return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [modalOpen]);

  const openModal = (serviceId: number) => {
    setSelectedServiceId(serviceId);
    setModalServiceId(serviceId);
    setModalProfessionalId(null);
    setModalInitialServiceId(serviceId);
    setModalOpen(true);
  };

  const openModalWithProfessional = (serviceId: number, professionalId: number) => {
    setSelectedServiceId(serviceId);
    setModalServiceId(serviceId);
    setModalProfessionalId(professionalId);
    setModalInitialServiceId(serviceId);
    setModalOpen(true);
  };

  const openModalForProfessional = (professionalId: number) => {
    const candidate =
      servicesByProfessional.get(professionalId)?.[0]?.id ?? null;
    setModalServiceId(null);
    setModalProfessionalId(professionalId);
    setModalInitialServiceId(candidate);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalServiceId(null);
    setModalProfessionalId(null);
    setModalInitialServiceId(null);
  };

  const activeProfessionals = professionals;
  const orderedServices = useMemo(() => {
    const normalizedIds = featuredServiceIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    const uniqueFeaturedIds = Array.from(new Set(normalizedIds));
    const featuredSet = new Set(uniqueFeaturedIds);
    const featured = uniqueFeaturedIds
      .map((id) => activeServices.find((service) => service.id === id))
      .filter((service): service is Service => Boolean(service));
    const remaining = activeServices.filter((service) => !featuredSet.has(service.id));
    return [...featured, ...remaining];
  }, [activeServices, featuredServiceIds]);
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
    const coverUrl = getEventCoverUrl(service.coverImageUrl, {
      seed: `service-${service.id}`,
      width: 900,
      quality: 70,
      format: "webp",
    });
    const isSelected = service.id === selectedServiceId;
    const priceLabel =
      service.unitPriceCents > 0
        ? formatMoney(service.unitPriceCents, service.currency)
        : "Gratuito";
    return (
      <button
        key={service.id}
        type="button"
        className={`${cardBaseClass} ${isSelected ? cardActiveClass : ""} ${extraClassName}`}
        onClick={() => openModal(service.id)}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        <div className="relative z-10 flex h-full min-h-[180px] flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{service.title}</p>
              <p className="mt-1 text-[12px] text-white/70">
                {service.durationMinutes} min · {priceLabel}
              </p>
            </div>
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] text-white/70">
              Reservar
            </span>
          </div>
          <div className="space-y-2">
            {service.description && (
              <p className="text-[12px] text-white/70 line-clamp-2">{service.description}</p>
            )}
            {service.categoryTag && (
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white/70">
                {service.categoryTag}
              </span>
            )}
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
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
              {viewMode === "services" ? "Serviços" : "Profissionais"}
            </p>
            <h3 className="text-lg font-semibold text-white">
              {viewMode === "services" ? "Escolhe o serviço" : "Escolhe o profissional"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setViewMode("services")}
                className={cn(
                  toggleBaseClass,
                  viewMode === "services"
                    ? "border-white/35 bg-white/20 text-white"
                    : "border-transparent text-white/70 hover:text-white",
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
                    ? "border-white/35 bg-white/20 text-white"
                    : "border-transparent text-white/70 hover:text-white",
                )}
              >
                Profissionais
              </button>
            </div>
            <span className="text-[12px] text-white/60">
              {viewMode === "services" ? activeServices.length : activeProfessionals.length} opções
            </span>
          </div>
        </div>
        {viewMode === "services" ? (
          servicesLayout === "carousel" ? (
            <div className="relative">
              <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
              >
                {orderedServices.map((service) => (
                  <div
                    key={service.id}
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
              {orderedServices.map((service) => renderServiceCard(service))}
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeProfessionals.length === 0 ? (
              <div className="rounded-3xl border border-white/12 bg-white/5 p-4 text-[12px] text-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5">
                Sem profissionais disponíveis neste momento.
              </div>
            ) : null}
            {activeProfessionals.map((professional) => {
              const proServices = servicesByProfessional.get(professional.id) ?? [];
              return (
                <div key={professional.id} className={cardBaseClass}>
                  <div className="relative z-10 flex min-h-[180px] flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 overflow-hidden rounded-full border border-white/15 bg-white/10">
                          {professional.avatarUrl ? (
                            <Image
                              src={professional.avatarUrl}
                              alt={professional.name}
                              width={44}
                              height={44}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[12px] text-white/60">
                              {professional.name?.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
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
                            key={`${professional.id}-${service.id}`}
                            type="button"
                            onClick={() => openModalWithProfessional(service.id, professional.id)}
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
                          disabled={proServices.length === 0}
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

      {modalOpen && activeServices.length > 0 ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative max-h-[100svh] w-full p-0 sm:p-6">
            <div className={modalShellClass}>
              <ReservasBookingClient
                mode="modal"
                fixedServiceId={modalServiceId ?? undefined}
                fixedProfessionalId={modalProfessionalId ?? undefined}
                onClose={closeModal}
                organization={organization}
                services={services}
                professionals={professionals}
                resources={resources}
                initialServiceId={modalServiceId ?? modalInitialServiceId ?? initialServiceId ?? null}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
