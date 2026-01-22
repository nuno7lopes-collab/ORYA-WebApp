"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_NEUTRAL } from "@/app/organizacao/dashboardUi";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import OrganizationAgendaTabs from "@/app/components/profile/OrganizationAgendaTabs";
import { Avatar } from "@/components/ui/avatar";
import ReservasBookingSection from "@/app/[username]/_components/ReservasBookingSection";
import { getEventCoverUrl } from "@/lib/eventCover";
import { getProfileCoverUrl, sanitizeProfileCoverUrl } from "@/lib/profileCover";
import { Reorder } from "framer-motion";
import {
  CORE_ORGANIZATION_MODULES,
  parseOrganizationModules,
  resolvePrimaryModule,
  type OperationModule,
} from "@/lib/organizationCategories";
import {
  ensurePublicProfileLayout,
  PUBLIC_PROFILE_MODULES,
  type PublicProfileLayout,
  type PublicProfileModuleConfig,
  type PublicProfileModuleType,
  type PublicProfileModuleWidth,
} from "@/lib/publicProfileLayout";

const BIO_LIMIT = 280;
const MODULE_LABELS: Record<
  PublicProfileModuleType,
  { title: string; description: string }
> = {
  SERVICOS: { title: "Serviços", description: "Reservas e CTA principal." },
  AGENDA: { title: "Agenda pública", description: "Eventos e agenda visível." },
  FORMULARIOS: { title: "Formulários", description: "Inscrições e contacto." },
  AVALIACOES: { title: "Avaliações", description: "Prova social e ratings." },
  SOBRE: { title: "Sobre", description: "Descrição e links úteis." },
  LOJA: { title: "Loja", description: "Produtos e checkout da organização." },
};

const OPERATION_META: Record<
  OperationModule,
  { label: string; cta: string; noun: string; nounPlural: string }
> = {
  EVENTOS: {
    label: "Eventos",
    cta: "Ver eventos",
    noun: "evento",
    nounPlural: "eventos",
  },
  TORNEIOS: {
    label: "Torneios",
    cta: "Ver torneios",
    noun: "torneio",
    nounPlural: "torneios",
  },
  RESERVAS: {
    label: "Reservas",
    cta: "Ver reservas",
    noun: "evento",
    nounPlural: "eventos",
  },
};

const OPERATION_TEMPLATE: Record<OperationModule, "PADEL" | null> = {
  EVENTOS: null,
  TORNEIOS: "PADEL",
  RESERVAS: null,
};

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

function formatEventDateRange(start: Date | null, end: Date | null, timezone?: string | null) {
  if (!start) return "Data a definir";
  const safeTimezone = timezone || "Europe/Lisbon";
  const optsDay: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
  };
  const optsTime: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const dayStr = new Intl.DateTimeFormat("pt-PT", { ...optsDay, timeZone: safeTimezone }).format(start);
  const startTimeStr = new Intl.DateTimeFormat("pt-PT", { ...optsTime, timeZone: safeTimezone }).format(start);
  const endTimeStr = end
    ? new Intl.DateTimeFormat("pt-PT", { ...optsTime, timeZone: safeTimezone }).format(end)
    : null;
  return `${dayStr} · ${startTimeStr}${endTimeStr ? ` – ${endTimeStr}` : ""}`;
}

function formatFormDateRange(startAt: Date | null, endAt: Date | null) {
  if (!startAt && !endAt) return "Disponível sempre";
  if (startAt && endAt) {
    const startLabel = formatDate(startAt);
    const endLabel = formatDate(endAt);
    return startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel || endLabel;
  }
  return formatDate(startAt ?? endAt);
}

function formatDayLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(date);
}

function formatTimeLabel(date: Date | null, timezone: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function buildAgendaGroups(
  events: Array<{
    id: number;
    slug: string;
    title: string;
    startsAt: Date | null;
    locationName: string | null;
    locationCity: string | null;
    timezone: string | null;
    isFree: boolean;
    templateType: string | null;
  }>,
  pastEventIds?: Set<number>,
) {
  const groups: Array<{
    key: string;
    label: string;
      items: Array<{
        id: number;
        slug: string;
        title: string;
        timeLabel: string;
        locationLabel: string;
        isPast: boolean;
        isFree: boolean;
        templateType: string | null;
      }>;
  }> = [];
  const groupMap = new Map<string, (typeof groups)[number]>();

  for (const event of events) {
    const timezone = event.timezone || "Europe/Lisbon";
    const hasDate = Boolean(event.startsAt);
    const key = hasDate
      ? new Intl.DateTimeFormat("pt-PT", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: timezone,
        }).format(event.startsAt as Date)
      : "data-a-definir";
    const label = hasDate ? formatDayLabel(event.startsAt as Date, timezone) : "Data a definir";
    const locationLabel =
      [event.locationName, event.locationCity].filter(Boolean).join(" · ") || "Local a anunciar";
    const item = {
      id: event.id,
      slug: event.slug,
      title: event.title,
      timeLabel: hasDate ? formatTimeLabel(event.startsAt as Date, timezone) : "—",
      locationLabel,
      isPast: pastEventIds?.has(event.id) ?? false,
      isFree: event.isFree,
      templateType: event.templateType ?? null,
    };

    if (!groupMap.has(key)) {
      groupMap.set(key, { key, label, items: [item] });
    } else {
      groupMap.get(key)?.items.push(item);
    }
  }

  groupMap.forEach((group) => groups.push(group));
  return groups;
}

function buildTicketHref(slug: string) {
  return `/eventos/${slug}?checkout=1#bilhetes`;
}

type OrganizationProfileInfo = {
  id?: number;
  publicName?: string | null;
  businessName?: string | null;
  username?: string | null;
  publicDescription?: string | null;
  brandingAvatarUrl?: string | null;
  brandingCoverUrl?: string | null;
  publicWebsite?: string | null;
  publicInstagram?: string | null;
  publicYoutube?: string | null;
  publicHours?: string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: string | Date | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  orgType?: string | null;
  address?: string | null;
  showAddressPublicly?: boolean | null;
  city?: string | null;
  timezone?: string | null;
  reservationAssignmentMode?: "PROFESSIONAL" | "RESOURCE" | string | null;
  primaryModule?: string | null;
  modules?: string[] | null;
  publicProfileLayout?: PublicProfileLayout | null;
};

type ServiceOption = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  categoryTag?: string | null;
  kind?: string | null;
  coverImageUrl?: string | null;
  locationMode?: string | null;
  defaultLocationText?: string | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
  _count?: { bookings?: number; availabilities?: number };
};

type EventPreviewItem = {
  id: number;
  slug: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone?: string | null;
  status?: string | null;
  templateType?: string | null;
  locationName?: string | null;
  locationCity?: string | null;
  coverImageUrl?: string | null;
  isFree?: boolean;
};

type FormPreviewItem = {
  id: number;
  title: string;
  description?: string | null;
  status?: string | null;
  capacity?: number | null;
  submissionsCount?: number | null;
  startAt?: string | null;
  endAt?: string | null;
};

type FormPreview = Omit<FormPreviewItem, "startAt" | "endAt"> & {
  startAt: Date | null;
  endAt: Date | null;
};

type DraftRow = {
  id: string;
  columns: 1 | 2;
};

type CanvasRow = {
  id: string;
  columns: 1 | 2;
  slots: Array<PublicProfileModuleConfig | null>;
  modules: PublicProfileModuleConfig[];
  isDraft?: boolean;
};

type ReviewItem = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string | null;
  user: { fullName: string | null; avatarUrl: string | null } | null;
};

type ProfessionalOption = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive?: boolean;
  user: { avatarUrl: string | null; username: string | null } | null;
};

type ResourceOption = {
  id: number;
  label: string;
  capacity: number;
  isActive?: boolean;
};

type StorePreviewProduct = {
  id: number;
  name: string;
  priceCents: number;
  currency: string;
  slug: string;
  status: string;
  isVisible: boolean;
  imageUrl: string | null;
};

type StorePreviewResponse = {
  ok: boolean;
  store?: {
    id: number;
    status: string;
    showOnProfile: boolean | null;
    catalogLocked: boolean | null;
    currency: string;
  };
  counts?: {
    total: number;
    public: number;
    draft: number;
  };
  publicProducts?: StorePreviewProduct[];
  draftProducts?: StorePreviewProduct[];
  error?: string;
};

type AgendaEvent = {
  id: number;
  slug: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string | null;
  coverImageUrl: string | null;
  locationName: string | null;
  locationCity: string | null;
  isFree: boolean;
  templateType: string | null;
};

function EventSpotlightCard({
  event,
  label,
  emptyLabel,
  ctaLabel,
  ctaHref,
  variant = "default",
}: {
  event: AgendaEvent | null;
  label: string;
  emptyLabel: string;
  ctaLabel: string;
  ctaHref: string | null;
  variant?: "default" | "embedded";
}) {
  if (!event) {
    return (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/70 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{label}</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{emptyLabel}</h3>
        <p className="mt-1 text-[12px] text-white/60">Próximas datas aqui.</p>
      </div>
    );
  }

  const cover = getEventCoverUrl(event.coverImageUrl, {
    seed: event.slug ?? event.id ?? event.title,
    width: 1400,
    quality: 72,
    format: "webp",
  });
  const eventHref = `/eventos/${event.slug}`;
  const wrapperClass =
    variant === "embedded"
      ? "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4"
      : "relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl";

  return (
    <div className={wrapperClass}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${cover})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
      <Link
        href={eventHref}
        aria-label={`Abrir ${event.title}`}
        className="absolute inset-0 z-0"
      />
      <div className="relative z-10 max-w-xl space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">{label}</p>
        <h3 className="text-2xl font-semibold text-white">{event.title}</h3>
        <p className="text-[12px] text-white/75">
          {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}
        </p>
        <p className="text-[12px] text-white/65">
          {event.locationName}
          {event.locationCity ? ` · ${event.locationCity}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ctaHref && (
            <Link
              href={ctaHref}
              className="relative z-10 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.35)]"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

type OrganizationPublicProfilePanelProps = {
  organization: OrganizationProfileInfo | null;
  membershipRole?: string | null;
  categoryLabel?: string;
  coverUrl?: string | null;
  services?: ServiceOption[];
  events?: EventPreviewItem[];
  activeModules?: string[] | null;
};

export default function OrganizationPublicProfilePanel({
  organization,
  membershipRole,
  categoryLabel,
  coverUrl,
  services = [],
  events = [],
  activeModules,
}: OrganizationPublicProfilePanelProps) {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();
  const canEdit = membershipRole === "OWNER" || membershipRole === "ADMIN";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "username" | "city" | "bio" | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverDirty, setCoverDirty] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [profileLayout, setProfileLayout] = useState<PublicProfileLayout>(() =>
    ensurePublicProfileLayout(null),
  );
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null);
  const [layoutOrgId, setLayoutOrgId] = useState<number | null>(null);
  const [expandedModule, setExpandedModule] = useState<PublicProfileModuleType | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(true);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [draggingModuleType, setDraggingModuleType] = useState<PublicProfileModuleType | null>(null);
  const [dragTarget, setDragTarget] = useState<{ rowId: string; slot: number } | null>(null);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [editorWidth, setEditorWidth] = useState(360);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const draftRowCounterRef = useRef(0);
  const activeServices = useMemo(
    () => services.filter((service) => service.isActive),
    [services],
  );
  const fetcher = useCallback((url: string) => fetch(url).then((res) => res.json()), []);
  const normalizedActiveModules = useMemo(() => {
    const raw = Array.isArray(activeModules)
      ? activeModules
      : Array.isArray(organization?.modules)
        ? organization?.modules
        : [];
    return raw
      .filter((module): module is string => typeof module === "string")
      .map((module) => module.trim().toUpperCase())
      .filter((module) => module.length > 0);
  }, [activeModules, organization?.modules]);
  const normalizedModules = useMemo(
    () => parseOrganizationModules(normalizedActiveModules) ?? [],
    [normalizedActiveModules],
  );
  const primaryOperation = useMemo(
    () => resolvePrimaryModule(organization?.primaryModule ?? null, normalizedModules),
    [organization?.primaryModule, normalizedModules],
  );
  const moduleSet = useMemo(
    () => new Set<string>([...normalizedModules, ...CORE_ORGANIZATION_MODULES, primaryOperation]),
    [normalizedModules, primaryOperation],
  );
  const hasReservasTool = moduleSet.has("RESERVAS");
  const hasEventosTool = moduleSet.has("EVENTOS");
  const hasTorneiosTool = moduleSet.has("TORNEIOS");
  const hasInscricoesTool = moduleSet.has("INSCRICOES");
  const hasLojaTool = moduleSet.has("LOJA");
  const operationMeta = OPERATION_META[primaryOperation];
  const operationTemplate = OPERATION_TEMPLATE[primaryOperation];
  const moduleAvailability = useMemo(
    () => ({
      SERVICOS: hasReservasTool,
      AGENDA: hasEventosTool || hasTorneiosTool,
      FORMULARIOS: hasInscricoesTool,
      AVALIACOES: hasReservasTool,
      SOBRE: true,
      LOJA: hasLojaTool,
    }),
    [hasReservasTool, hasEventosTool, hasInscricoesTool, hasLojaTool, hasTorneiosTool],
  );
  const shouldLoadForms = Boolean(user && moduleAvailability.FORMULARIOS);
  const shouldLoadProfessionals = Boolean(user && moduleAvailability.SERVICOS);
  const shouldLoadResources = Boolean(user && moduleAvailability.SERVICOS);
  const shouldLoadReviews = Boolean(user && moduleAvailability.AVALIACOES);
  const shouldLoadStore = Boolean(user && moduleAvailability.LOJA);
  const { data: formsData } = useSWR<{ ok: boolean; items: FormPreviewItem[] }>(
    shouldLoadForms ? "/api/organizacao/inscricoes" : null,
    fetcher,
  );
  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalOption[] }>(
    shouldLoadProfessionals ? "/api/organizacao/reservas/profissionais" : null,
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceOption[] }>(
    shouldLoadResources ? "/api/organizacao/reservas/recursos" : null,
    fetcher,
  );
  const { data: reviewsData } = useSWR<{ ok: boolean; items: ReviewItem[] }>(
    shouldLoadReviews ? "/api/organizacao/avaliacoes" : null,
    fetcher,
  );
  const { data: storePreviewData } = useSWR<StorePreviewResponse>(
    shouldLoadStore ? "/api/organizacao/loja/preview" : null,
    fetcher,
  );
  const formsList = useMemo<FormPreview[]>(() => {
    const items = formsData?.items ?? [];
    return items
      .filter((form) => form.status === "PUBLISHED")
      .map((form) => ({
        ...form,
        startAt: form.startAt ? new Date(form.startAt) : null,
        endAt: form.endAt ? new Date(form.endAt) : null,
      }));
  }, [formsData]);
  const professionalsList = useMemo(
    () =>
      (professionalsData?.items ?? [])
        .filter((professional) => professional.isActive !== false)
        .map((professional) => ({
          id: professional.id,
          name: professional.name,
          roleTitle: professional.roleTitle,
          avatarUrl: professional.user?.avatarUrl ?? null,
          username: professional.user?.username ?? null,
        })),
    [professionalsData],
  );
  const resourcesList = useMemo(
    () =>
      (resourcesData?.items ?? [])
        .filter((resource) => resource.isActive !== false)
        .map((resource) => ({
          id: resource.id,
          label: resource.label,
          capacity: resource.capacity,
        })),
    [resourcesData],
  );
  const reviewsList = useMemo(() => reviewsData?.items ?? [], [reviewsData]);
  const storePreview = storePreviewData?.ok ? storePreviewData : null;
  const storePreviewError =
    storePreviewData && !storePreviewData.ok
      ? storePreviewData.error || "Loja indisponivel."
      : null;
  const storePublicProducts = storePreview?.publicProducts ?? [];
  const storeDraftProducts = storePreview?.draftProducts ?? [];
  const storePublicCount = storePreview?.counts?.public ?? 0;
  const storeDraftCount = storePreview?.counts?.draft ?? 0;
  const storeStatus = storePreview?.store?.status ?? null;
  const storeShowOnProfile = Boolean(storePreview?.store?.showOnProfile);
  const storeLocked = Boolean(storePreview?.store?.catalogLocked);
  const storeIsOpen = storeStatus === "OPEN";
  const storeIsPublic = storeIsOpen && storeShowOnProfile;
  const storePublicHref = organization?.username ? `/${organization.username}/loja` : null;
  const agendaEvents = useMemo<AgendaEvent[]>(() => {
    const items = events ?? [];
    return items
      .filter((ev) => ev.status === "PUBLISHED")
      .map((ev) => ({
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        startsAt: ev.startsAt ? new Date(ev.startsAt) : null,
        endsAt: ev.endsAt ? new Date(ev.endsAt) : null,
        timezone: ev.timezone ?? null,
        coverImageUrl: ev.coverImageUrl ?? null,
        locationName: ev.locationName ?? null,
        locationCity: ev.locationCity ?? null,
        isFree: Boolean(ev.isFree),
        templateType: ev.templateType ?? null,
      }))
      .sort((a, b) => {
        const aTime = a.startsAt ? a.startsAt.getTime() : Infinity;
        const bTime = b.startsAt ? b.startsAt.getTime() : Infinity;
        return aTime - bTime;
      });
  }, [events]);
  const enabledModules = useMemo(
    () =>
      profileLayout.modules.filter(
        (module) => module.enabled && moduleAvailability[module.type],
      ),
    [profileLayout.modules, moduleAvailability],
  );

  useEffect(() => {
    if (!organization) return;
    const initialName = organization.publicName || organization.businessName || "";
    setName(initialName);
    setUsername(organization.username ?? "");
    setBio(organization.publicDescription ?? "");
    setAvatarUrl(organization.brandingAvatarUrl ?? null);
    setCity(organization.city ?? "");
    if (!coverDirty) {
      setCoverImageUrl(
        sanitizeProfileCoverUrl(organization.brandingCoverUrl ?? coverUrl ?? null),
      );
    }
  }, [organization, coverUrl, coverDirty]);

  useEffect(() => {
    setCoverDirty(false);
  }, [organization?.id]);

  useEffect(() => {
    if (!organization) return;
    const orgId = organization.id ?? null;
    if (layoutOrgId === orgId && layoutDirty) return;
    setProfileLayout(ensurePublicProfileLayout(organization.publicProfileLayout ?? null));
    setLayoutDirty(false);
    setLayoutMessage(null);
    setLayoutOrgId(orgId);
    setExpandedModule(null);
  }, [organization, layoutDirty, layoutOrgId]);

  useEffect(() => {
    if (expandedModule && enabledModules.some((module) => module.type === expandedModule)) {
      return;
    }
    const first = enabledModules[0]?.type ?? null;
    if (first !== expandedModule) setExpandedModule(first);
  }, [expandedModule, enabledModules]);

  const updateModuleByType = useCallback(
    (
      type: PublicProfileModuleType,
      updater: (module: PublicProfileLayout["modules"][number]) => PublicProfileLayout["modules"][number],
    ) => {
      setProfileLayout((prev) => {
        const modules = prev.modules.map((module) =>
          module.type === type ? updater(module) : module,
        );
        return { ...prev, modules };
      });
      setLayoutDirty(true);
    },
    [],
  );

  const updateModuleSettings = useCallback(
    (type: PublicProfileModuleType, patch: Record<string, unknown>) => {
      updateModuleByType(type, (module) => ({
        ...module,
        settings: {
          ...(module.settings ?? {}),
          ...patch,
        },
      }));
    },
    [updateModuleByType],
  );

  const reorderEnabledModules = useCallback(
    (nextEnabled: PublicProfileLayout["modules"]) => {
      setProfileLayout((prev) => {
        const moduleMap = new Map(prev.modules.map((module) => [module.type, module]));
        const orderedEnabled = nextEnabled
          .map((module) => moduleMap.get(module.type))
          .filter((module): module is PublicProfileLayout["modules"][number] => Boolean(module));
        const enabledTypes = new Set(orderedEnabled.map((module) => module.type));
        let cursor = 0;
        const modules = prev.modules.map((module) => {
          if (!enabledTypes.has(module.type)) return module;
          const nextModule = orderedEnabled[cursor];
          cursor += 1;
          return nextModule ?? module;
        });
        return { ...prev, modules };
      });
      setLayoutDirty(true);
    },
    [],
  );

  const setModuleEnabled = useCallback(
    (type: PublicProfileModuleType, nextEnabled: boolean) => {
      if (nextEnabled && !moduleAvailability[type]) return;
      updateModuleByType(type, (current) => ({ ...current, enabled: nextEnabled }));
    },
    [moduleAvailability, updateModuleByType],
  );

  const addModuleToCanvasAt = useCallback(
    (type: PublicProfileModuleType, index: number, width?: PublicProfileModuleWidth) => {
      if (!moduleAvailability[type]) return;
      setProfileLayout((prev) => {
        const existing = prev.modules.find((module) => module.type === type);
        if (!existing) return prev;
        const withoutTarget = prev.modules.filter((module) => module.type !== type);
        const enabledModules = withoutTarget.filter(
          (module) => module.enabled && moduleAvailability[module.type],
        );
        const disabledModules = withoutTarget.filter(
          (module) => !module.enabled || !moduleAvailability[module.type],
        );
        const nextIndex = Math.min(Math.max(index, 0), enabledModules.length);
        const target = {
          ...existing,
          enabled: true,
          width: width ?? existing.width,
        };
        const nextEnabled = [
          ...enabledModules.slice(0, nextIndex),
          target,
          ...enabledModules.slice(nextIndex),
        ];
        return { ...prev, modules: [...nextEnabled, ...disabledModules] };
      });
      setLayoutDirty(true);
      setExpandedModule(type);
    },
    [moduleAvailability],
  );

  const addModuleToCanvas = useCallback(
    (type: PublicProfileModuleType) => {
      addModuleToCanvasAt(type, enabledModules.length, "full");
    },
    [addModuleToCanvasAt, enabledModules.length],
  );

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!editorOpen) return;
      setIsResizingEditor(true);
      resizeStartRef.current = { x: event.clientX, width: editorWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [editorOpen, editorWidth],
  );

  useEffect(() => {
    if (!isResizingEditor) return;
    const handleMove = (event: PointerEvent) => {
      if (!resizeStartRef.current) return;
      const delta = resizeStartRef.current.x - event.clientX;
      const nextWidth = Math.min(520, Math.max(300, resizeStartRef.current.width + delta));
      setEditorWidth(nextWidth);
    };
    const handleUp = () => {
      setIsResizingEditor(false);
      resizeStartRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isResizingEditor]);

  const servicesModule = useMemo(
    () => profileLayout.modules.find((module) => module.type === "SERVICOS") ?? null,
    [profileLayout.modules],
  );
  const servicesModuleEnabled = Boolean(servicesModule?.enabled && moduleAvailability.SERVICOS);
  const featuredServiceIds = useMemo(() => {
    const raw = servicesModule?.settings?.featuredServiceIds;
    if (!Array.isArray(raw)) return [];
    const ids = raw.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    const activeIds = new Set(activeServices.map((service) => service.id));
    return ids.filter((id) => activeIds.has(id));
  }, [servicesModule, activeServices]);
  const servicesById = useMemo(
    () => new Map(activeServices.map((service) => [service.id, service])),
    [activeServices],
  );
  const orderedServices = useMemo(() => {
    if (featuredServiceIds.length === 0) return activeServices;
    const featuredSet = new Set(featuredServiceIds);
    const featured = featuredServiceIds
      .map((id) => servicesById.get(id))
      .filter((service): service is ServiceOption => Boolean(service));
    const rest = activeServices.filter((service) => !featuredSet.has(service.id));
    return [...featured, ...rest];
  }, [activeServices, featuredServiceIds, servicesById]);
  const availableModuleTypes = useMemo(
    () => PUBLIC_PROFILE_MODULES.filter((type) => moduleAvailability[type]),
    [moduleAvailability],
  );

  const setFeaturedServiceIds = useCallback(
    (nextIds: number[]) => {
      updateModuleByType("SERVICOS", (module) => ({
        ...module,
        settings: {
          ...(module.settings ?? {}),
          featuredServiceIds: nextIds,
        },
      }));
    },
    [updateModuleByType],
  );

  const toggleFeaturedService = useCallback(
    (serviceId: number) => {
      if (!canEdit || !servicesModuleEnabled) return;
      const nextIds = featuredServiceIds.includes(serviceId)
        ? featuredServiceIds.filter((id) => id !== serviceId)
        : [...featuredServiceIds, serviceId];
      setFeaturedServiceIds(nextIds);
    },
    [canEdit, featuredServiceIds, servicesModuleEnabled, setFeaturedServiceIds],
  );


  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=avatar", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setMessage(json?.error || "Não foi possível carregar a imagem.");
        return;
      }
      setAvatarUrl(json.url as string);
      setMessage("Imagem atualizada. Não te esqueças de guardar.");
    } catch (err) {
      console.error("[perfil-publico] upload", err);
      setMessage("Erro ao carregar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=profile-cover", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setMessage(json?.error || "Não foi possível carregar a capa.");
        return;
      }
      setCoverImageUrl(json.url as string);
      setCoverDirty(true);
      setMessage("Capa atualizada. Não te esqueças de guardar.");
    } catch (err) {
      console.error("[perfil-publico] cover upload", err);
      setMessage("Erro ao carregar a capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizacao?tab=profile" });
      return;
    }
    if (!canEdit) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("O nome público é obrigatório.");
      return;
    }
    if (bio.length > BIO_LIMIT) {
      setMessage("A bio é demasiado longa.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organizacao/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicName: trimmedName,
          publicDescription: bio.trim(),
          brandingAvatarUrl: avatarUrl,
          brandingCoverUrl: coverImageUrl,
          city: city.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setMessage(json?.error || "Não foi possível guardar o perfil público.");
        return;
      }
      setMessage("Perfil público atualizado.");
      setEditingField(null);
      setCoverDirty(false);
      router.refresh();
    } catch (err) {
      console.error("[perfil-publico] save", err);
      setMessage("Erro ao guardar alterações.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLayout = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizacao?tab=profile" });
      return;
    }
    if (!canEdit) return;
    setSavingLayout(true);
    setLayoutMessage(null);
    try {
      const res = await fetch("/api/organizacao/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicProfileLayout: profileLayout }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setLayoutMessage(json?.error || "Não foi possível guardar o layout.");
        return;
      }
      setLayoutMessage("Layout do perfil atualizado.");
      setLayoutDirty(false);
      router.refresh();
    } catch (err) {
      console.error("[perfil-publico] layout", err);
      setLayoutMessage("Erro ao guardar o layout.");
    } finally {
      setSavingLayout(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizacao?tab=profile" });
      return;
    }
    if (!canEdit) return;
    setUsernameMessage(null);
    const validation = validateUsername(username);
    if (!validation.valid) {
      setUsernameMessage(validation.error);
      return;
    }
    setSavingUsername(true);
    try {
      const res = await fetch("/api/organizacao/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: validation.normalized }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setUsernameMessage(json?.error || "Não foi possível atualizar o username.");
        return;
      }
      setUsername(validation.normalized);
      setUsernameMessage("Username atualizado.");
      setEditingField(null);
      router.refresh();
    } catch (err) {
      console.error("[perfil-publico] username", err);
      setUsernameMessage("Erro ao atualizar o username.");
    } finally {
      setSavingUsername(false);
    }
  };

  const displayName = name.trim() || organization?.businessName?.trim() || "Organização ORYA";
  const displayUsername = username.trim() || organization?.username?.trim() || null;
  const displayBio = bio.trim() || organization?.publicDescription?.trim() || "";
  const displayCity = city.trim() || organization?.city?.trim() || "";
  const avatarPreviewUrl = avatarUrl ?? organization?.brandingAvatarUrl ?? null;
  const coverPreviewUrl = getProfileCoverUrl(coverImageUrl ?? coverUrl ?? null, {
    width: 1500,
    height: 500,
    quality: 70,
    format: "webp",
  });
  const publicProfileUrl = displayUsername ? `/${displayUsername}` : null;
  const servicesSettings = servicesModule?.settings ?? {};
  const servicesCarouselEnabled = servicesSettings.carouselEnabled !== false;
  const servicesCtaLabel =
    typeof servicesSettings.ctaLabel === "string" && servicesSettings.ctaLabel.trim().length > 0
      ? servicesSettings.ctaLabel.trim()
      : "Agendar";
  const servicesCtaHref =
    typeof servicesSettings.ctaHref === "string" && servicesSettings.ctaHref.trim().length > 0
      ? servicesSettings.ctaHref.trim()
      : "#reservar";
  const servicesShowStats = servicesSettings.showStats !== false;

  const agendaLayoutModule = profileLayout.modules.find((module) => module.type === "AGENDA");
  const agendaSettings = agendaLayoutModule?.settings ?? {};
  const agendaShowSpotlight = agendaSettings.showSpotlight !== false;

  const formsLayoutModule = profileLayout.modules.find((module) => module.type === "FORMULARIOS");
  const formsSettings = formsLayoutModule?.settings ?? {};
  const formsCtaLabel =
    typeof formsSettings.ctaLabel === "string" && formsSettings.ctaLabel.trim().length > 0
      ? formsSettings.ctaLabel.trim()
      : "Responder";

  const reviewsLayoutModule = profileLayout.modules.find((module) => module.type === "AVALIACOES");
  const reviewsSettings = reviewsLayoutModule?.settings ?? {};
  const reviewsMaxItems =
    typeof reviewsSettings.maxItems === "number" && Number.isFinite(reviewsSettings.maxItems)
      ? Math.max(1, Math.min(12, Math.floor(reviewsSettings.maxItems)))
      : 8;
  const reviewsCount = reviewsList.length;
  const reviewsAverage =
    reviewsCount > 0
      ? reviewsList.reduce((sum, review) => sum + review.rating, 0) / reviewsCount
      : null;
  const displayReviews = reviewsList.slice(0, reviewsMaxItems);

  const categoryEvents = useMemo(() => {
    if (!operationTemplate) return agendaEvents;
    return agendaEvents.filter(
      (event) =>
        event.templateType === operationTemplate ||
        event.templateType === null ||
        event.templateType === "OTHER",
    );
  }, [agendaEvents, operationTemplate]);
  const now = new Date();
  const upcomingEvents = useMemo(
    () =>
      categoryEvents
        .filter((event) => event.startsAt && event.startsAt >= now)
        .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)),
    [categoryEvents],
  );
  const pastEvents = useMemo(
    () =>
      categoryEvents
        .filter((event) => event.startsAt && event.startsAt < now)
        .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0)),
    [categoryEvents],
  );
  const pastEventIds = useMemo(() => new Set(pastEvents.map((event) => event.id)), [pastEvents]);
  const upcomingGroups = useMemo(
    () => buildAgendaGroups(upcomingEvents, pastEventIds),
    [upcomingEvents, pastEventIds],
  );
  const pastGroups = useMemo(
    () => buildAgendaGroups(pastEvents, pastEventIds),
    [pastEvents, pastEventIds],
  );
  const allGroups = useMemo(
    () => buildAgendaGroups([...upcomingEvents, ...pastEvents], pastEventIds),
    [upcomingEvents, pastEvents, pastEventIds],
  );
  const agendaTotal = upcomingEvents.length + pastEvents.length;
  const spotlightEvent = upcomingEvents[0] ?? null;
  const spotlightCtaLabel = spotlightEvent
    ? spotlightEvent.templateType === "PADEL"
      ? "Inscrever agora"
      : spotlightEvent.isFree
        ? "Garantir lugar"
        : "Comprar bilhete"
    : "Comprar bilhete";
  const spotlightCtaHref = spotlightEvent ? buildTicketHref(spotlightEvent.slug) : null;

  const publicForms = formsList;
  const featuredForm = useMemo(() => {
    return (
      publicForms.find((form) => /guarda[-\s]?redes/i.test(form.title)) ?? publicForms[0] ?? null
    );
  }, [publicForms]);
  const featuredFormDateLabel = featuredForm
    ? formatFormDateRange(featuredForm.startAt, featuredForm.endAt)
    : null;
  const featuredFormCapacityLabel = featuredForm?.capacity
    ? `${featuredForm.capacity} vagas`
    : null;
  const inscriptionsCoverUrl = getEventCoverUrl(spotlightEvent?.coverImageUrl ?? null, {
    seed:
      spotlightEvent?.slug ??
      spotlightEvent?.id ??
      organization?.username ??
      organization?.id ??
      "orya",
    width: 900,
    quality: 70,
    format: "webp",
  });

  const showServicesModule = hasReservasTool && activeServices.length > 0;
  const showAgendaModule = (hasEventosTool || hasTorneiosTool) && agendaTotal > 0;
  const showFormsModule = hasInscricoesTool && publicForms.length > 0;
  const showReviewsModule = hasReservasTool && reviewsCount > 0;
  const showAboutModule = Boolean(displayBio.trim());
  const showStoreModule =
    hasLojaTool &&
    (storePublicCount > 0 || (canEdit && (storePreview?.store || storePreviewError)));

  const servicesModuleContent = showServicesModule ? (
    <section className="space-y-5 sm:space-y-6">
      <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Reservas</p>
            <h2 className="text-xl font-semibold text-white sm:text-2xl">{displayName}</h2>
            {servicesShowStats && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/65 sm:gap-2 sm:text-[12px]">
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                  {reviewsAverage ? `${reviewsAverage.toFixed(1)} ★` : "Novo"}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                  {reviewsCount} avaliações
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                  {displayCity || "Localização"}
                </span>
              </div>
            )}
          </div>
          <a
            href={servicesCtaHref}
            className="w-full rounded-full bg-white px-5 py-2 text-center text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:w-auto"
          >
            {servicesCtaLabel}
          </a>
        </div>
      </div>

      <div id="reservar">
        <ReservasBookingSection
          organization={{
            id: organization?.id ?? 0,
            publicName: organization?.publicName ?? null,
            businessName: organization?.businessName ?? null,
            city: displayCity || organization?.city || null,
            username: displayUsername,
            timezone: organization?.timezone ?? "Europe/Lisbon",
            address: organization?.address ?? null,
            reservationAssignmentMode:
              (organization?.reservationAssignmentMode as "PROFESSIONAL" | "RESOURCE") ??
              "PROFESSIONAL",
          }}
          services={orderedServices.map((service) => ({
            ...service,
            coverImageUrl: service.coverImageUrl ?? null,
            locationMode: (service.locationMode ?? "FIXED") as "FIXED" | "CHOOSE_AT_BOOKING",
            defaultLocationText: service.defaultLocationText ?? null,
            professionalLinks: service.professionalLinks ?? [],
            resourceLinks: service.resourceLinks ?? [],
          }))}
          professionals={professionalsList}
          resources={resourcesList}
          featuredServiceIds={featuredServiceIds}
          servicesLayout={servicesCarouselEnabled ? "carousel" : "grid"}
        />
      </div>
    </section>
  ) : null;

  const aboutModuleContent = showAboutModule ? (
    <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Sobre</p>
      <p className="mt-2 text-[13px] text-white/70 sm:text-sm">
        {displayBio || "Descrição indisponível."}
      </p>
    </div>
  ) : null;

  const reviewsModuleContent = showReviewsModule ? (
    <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Avaliações</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {displayReviews.map((review) => (
          <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                {review.user?.fullName || "Cliente"}
              </p>
              <span className="text-[12px] text-white/70">{review.rating} ★</span>
            </div>
            {review.comment && (
              <p className="mt-2 text-[12px] text-white/70">{review.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const agendaModuleContent = showAgendaModule ? (
    <div className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <OrganizationAgendaTabs
        title="Agenda pública"
        anchorId="agenda"
        layout="stack"
        upcomingGroups={upcomingGroups}
        pastGroups={pastGroups}
        allGroups={allGroups}
        upcomingCount={upcomingEvents.length}
        pastCount={pastEvents.length}
        totalCount={agendaTotal}
        prelude={
          agendaShowSpotlight ? (
            <EventSpotlightCard
              event={spotlightEvent}
              label={`Próximo ${operationMeta.noun}`}
              emptyLabel={`Sem ${operationMeta.noun} anunciado`}
              ctaLabel={spotlightCtaLabel}
              ctaHref={spotlightCtaHref}
              variant="embedded"
            />
          ) : null
        }
      />
    </div>
  ) : null;

  const formsModuleContent = showFormsModule ? (
    <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-[#05070f]/80 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070f]/95 via-[#0b1124]/85 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-2/3">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: `url(${inscriptionsCoverUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/40 to-[#05070f]/95" />
        </div>
      </div>

      <div className="relative z-10 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Formulários</p>
        <h3 className="text-lg font-semibold text-white">
          {featuredForm?.title || "Formulário em preparação"}
        </h3>
        {featuredFormDateLabel || featuredFormCapacityLabel ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70">
            {featuredFormDateLabel && (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                {featuredFormDateLabel}
              </span>
            )}
            {featuredFormCapacityLabel && (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                {featuredFormCapacityLabel}
              </span>
            )}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {featuredForm ? (
            <Link
              href={`/inscricoes/${featuredForm.id}`}
              className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
            >
              {formsCtaLabel}
            </Link>
          ) : (
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/70">
              Em breve
            </span>
          )}
        </div>
      </div>
    </section>
  ) : null;

  const storeVisibilityNote = storePreviewError
    ? storePreviewError
    : !storeIsOpen
      ? "A loja esta fechada. Abre-a para aparecer no perfil."
      : !storeShowOnProfile
        ? "A loja esta escondida no perfil publico."
        : null;

  const storeModuleContent = showStoreModule ? (
    <section className="rounded-3xl border border-white/12 bg-white/5 p-4 sm:p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Loja</p>
          <h3 className="text-lg font-semibold text-white">Produtos em destaque</h3>
          <p className="text-[12px] text-white/60">Compra direta com checkout ORYA.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/70">
          <span
            className={`rounded-full border px-2 py-1 ${
              storeIsPublic
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                : "border-white/15 bg-white/5 text-white/60"
            }`}
          >
            {storeIsOpen ? (storeShowOnProfile ? "Publica" : "Oculta") : "Fechada"}
          </span>
          {storeLocked && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-100">
              Catalogo bloqueado
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/60">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
          {storePublicCount} publicados
        </span>
        {storeDraftCount > 0 && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
            {storeDraftCount} rascunhos
          </span>
        )}
      </div>

      {storeVisibilityNote && (
        <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-100">
          {storeVisibilityNote}
        </div>
      )}

      {storePublicProducts.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {storePublicProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-white/10 bg-black/40 p-3 transition hover:border-white/30"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/60">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                    Sem imagem
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1">
                <p className="line-clamp-2 text-sm font-semibold text-white">{product.name}</p>
                <p className="text-[11px] text-white/65">
                  {formatMoney(product.priceCents, product.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : storeDraftCount > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] text-white/70">
            Tens produtos em rascunho ou invisiveis. Publica-os para aparecerem no perfil.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {storeDraftProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-white/10 bg-black/40 p-3"
              >
                <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black/60">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                      Sem imagem
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-white">{product.name}</p>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-white/60">
                    Rascunho
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] text-white/70">
          Ainda nao ha produtos publicados.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {storePublicHref && storeIsPublic && storePublicProducts.length > 0 ? (
          <Link
            href={storePublicHref}
            className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,0.25)]"
          >
            Visitar loja
          </Link>
        ) : null}
        {canEdit && (
          <Link
            href="/organizacao/loja?view=catalog&sub=products"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80"
          >
            Gerir produtos
          </Link>
        )}
      </div>
    </section>
  ) : null;

  const moduleContentByType: Record<PublicProfileModuleType, JSX.Element | null> = {
    SERVICOS: servicesModuleContent,
    AGENDA: agendaModuleContent,
    FORMULARIOS: formsModuleContent,
    AVALIACOES: reviewsModuleContent,
    SOBRE: aboutModuleContent,
    LOJA: storeModuleContent,
  };

  const visibleModules = useMemo(
    () => enabledModules.filter((module) => moduleContentByType[module.type]),
    [enabledModules, moduleContentByType],
  );
  const moduleStats = useMemo(
    () =>
      ({
        SERVICOS: activeServices.length,
        AGENDA: agendaTotal,
        FORMULARIOS: publicForms.length,
        AVALIACOES: reviewsCount,
        SOBRE: showAboutModule ? 1 : 0,
        LOJA: storePublicCount,
      }) as Record<PublicProfileModuleType, number>,
    [
      activeServices.length,
      agendaTotal,
      publicForms.length,
      reviewsCount,
      showAboutModule,
      storePublicCount,
    ],
  );
  const enabledModuleIndexByType = useMemo(
    () => new Map(enabledModules.map((module, index) => [module.type, index])),
    [enabledModules],
  );
  const rows = useMemo<CanvasRow[]>(() => {
    const built: CanvasRow[] = [];
    for (let i = 0; i < visibleModules.length; i += 1) {
      const module = visibleModules[i];
      if (module.width === "full") {
        built.push({
          id: `row-${module.id}`,
          columns: 1,
          slots: [module],
          modules: [module],
        });
        continue;
      }
      const next = visibleModules[i + 1];
      if (next && next.width === "half") {
        built.push({
          id: `row-${module.id}-${next.id}`,
          columns: 2,
          slots: [module, next],
          modules: [module, next],
        });
        i += 1;
        continue;
      }
      built.push({
        id: `row-${module.id}`,
        columns: 2,
        slots: [module, null],
        modules: [module],
      });
    }
    draftRows.forEach((draft) => {
      built.push({
        id: draft.id,
        columns: draft.columns,
        slots: draft.columns === 2 ? [null, null] : [null],
        modules: [],
        isDraft: true,
      });
    });
    return built;
  }, [visibleModules, draftRows]);
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const rowMap = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    const row = rowMap.get(selectedRowId) ?? null;
    if (!row) return null;
    const index = rows.findIndex((candidate) => candidate.id === selectedRowId);
    if (index < 0) return null;
    return { row, index };
  }, [rowMap, rows, selectedRowId]);

  useEffect(() => {
    if (!selectedRowId) return;
    if (!rowMap.has(selectedRowId)) {
      setSelectedRowId(null);
    }
  }, [rowMap, selectedRowId]);

  const clearDragTarget = useCallback(() => {
    setDragTarget(null);
    setCanvasDragOver(false);
  }, []);

  const addDraftRow = useCallback((columns: 1 | 2 = 2) => {
    const id = `draft-row-${draftRowCounterRef.current += 1}`;
    setDraftRows((prev) => [...prev, { id, columns }]);
    setSelectedRowId(id);
    setExpandedModule(null);
  }, []);

  const updateDraftRow = useCallback((rowId: string, columns: 1 | 2) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, columns } : row)),
    );
  }, []);

  const removeDraftRow = useCallback(
    (rowId: string) => {
      setDraftRows((prev) => prev.filter((row) => row.id !== rowId));
      if (selectedRowId === rowId) setSelectedRowId(null);
    },
    [selectedRowId],
  );

  const setRowColumns = useCallback(
    (row: CanvasRow, columns: 1 | 2) => {
      if (row.isDraft) {
        updateDraftRow(row.id, columns);
        return;
      }
      const targetWidth: PublicProfileModuleWidth = columns === 1 ? "full" : "half";
      row.modules.forEach((module) => {
        updateModuleByType(module.type, (current) => ({
          ...current,
          width: targetWidth,
        }));
      });
    },
    [updateDraftRow, updateModuleByType],
  );

  const removeRow = useCallback(
    (row: CanvasRow) => {
      if (row.isDraft) {
        removeDraftRow(row.id);
        return;
      }
      row.modules.forEach((module) => {
        setModuleEnabled(module.type, false);
      });
      setSelectedRowId(null);
      setExpandedModule(null);
    },
    [removeDraftRow, setModuleEnabled],
  );

  const getRowInsertIndices = useCallback(
    (row: CanvasRow, rowIndex: number) => {
      const firstModule = row.modules[0] ?? null;
      let rowStartIndex = 0;
      if (firstModule) {
        rowStartIndex =
          enabledModuleIndexByType.get(firstModule.type) ?? enabledModules.length;
      } else {
        for (let i = rowIndex - 1; i >= 0; i -= 1) {
          const previous = rows[i];
          const lastModule = previous.modules[previous.modules.length - 1];
          if (!lastModule) continue;
          const lastIndex = enabledModuleIndexByType.get(lastModule.type);
          rowStartIndex = (lastIndex ?? -1) + 1;
          break;
        }
      }
      const rightInsertIndex = (() => {
        if (!firstModule) return rowStartIndex;
        const firstIndex = enabledModuleIndexByType.get(firstModule.type) ?? rowStartIndex;
        return firstIndex + 1;
      })();
      return { rowStartIndex, rightInsertIndex };
    },
    [enabledModuleIndexByType, enabledModules.length, rows],
  );

  const handleRowReorder = useCallback(
    (nextIds: string[]) => {
      const orderedRows = nextIds
        .map((id) => rowMap.get(id))
        .filter((row): row is CanvasRow => Boolean(row));
      const orderedModules = orderedRows.flatMap((row) => row.modules);
      reorderEnabledModules(orderedModules);
    },
    [rowMap, reorderEnabledModules],
  );

  const handleAddModule = useCallback(
    (type: PublicProfileModuleType) => {
      if (!canEdit) return;
      if (selectedRow) {
        const { row, index } = selectedRow;
        const emptySlotIndex = row.slots.findIndex((slot) => !slot);
        if (emptySlotIndex !== -1) {
          const { rowStartIndex, rightInsertIndex } = getRowInsertIndices(row, index);
          const insertIndex = emptySlotIndex === 0 ? rowStartIndex : rightInsertIndex;
          const width: PublicProfileModuleWidth = row.columns === 2 ? "half" : "full";
          addModuleToCanvasAt(type, insertIndex, width);
          if (row.isDraft) {
            removeDraftRow(row.id);
            setSelectedRowId(null);
          }
          setExpandedModule(type);
          return;
        }
      }
      addModuleToCanvas(type);
    },
    [
      addModuleToCanvas,
      addModuleToCanvasAt,
      canEdit,
      getRowInsertIndices,
      removeDraftRow,
      selectedRow,
    ],
  );

  const handleCanvasDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!draggingModuleType) return;
      event.preventDefault();
      setCanvasDragOver(true);
    },
    [draggingModuleType],
  );

  const handleCanvasDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const related = event.relatedTarget as Node | null;
      if (related && event.currentTarget.contains(related)) return;
      clearDragTarget();
    },
    [clearDragTarget],
  );

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!draggingModuleType) return;
      event.preventDefault();
      const rawType = event.dataTransfer.getData("text/plain");
      const normalized = rawType?.trim().toUpperCase() || draggingModuleType || "";
      if (!normalized) return;
      if (!PUBLIC_PROFILE_MODULES.includes(normalized as PublicProfileModuleType)) return;
      addModuleToCanvasAt(
        normalized as PublicProfileModuleType,
        enabledModules.length,
        "full",
      );
      setDraggingModuleType(null);
      clearDragTarget();
    },
    [addModuleToCanvasAt, clearDragTarget, draggingModuleType, enabledModules.length],
  );

  if (!organization) {
    return (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-6 text-white/70">
        A carregar perfil público…
      </div>
    );
  }

  return (
    <div className="mt-4">
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!canEdit || uploadingCover}
        onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!canEdit || uploading}
        onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
      />

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/7 via-[#060914]/92 to-[#05070f]/96 shadow-[0_26px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        <div className="px-5 pt-5 sm:px-8">
          <div className="w-full">
            <div className="relative orya-profile-cover w-full overflow-hidden rounded-2xl border border-white/10">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={coverPreviewUrl ? { backgroundImage: `url(${coverPreviewUrl})` } : undefined}
              />
              {!coverPreviewUrl && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(107,255,255,0.25),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(255,0,200,0.2),transparent_55%),linear-gradient(135deg,rgba(6,10,20,0.8),rgba(9,10,18,0.95))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-[#05070f]/95" />
              {canEdit && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] text-white/80 hover:bg-black/60"
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? "A carregar…" : "Alterar capa"}
                  </button>
                  {coverPreviewUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverImageUrl(null);
                        setCoverDirty(true);
                        setMessage("Capa removida. Não te esqueças de guardar.");
                      }}
                      className={CTA_NEUTRAL}
                      disabled={uploadingCover}
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute inset-0 z-0"
                  aria-label="Editar capa"
                />
              )}
            </div>
          </div>
        </div>

        <div className="relative -mt-12 px-5 pb-6 sm:-mt-14 sm:px-8">
          <div className="flex w-full flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] p-[2px] shadow-[0_0_24px_rgba(255,0,200,0.26)]"
                  disabled={!canEdit || uploading}
                >
                  <Avatar
                    src={avatarPreviewUrl}
                    name={displayName}
                    className="h-full w-full"
                    textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
                  />
                  {canEdit && (
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/70 p-1.5 text-white/80">
                      <PencilIcon />
                    </span>
                  )}
                </button>
                {canEdit && avatarPreviewUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl(null);
                      setMessage("Foto removida. Não te esqueças de guardar.");
                    }}
                    className="mt-2 text-[11px] text-white/70 hover:text-white"
                  >
                    Remover foto
                  </button>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {editingField === "name" ? (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-lg font-semibold text-white outline-none focus:border-white/40"
                      placeholder="Nome público"
                    />
                  ) : (
                    <h1 className="text-[22px] sm:text-3xl font-semibold tracking-tight text-white truncate">
                      {displayName}
                    </h1>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "name" ? null : "name")}
                      className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/80">
                  {editingField === "username" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white">
                        <span className="text-white/50">@</span>
                        <input
                          value={username}
                          onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                          className="ml-2 min-w-[140px] bg-transparent text-sm text-white outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        className={CTA_SECONDARY}
                        onClick={handleSaveUsername}
                        disabled={!canEdit || savingUsername}
                      >
                        {savingUsername ? "A guardar…" : "Guardar @"}
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white">
                      {displayUsername ? `@${displayUsername}` : "Define um @username"}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "username" ? null : "username")}
                      className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                  {editingField === "city" ? (
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-white/40"
                      placeholder="Cidade"
                    />
                  ) : (
                    <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                      {displayCity || "Cidade por definir"}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "city" ? null : "city")}
                      className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  {editingField === "bio" ? (
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
                      rows={3}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      placeholder="Escreve uma bio curta"
                    />
                  ) : (
                    <p className="max-w-xl text-sm text-white/85 leading-relaxed">
                      {displayBio || "Sem bio no momento."}
                    </p>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "bio" ? null : "bio")}
                      className="mt-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>
                {categoryLabel && <span className="text-[11px] text-white/50">Operação: {categoryLabel}</span>}
                {usernameMessage && <p className="text-[11px] text-white/60">{usernameMessage}</p>}
                {message && <p className="text-[12px] text-white/70">{message}</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {publicProfileUrl && (
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/70">
                  {publicProfileUrl}
                </span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className={CTA_PRIMARY}
                  disabled={saving}
                >
                  {saving ? "A guardar…" : "Guardar alterações"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div
          className="grid gap-5 lg:[grid-template-columns:var(--editor-grid)]"
          style={
            {
              "--editor-grid": editorOpen
                ? `minmax(0,1fr) ${editorWidth}px`
                : "minmax(0,1fr) 72px",
            } as CSSProperties
          }
        >
          <div className="space-y-4">
            <div
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
              className={`relative ${
                canvasDragOver
                  ? "rounded-3xl border border-white/35 bg-white/10 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
                  : ""
              }`}
            >
              {canvasDragOver && rows.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border border-dashed border-white/30 bg-white/5 text-[12px] text-white/70">
                  Solta aqui para adicionar ao perfil
                </div>
              )}
              {rows.length === 0 ? (
                <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                  Sem módulos disponíveis neste momento.
                </div>
              ) : (
                <>
                  <Reorder.Group
                    axis="y"
                    values={rowIds}
                    onReorder={handleRowReorder}
                    className="space-y-6"
                  >
                    {rows.map((row, rowIndex) => {
                      const isSelected = selectedRowId === row.id;
                      const { rowStartIndex, rightInsertIndex } = getRowInsertIndices(
                        row,
                        rowIndex,
                      );
                      return (
                        <Reorder.Item
                          key={row.id}
                          value={row.id}
                          dragListener={canEdit && !row.isDraft}
                          className={canEdit && !row.isDraft ? "cursor-grab" : ""}
                        >
                          <div
                            className="relative space-y-3"
                            onClick={() => setSelectedRowId(row.id)}
                          >
                            {isSelected && (
                              <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/35 shadow-[0_0_0_1px_rgba(255,255,255,0.25)]" />
                            )}
                            <div
                              className={`grid gap-4 ${
                                row.columns === 2 ? "md:grid-cols-2" : "md:grid-cols-1"
                              }`}
                            >
                              {row.slots.map((slot, slotIndex) => {
                                const isEmpty = !slot;
                                const isActive =
                                  draggingModuleType &&
                                  dragTarget?.rowId === row.id &&
                                  dragTarget.slot === slotIndex;
                                const insertIndex = slotIndex === 0 ? rowStartIndex : rightInsertIndex;
                                const width: PublicProfileModuleWidth =
                                  row.columns === 2 ? "half" : "full";
                                return (
                                  <div
                                    key={`slot-${row.id}-${slotIndex}`}
                                    onDragOver={(event) => {
                                      if (!draggingModuleType || !isEmpty) return;
                                      event.preventDefault();
                                      setCanvasDragOver(true);
                                      setDragTarget({ rowId: row.id, slot: slotIndex });
                                    }}
                                    onDragLeave={(event) => {
                                      if (!isEmpty) return;
                                      const related = event.relatedTarget as Node | null;
                                      if (related && event.currentTarget.contains(related)) return;
                                      if (
                                        dragTarget?.rowId === row.id &&
                                        dragTarget.slot === slotIndex
                                      ) {
                                        setDragTarget(null);
                                      }
                                    }}
                                    onDrop={(event) => {
                                      if (!draggingModuleType || !isEmpty) return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const rawType = event.dataTransfer.getData("text/plain");
                                      const normalized =
                                        rawType?.trim().toUpperCase() || draggingModuleType || "";
                                      if (!normalized) return;
                                      if (!PUBLIC_PROFILE_MODULES.includes(normalized as PublicProfileModuleType)) {
                                        return;
                                      }
                                      addModuleToCanvasAt(
                                        normalized as PublicProfileModuleType,
                                        insertIndex,
                                        width,
                                      );
                                      if (row.isDraft) {
                                        removeDraftRow(row.id);
                                        setSelectedRowId(null);
                                      }
                                      setDraggingModuleType(null);
                                      clearDragTarget();
                                    }}
                                    onClick={(event) => {
                                      if (!slot) return;
                                      event.stopPropagation();
                                      setSelectedRowId(row.id);
                                      setExpandedModule(slot.type);
                                    }}
                                    className="relative"
                                  >
                                    {slot ? (
                                      <div className="pointer-events-none">
                                        {moduleContentByType[slot.type]}
                                      </div>
                                    ) : (
                                      <div
                                        className={`flex min-h-[140px] items-center justify-center rounded-3xl border border-dashed px-4 text-[12px] text-white/60 ${
                                          isActive
                                            ? "border-white/40 bg-white/10"
                                            : "border-white/15 bg-white/5"
                                        }`}
                                      >
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="text-[11px] text-white/70">Coluna livre</span>
                                          <span className="text-[10px] text-white/45">Solta um módulo</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                  {draggingModuleType && (
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        setCanvasDragOver(true);
                      }}
                      onDrop={(event) => {
                        if (!draggingModuleType) return;
                        event.preventDefault();
                        const rawType = event.dataTransfer.getData("text/plain");
                        const normalized =
                          rawType?.trim().toUpperCase() || draggingModuleType || "";
                        if (!normalized) return;
                        if (!PUBLIC_PROFILE_MODULES.includes(normalized as PublicProfileModuleType)) {
                          return;
                        }
                        addModuleToCanvasAt(
                          normalized as PublicProfileModuleType,
                          enabledModules.length,
                          "full",
                        );
                        setDraggingModuleType(null);
                        clearDragTarget();
                      }}
                      className="rounded-2xl border border-dashed border-white/25 bg-white/5 px-3 py-4 text-[11px] text-white/60"
                    >
                      Solta para criar nova linha
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="relative">
            {editorOpen && (
              <div
                onPointerDown={handleResizeStart}
                className="absolute -left-3 top-0 hidden h-full w-3 cursor-col-resize lg:flex"
                aria-hidden="true"
              >
                <div
                  className={`mx-auto h-full w-[2px] rounded-full ${
                    isResizingEditor ? "bg-white/35" : "bg-white/10"
                  }`}
                />
              </div>
            )}
            {editorOpen ? (
              <div className="space-y-4 lg:sticky lg:top-6">
                <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Personalização</p>
                      <p className="text-[12px] text-white/70">
                        {layoutDirty ? "Alterações por guardar." : "Layout guardado."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70"
                    >
                      Ocultar
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {publicProfileUrl && (
                      <a
                        href={publicProfileUrl}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/70 hover:bg-white/10"
                      >
                        Ver como público
                      </a>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleSaveLayout}
                        className={CTA_PRIMARY}
                        disabled={savingLayout || !layoutDirty}
                      >
                        {savingLayout ? "A guardar…" : "Guardar layout"}
                      </button>
                    )}
                  </div>
                  {layoutMessage && <p className="mt-3 text-[12px] text-white/70">{layoutMessage}</p>}
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Linhas</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    Cria linhas vazias e escolhe 1 ou 2 colunas.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addDraftRow(1)}
                      disabled={!canEdit}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 disabled:opacity-50"
                    >
                      Adicionar 1 coluna
                    </button>
                    <button
                      type="button"
                      onClick={() => addDraftRow(2)}
                      disabled={!canEdit}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 disabled:opacity-50"
                    >
                      Adicionar 2 colunas
                    </button>
                  </div>
                  {selectedRow ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
                          Linha selecionada
                        </p>
                        {selectedRow.row.isDraft && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                            Vazia
                          </span>
                        )}
                      </div>
                      <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 p-1">
                        <button
                          type="button"
                          onClick={() => setRowColumns(selectedRow.row, 1)}
                          disabled={!canEdit}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                            selectedRow.row.columns === 1
                              ? "bg-white/20 text-white"
                              : "text-white/60 hover:text-white"
                          }`}
                        >
                          1 coluna
                        </button>
                        <button
                          type="button"
                          onClick={() => setRowColumns(selectedRow.row, 2)}
                          disabled={!canEdit}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                            selectedRow.row.columns === 2
                              ? "bg-white/20 text-white"
                              : "text-white/60 hover:text-white"
                          }`}
                        >
                          2 colunas
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/60">
                        <button
                          type="button"
                          onClick={() => removeRow(selectedRow.row)}
                          disabled={!canEdit}
                          className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] text-white/70"
                        >
                          Remover linha
                        </button>
                        {selectedRow.row.columns === 2 &&
                          selectedRow.row.slots.some((slot) => !slot) && (
                            <span className="text-[10px] text-white/40">
                              Coluna livre pronta.
                            </span>
                          )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[12px] text-white/60">
                      Seleciona uma linha para ajustar colunas.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Módulos</p>
                  <p className="mt-2 text-[12px] text-white/70">
                    Arrasta para o perfil ou adiciona com um clique. Com uma linha selecionada, o módulo entra na coluna livre. Sem conteúdo publicado, o módulo fica oculto no público.
                  </p>
                  <div className="mt-3 space-y-2">
                    {availableModuleTypes.map((type) => {
                      const labels = MODULE_LABELS[type] ?? { title: type, description: "" };
                      const config = profileLayout.modules.find((module) => module.type === type);
                      const isEnabled = config?.enabled ?? false;
                      const isStoreModule = type === "LOJA";
                      const itemsCount = moduleStats[type] ?? 0;
                      const hasContent = itemsCount > 0;
                      const draftCount = isStoreModule ? storeDraftCount : 0;
                      const storeStatusLabel = !storeIsOpen
                        ? "Fechada"
                        : !storeShowOnProfile
                          ? "Oculta"
                          : "No perfil";
                      const statusLabel = isEnabled
                        ? hasContent
                          ? isStoreModule
                            ? storeStatusLabel
                            : "No perfil"
                          : draftCount > 0
                            ? "Rascunhos"
                            : "Sem conteúdo"
                        : "Disponível";
                      return (
                        <div
                          key={`library-${type}`}
                          draggable={canEdit && !isEnabled}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", type);
                            event.dataTransfer.effectAllowed = "move";
                            setDraggingModuleType(type);
                            clearDragTarget();
                          }}
                          onDragEnd={() => {
                            setDraggingModuleType(null);
                            clearDragTarget();
                          }}
                          onClick={() => setExpandedModule(type)}
                          className={`rounded-2xl border px-3 py-3 text-white/80 transition ${
                            isEnabled
                              ? "border-white/25 bg-white/10"
                              : "border-white/10 bg-white/5 hover:border-white/25"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{labels.title}</p>
                              {labels.description && (
                                <p className="text-[10px] text-white/60">{labels.description}</p>
                              )}
                            </div>
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                              {statusLabel}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/60">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                              {itemsCount} itens
                            </span>
                            {isStoreModule && draftCount > 0 && (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                {draftCount} rascunhos
                              </span>
                            )}
                            {isEnabled ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setModuleEnabled(type, false);
                                }}
                                disabled={!canEdit}
                                className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/70"
                              >
                                Remover
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleAddModule(type);
                                }}
                                disabled={!canEdit}
                                className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/70"
                              >
                                Adicionar
                              </button>
                            )}
                            {!isEnabled && (
                              <span className="text-[10px] text-white/40">Arrasta para o perfil</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {availableModuleTypes.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-[12px] text-white/60">
                        Ativa ferramentas para poderes personalizar o perfil.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Inspector</p>
                  {expandedModule ? (
                    (() => {
                      const selected =
                        profileLayout.modules.find((module) => module.type === expandedModule) ?? null;
                      if (!selected) {
                        return <p className="mt-3 text-[12px] text-white/60">Escolhe um módulo.</p>;
                      }
                      const settings = selected.settings ?? {};
                      const isAvailable = moduleAvailability[selected.type];
                      const inputsDisabled = !canEdit || !isAvailable;
                      const showStats = settings.showStats !== false;
                      const carouselEnabled = settings.carouselEnabled !== false;
                      const showSpotlight = settings.showSpotlight !== false;
                      const ctaLabel = typeof settings.ctaLabel === "string" ? settings.ctaLabel : "";
                      const ctaHref = typeof settings.ctaHref === "string" ? settings.ctaHref : "";
                      const reviewsMaxItems =
                        typeof settings.maxItems === "number" && Number.isFinite(settings.maxItems)
                          ? Math.max(1, Math.min(12, Math.floor(settings.maxItems)))
                          : 8;
                      return (
                        <div className="mt-3 space-y-3 text-[12px] text-white/70">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">
                              {MODULE_LABELS[selected.type]?.title ?? selected.type}
                            </p>
                            <button
                              type="button"
                              onClick={() => setModuleEnabled(selected.type, !selected.enabled)}
                              disabled={!canEdit || (selected.enabled === false && !isAvailable)}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                selected.enabled
                                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                                  : "border-white/20 bg-white/5 text-white/60"
                              }`}
                            >
                              {selected.enabled ? "Ativo" : "Inativo"}
                            </button>
                          </div>
                          {!isAvailable && (
                            <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/60">
                              Ativa a ferramenta correspondente para usar este módulo.
                            </p>
                          )}
                          {selected.type === "SERVICOS" && (
                            <div className="space-y-3">
                              <label className="space-y-1">
                                <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                                  Texto do CTA
                                </span>
                                <input
                                  type="text"
                                  value={ctaLabel}
                                  onChange={(event) =>
                                    updateModuleSettings("SERVICOS", { ctaLabel: event.target.value })
                                  }
                                  disabled={inputsDisabled}
                                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                                  placeholder="Agendar"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                                  Destino do CTA
                                </span>
                                <input
                                  type="text"
                                  value={ctaHref}
                                  onChange={(event) =>
                                    updateModuleSettings("SERVICOS", { ctaHref: event.target.value })
                                  }
                                  disabled={inputsDisabled}
                                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                                  placeholder="#reservar"
                                />
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={showStats}
                                  onChange={(event) =>
                                    updateModuleSettings("SERVICOS", { showStats: event.target.checked })
                                  }
                                  disabled={inputsDisabled}
                                  className="h-4 w-4 rounded border-white/40 bg-black/40"
                                />
                                Mostrar estatísticas
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={carouselEnabled}
                                  onChange={(event) =>
                                    updateModuleSettings("SERVICOS", { carouselEnabled: event.target.checked })
                                  }
                                  disabled={inputsDisabled}
                                  className="h-4 w-4 rounded border-white/40 bg-black/40"
                                />
                                Carrossel ativo
                              </label>
                              <div className="space-y-2">
                                <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">
                                  Serviços em destaque
                                </p>
                                {!servicesModuleEnabled ? (
                                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/60">
                                    Ativa o módulo de serviços para escolher destaques.
                                  </p>
                                ) : activeServices.length === 0 ? (
                                  <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/60">
                                    Sem serviços ativos para destacar.
                                  </p>
                                ) : (
                                  <>
                                    <div className="flex flex-wrap gap-2">
                                      {activeServices.map((service) => {
                                        const isFeatured = featuredServiceIds.includes(service.id);
                                        return (
                                          <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => toggleFeaturedService(service.id)}
                                            disabled={!canEdit || !isAvailable}
                                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                              isFeatured
                                                ? "border-white/40 bg-white/20 text-white"
                                                : "border-white/15 bg-white/5 text-white/70"
                                            } ${!canEdit ? "opacity-60" : ""}`}
                                          >
                                            {service.title}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {featuredServiceIds.length > 0 && (
                                      <div className="pt-2">
                                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">
                                          Ordem dos destaques
                                        </p>
                                        <Reorder.Group
                                          axis="y"
                                          values={featuredServiceIds}
                                          onReorder={(nextIds) => setFeaturedServiceIds(nextIds)}
                                          className="mt-2 space-y-2"
                                        >
                                          {featuredServiceIds.map((serviceId) => {
                                            const service = servicesById.get(serviceId);
                                            if (!service) return null;
                                            return (
                                              <Reorder.Item
                                                key={serviceId}
                                                value={serviceId}
                                                dragListener={canEdit}
                                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80"
                                              >
                                                <span>{service.title}</span>
                                                <span className={`text-[12px] ${canEdit ? "text-white/50" : "text-white/30"}`}>
                                                  ⋮⋮
                                                </span>
                                              </Reorder.Item>
                                            );
                                          })}
                                        </Reorder.Group>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          {selected.type === "AGENDA" && (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={showSpotlight}
                                onChange={(event) =>
                                  updateModuleSettings("AGENDA", { showSpotlight: event.target.checked })
                                }
                                disabled={inputsDisabled}
                                className="h-4 w-4 rounded border-white/40 bg-black/40"
                              />
                              Mostrar destaque no topo
                            </label>
                          )}
                          {selected.type === "FORMULARIOS" && (
                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                                Texto do CTA
                              </span>
                              <input
                                type="text"
                                value={ctaLabel}
                                onChange={(event) =>
                                  updateModuleSettings("FORMULARIOS", { ctaLabel: event.target.value })
                                }
                                disabled={inputsDisabled}
                                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                                placeholder="Responder"
                              />
                            </label>
                          )}
                          {selected.type === "AVALIACOES" && (
                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                                Máximo de cartões
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={reviewsMaxItems}
                                onChange={(event) =>
                                  updateModuleSettings("AVALIACOES", { maxItems: Number(event.target.value) })
                                }
                                disabled={inputsDisabled}
                                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                              />
                            </label>
                          )}
                          {selected.type === "SOBRE" && (
                            <p className="text-[12px] text-white/60">Sem definições extra por agora.</p>
                          )}
                          {selected.type === "LOJA" && (
                            <p className="text-[12px] text-white/60">
                              A Loja aparece no perfil quando estiver aberta e com produtos publicados.
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <p className="mt-3 text-[12px] text-white/60">
                      Seleciona um módulo na biblioteca ou no canvas para o configurar.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="sticky top-6">
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-[11px] uppercase tracking-[0.22em] text-white/70"
                >
                  Abrir
                </button>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4 20l4.5-1 9.2-9.2a2.5 2.5 0 0 0 0-3.5l-.9-.9a2.5 2.5 0 0 0-3.5 0L4 14.6V20z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6.5l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
