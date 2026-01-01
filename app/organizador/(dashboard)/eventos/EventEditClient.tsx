"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import useSWR from "swr";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { useUser } from "@/app/hooks/useUser";
import { CTA_PRIMARY } from "@/app/organizador/dashboardUi";

const TicketTypeStatus = {
  ON_SALE: "ON_SALE",
  UPCOMING: "UPCOMING",
  CLOSED: "CLOSED",
  SOLD_OUT: "SOLD_OUT",
} as const;

type TicketTypeStatus = (typeof TicketTypeStatus)[keyof typeof TicketTypeStatus];

type PublicAccessMode = "OPEN" | "TICKET" | "INVITE";
type ParticipantAccessMode = "NONE" | "TICKET" | "INSCRIPTION" | "INVITE";
type TicketScope = "ALL" | "SPECIFIC";
type LiveHubVisibility = "PUBLIC" | "PRIVATE" | "DISABLED";

type ToastTone = "success" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

type TicketTypeUI = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  totalQuantity: number | null;
  soldQuantity: number;
  status: TicketTypeStatus;
  startsAt: string | null;
  endsAt: string | null;
  padelEventCategoryLinkId?: number | null;
  padelCategoryLabel?: string | null;
};

type PadelCategoryLink = {
  id: number;
  padelCategoryId: number;
  format?: string | null;
  capacityTeams?: number | null;
  capacityPlayers?: number | null;
  liveStreamUrl?: string | null;
  isEnabled: boolean;
  isHidden: boolean;
  category?: {
    id: number;
    label: string | null;
  } | null;
};

type PadelCategoryOption = {
  id: number;
  label: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
};

type PadelCategoryDraft = {
  isEnabled: boolean;
  isHidden: boolean;
  capacityTeams: string;
};

type EventEditClientProps = {
  event: {
    id: number;
    organizerId: number | null;
    slug: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    locationName: string | null;
    locationCity: string | null;
    address: string | null;
    templateType: string | null;
    isFree: boolean;
    inviteOnly: boolean;
    coverImageUrl: string | null;
    liveHubVisibility: LiveHubVisibility;
    liveStreamUrl: string | null;
    publicAccessMode: PublicAccessMode;
    participantAccessMode: ParticipantAccessMode;
    publicTicketTypeIds: number[];
    participantTicketTypeIds: number[];
    payoutMode?: string | null;
  };
  tickets: TicketTypeUI[];
  eventHasTickets?: boolean;
};

type EventInvite = {
  id: number;
  targetIdentifier: string;
  targetUserId?: string | null;
  scope?: "PUBLIC" | "PARTICIPANT";
  createdAt?: string;
  targetUser?: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function EventEditClient({ event, tickets }: EventEditClientProps) {
  const { user, profile } = useUser();
  const { data: organizerStatus } = useSWR<{ paymentsStatus?: string }>(
    user ? "/api/organizador/me" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(event.startsAt);
  const [endsAt, setEndsAt] = useState(event.endsAt);
  const [locationName, setLocationName] = useState(event.locationName ?? "");
  const [locationCity, setLocationCity] = useState(event.locationCity ?? "");
  const [address, setAddress] = useState(event.address ?? "");
  const [templateType] = useState(event.templateType ?? "OTHER");
  const isPadel = templateType === "PADEL";
  const organizerId = event.organizerId ?? null;
  const [isFree] = useState(event.isFree);
  const [coverUrl, setCoverUrl] = useState<string | null>(event.coverImageUrl);
  const [liveHubVisibility, setLiveHubVisibility] = useState<LiveHubVisibility>(
    event.liveHubVisibility ?? "PUBLIC",
  );
  const [liveStreamUrl, setLiveStreamUrl] = useState(event.liveStreamUrl ?? "");
  const [publicAccessMode, setPublicAccessMode] = useState<PublicAccessMode>(event.publicAccessMode ?? "OPEN");
  const [participantAccessMode, setParticipantAccessMode] = useState<ParticipantAccessMode>(
    event.participantAccessMode ?? "NONE",
  );
  const [publicTicketTypeIds, setPublicTicketTypeIds] = useState<number[]>(event.publicTicketTypeIds ?? []);
  const [participantTicketTypeIds, setParticipantTicketTypeIds] = useState<number[]>(
    event.participantTicketTypeIds ?? [],
  );
  const { data: padelEventCategories, mutate: mutatePadelEventCategories } = useSWR<{ ok?: boolean; items?: PadelCategoryLink[] }>(
    isPadel ? `/api/padel/event-categories?eventId=${event.id}` : null,
    fetcher,
  );
  const { data: padelCategoriesData } = useSWR<{ ok?: boolean; items?: PadelCategoryOption[] }>(
    isPadel && organizerId ? `/api/padel/categories/my?organizerId=${organizerId}` : null,
    fetcher,
  );
  const padelCategoryLinks = Array.isArray(padelEventCategories?.items) ? padelEventCategories?.items ?? [] : [];
  const activePadelCategoryLinks = padelCategoryLinks.filter((link) => link.isEnabled);
  const padelCategories = Array.isArray(padelCategoriesData?.items) ? padelCategoriesData?.items ?? [] : [];
  const [padelCategoryDrafts, setPadelCategoryDrafts] = useState<Record<number, PadelCategoryDraft>>({});
  const [padelCategoryAddId, setPadelCategoryAddId] = useState("");
  const [padelCategorySaving, setPadelCategorySaving] = useState(false);
  const [padelCategoryError, setPadelCategoryError] = useState<string | null>(null);
  const [publicTicketScope, setPublicTicketScope] = useState<TicketScope>(
    event.publicTicketTypeIds && event.publicTicketTypeIds.length > 0 ? "SPECIFIC" : "ALL",
  );
  const [participantTicketScope, setParticipantTicketScope] = useState<TicketScope>(
    event.participantTicketTypeIds && event.participantTicketTypeIds.length > 0 ? "SPECIFIC" : "ALL",
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [ticketList, setTicketList] = useState<TicketTypeUI[]>(tickets);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"title" | "startsAt" | "endsAt" | "locationCity" | "locationName", string>>>({});
  const [errorSummary, setErrorSummary] = useState<{ field: string; message: string }[]>([]);
  const [publicInviteInput, setPublicInviteInput] = useState("");
  const [participantInviteInput, setParticipantInviteInput] = useState("");
  const [publicInviteError, setPublicInviteError] = useState<string | null>(null);
  const [participantInviteError, setParticipantInviteError] = useState<string | null>(null);
  const [publicInviteSaving, setPublicInviteSaving] = useState(false);
  const [participantInviteSaving, setParticipantInviteSaving] = useState(false);
  const [inviteRemovingId, setInviteRemovingId] = useState<number | null>(null);
  const { data: publicInvitesData, mutate: mutatePublicInvites, isLoading: publicInvitesLoading } = useSWR<{
    ok?: boolean;
    items?: EventInvite[];
  }>(user ? `/api/organizador/events/${event.id}/invites?scope=PUBLIC` : null, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: participantInvitesData, mutate: mutateParticipantInvites, isLoading: participantInvitesLoading } = useSWR<{
    ok?: boolean;
    items?: EventInvite[];
  }>(user ? `/api/organizador/events/${event.id}/invites?scope=PARTICIPANT` : null, fetcher, {
    revalidateOnFocus: false,
  });
  const publicInvites = useMemo(
    () => (Array.isArray(publicInvitesData?.items) ? publicInvitesData.items : []),
    [publicInvitesData?.items],
  );
  const participantInvites = useMemo(
    () => (Array.isArray(participantInvitesData?.items) ? participantInvitesData.items : []),
    [participantInvitesData?.items],
  );
  const steps = useMemo(
    () =>
      isFree
        ? [
            { key: "base", label: "Essenciais", desc: "Imagem e localização" },
            { key: "dates", label: "Datas & Local", desc: "Início e fim" },
            { key: "summary", label: "Revisão", desc: "Confirmar e guardar" },
          ]
        : [
            { key: "base", label: "Essenciais", desc: "Imagem e localização" },
            { key: "dates", label: "Datas & Local", desc: "Início e fim" },
            { key: "tickets", label: "Bilhetes / Inscrições", desc: "Gestão e vendas" },
          ],
    [isFree],
  );
  const freeCapacity = useMemo(() => {
    if (!isFree) return null;
    const total = ticketList.reduce((sum, t) => {
      if (t.totalQuantity == null) return sum;
      return sum + t.totalQuantity;
    }, 0);
    return total > 0 ? total : null;
  }, [isFree, ticketList]);

  const [newTicket, setNewTicket] = useState({
    name: "",
    description: "",
    priceEuro: "",
    totalQuantity: "",
    startsAt: "",
    endsAt: "",
    padelEventCategoryLinkId: "",
  });

  const [endingIds, setEndingIds] = useState<number[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeAlert, setStripeAlert] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [backendAlert, setBackendAlert] = useState<string | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const startsRef = useRef<HTMLDivElement | null>(null);
  const endsRef = useRef<HTMLDivElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const locationNameRef = useRef<HTMLInputElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (message: string, tone: ToastTone = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  };
  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
  const payoutMode = (event.payoutMode ?? "ORGANIZER").toUpperCase();
  const isPlatformPayout = payoutMode === "PLATFORM";
  const paymentsStatusRaw = isAdmin ? "READY" : organizerStatus?.paymentsStatus ?? "NO_STRIPE";
  const paymentsStatus = isPlatformPayout ? "READY" : paymentsStatusRaw;
  const hasPaidTicket = useMemo(
    () =>
      ticketList.some((t) => t.price > 0 && t.status !== TicketTypeStatus.CLOSED) ||
      (newTicket.priceEuro && Number(newTicket.priceEuro.replace(",", ".")) > 0),
    [ticketList, newTicket.priceEuro],
  );
  const templateLabel = templateType === "PADEL" ? "Padel" : "Evento padrão";
  const liveHubPreviewUrl = `/eventos/${event.slug}/live`;

  useEffect(() => {
    if (!isPadel) return;
    const nextDrafts: Record<number, PadelCategoryDraft> = {};
    padelCategoryLinks.forEach((link) => {
      nextDrafts[link.padelCategoryId] = {
        isEnabled: link.isEnabled,
        isHidden: link.isHidden ?? false,
        capacityTeams: typeof link.capacityTeams === "number" ? String(link.capacityTeams) : "",
      };
    });
    setPadelCategoryDrafts(nextDrafts);
  }, [isPadel, padelCategoryLinks]);

  const availablePadelCategories = useMemo(() => {
    const linkedIds = new Set(padelCategoryLinks.map((link) => link.padelCategoryId));
    return padelCategories.filter((cat) => !linkedIds.has(cat.id));
  }, [padelCategories, padelCategoryLinks]);

  const toggleTicketType = (
    id: number,
    setList: Dispatch<SetStateAction<number[]>>,
  ) => {
    setList((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const updatePadelCategoryDraft = (categoryId: number, patch: Partial<PadelCategoryDraft>) => {
    setPadelCategoryDrafts((prev) => {
      const current = prev[categoryId] ?? { isEnabled: true, isHidden: false, capacityTeams: "" };
      return { ...prev, [categoryId]: { ...current, ...patch } };
    });
  };

  const handleSavePadelCategories = async () => {
    if (!isPadel || padelCategoryLinks.length === 0) return;
    setPadelCategorySaving(true);
    setPadelCategoryError(null);
    const linksPayload = padelCategoryLinks.map((link) => {
      const draft = padelCategoryDrafts[link.padelCategoryId];
      const rawCapacity = draft?.capacityTeams ?? "";
      const capacityValue = rawCapacity.trim() === "" ? null : Number(rawCapacity);
      return {
        padelCategoryId: link.padelCategoryId,
        isEnabled: draft?.isEnabled ?? link.isEnabled,
        isHidden: draft?.isHidden ?? link.isHidden,
        capacityTeams: Number.isFinite(capacityValue) && (capacityValue as number) > 0 ? Math.floor(capacityValue as number) : null,
      };
    });

    try {
      const res = await fetch("/api/padel/event-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, links: linksPayload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível guardar categorias.");
      }
      await mutatePadelEventCategories();
      pushToast("Categorias Padel atualizadas.", "success");
    } catch (err) {
      setPadelCategoryError(err instanceof Error ? err.message : "Erro ao guardar categorias.");
    } finally {
      setPadelCategorySaving(false);
    }
  };

  const handleAddPadelCategory = async () => {
    if (!isPadel) return;
    const categoryId = Number(padelCategoryAddId);
    if (!Number.isFinite(categoryId)) {
      setPadelCategoryError("Seleciona uma categoria válida.");
      return;
    }
    setPadelCategorySaving(true);
    setPadelCategoryError(null);
    try {
      const res = await fetch("/api/padel/event-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          links: [{ padelCategoryId: categoryId, isEnabled: true }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível adicionar a categoria.");
      }
      setPadelCategoryAddId("");
      await mutatePadelEventCategories();
      pushToast("Categoria adicionada ao evento.", "success");
    } catch (err) {
      setPadelCategoryError(err instanceof Error ? err.message : "Erro ao adicionar categoria.");
    } finally {
      setPadelCategorySaving(false);
    }
  };

  const showInviteSection = publicAccessMode === "INVITE" || participantAccessMode === "INVITE";
  const publicAccessSummary =
    publicAccessMode === "OPEN"
      ? "Aberto ao público"
      : publicAccessMode === "TICKET"
        ? "Acesso por bilhete"
        : "Apenas por convite";
  const participantSummary =
    participantAccessMode === "NONE"
      ? "Sem participantes"
      : participantAccessMode === "TICKET"
        ? "Participantes por bilhete"
        : participantAccessMode === "INSCRIPTION"
          ? "Participantes por inscrição"
          : "Participantes por convite";
  const publicAccessDescription =
    publicAccessMode === "OPEN"
      ? "Qualquer pessoa pode ver o evento e comprar bilhete."
      : publicAccessMode === "TICKET"
        ? publicTicketScope === "SPECIFIC"
          ? "Só quem tem bilhetes selecionados pode aceder ao público."
          : "Qualquer bilhete do evento dá acesso ao público."
        : "Apenas convidados conseguem aceder ao checkout e ao LiveHub.";
  const participantAccessDescription =
    participantAccessMode === "NONE"
      ? "Não existe distinção de participantes."
      : participantAccessMode === "INSCRIPTION"
        ? "Participantes são definidos por inscrição/torneio."
        : participantAccessMode === "TICKET"
          ? participantTicketScope === "SPECIFIC"
            ? "Participantes apenas com bilhetes selecionados."
            : "Qualquer bilhete marca o utilizador como participante."
          : "Participantes são escolhidos por convite.";
  const accessWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (publicAccessMode === "TICKET") {
      if (ticketList.length === 0) {
        warnings.push("Sem bilhetes criados: ninguém conseguirá entrar como público.");
      } else if (publicTicketScope === "SPECIFIC" && publicTicketTypeIds.length === 0) {
        warnings.push("Seleciona pelo menos um tipo de bilhete para o público.");
      }
    }
    if (participantAccessMode === "TICKET") {
      if (ticketList.length === 0) {
        warnings.push("Sem bilhetes criados: ninguém será marcado como participante.");
      } else if (participantTicketScope === "SPECIFIC" && participantTicketTypeIds.length === 0) {
        warnings.push("Seleciona pelo menos um tipo de bilhete para os participantes.");
      }
    }
    if (publicAccessMode === "INVITE" && !publicInvitesLoading && publicInvites.length === 0) {
      warnings.push("Sem convites de público: ninguém convidado consegue entrar.");
    }
    if (participantAccessMode === "INVITE" && !participantInvitesLoading && participantInvites.length === 0) {
      warnings.push("Sem convites de participantes: ninguém será marcado como participante.");
    }
    return warnings;
  }, [
    publicAccessMode,
    participantAccessMode,
    ticketList.length,
    publicTicketScope,
    participantTicketScope,
    publicTicketTypeIds.length,
    participantTicketTypeIds.length,
    publicInvites.length,
    participantInvites.length,
    publicInvitesLoading,
    participantInvitesLoading,
  ]);

  const inviteGroups = [
    {
      scope: "PUBLIC" as const,
      enabled: publicAccessMode === "INVITE",
      title: "Convites do público",
      description: "Quem pode ver o checkout e o LiveHub público.",
      footer: "Convites por email permitem checkout como convidado. Eventos grátis continuam a exigir conta e username.",
      input: publicInviteInput,
      setInput: setPublicInviteInput,
      error: publicInviteError,
      isSaving: publicInviteSaving,
      invites: publicInvites,
      isLoading: publicInvitesLoading,
    },
    {
      scope: "PARTICIPANT" as const,
      enabled: participantAccessMode === "INVITE",
      title: "Convites de participantes",
      description: "Quem fica marcado como participante/atleta.",
      footer: "Usa convites de participantes quando queres atletas específicos.",
      input: participantInviteInput,
      setInput: setParticipantInviteInput,
      error: participantInviteError,
      isSaving: participantInviteSaving,
      invites: participantInvites,
      isLoading: participantInvitesLoading,
    },
  ].filter((group) => group.enabled);
  const FormAlert = ({
    variant,
    title,
    message,
  }: {
    variant: "error" | "warning" | "success";
    title?: string;
    message: string;
  }) => {
    const tones =
      variant === "error"
        ? "border-red-500/40 bg-red-500/10 text-red-100"
        : variant === "warning"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/40 bg-emerald-500/10 text-emerald-50";
    return (
      <div className={`rounded-md border px-4 py-3 text-sm ${tones}`}>
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
      </div>
    );
  };

  const focusField = (field: string) => {
    const target =
      field === "title"
        ? titleRef.current
        : field === "startsAt"
          ? (startsRef.current?.querySelector("button") as HTMLElement | null)
        : field === "endsAt"
            ? (endsRef.current?.querySelector("button") as HTMLElement | null)
            : field === "locationCity"
              ? cityRef.current
              : field === "locationName"
                ? locationNameRef.current
                : null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  const applyErrors = (issues: { field: string; message: string }[]) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      issues.forEach((issue) => {
        next[issue.field as keyof typeof next] = issue.message;
      });
      return next;
    });
    setErrorSummary(issues);
    if (issues.length > 0) {
      setTimeout(() => errorSummaryRef.current?.focus({ preventScroll: false }), 40);
    }
  };

  const clearErrorsForFields = (fields: string[]) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      fields.forEach((f) => delete next[f as keyof typeof next]);
      return next;
    });
    setErrorSummary((prev) => prev.filter((err) => !fields.includes(err.field)));
  };

  const collectErrors = (step: number | "all") => {
    const stepsToCheck = step === "all" ? [0, 1] : [step];
    const issues: { field: string; message: string }[] = [];

    stepsToCheck.forEach((idx) => {
      if (idx === 0) {
        if (!title.trim()) issues.push({ field: "title", message: "Título obrigatório." });
        if (!locationName.trim()) issues.push({ field: "locationName", message: "Local obrigatório." });
        if (!locationCity.trim()) issues.push({ field: "locationCity", message: "Cidade obrigatória." });
      }
      if (idx === 1) {
        if (!startsAt) issues.push({ field: "startsAt", message: "Data/hora de início obrigatória." });
        if (endsAt && startsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
          issues.push({ field: "endsAt", message: "A data/hora de fim tem de ser depois do início." });
        }
      }
    });

    return issues;
  };

  const validateStep = (step: number) => {
    const issues = collectErrors(step);
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos assinalados antes de continuar.");
      setError(issues[0]?.message ?? null);
      return false;
    }
    clearErrorsForFields(step === 0 ? ["title", "locationCity", "locationName"] : ["startsAt", "endsAt"]);
    setValidationAlert(null);
    setError(null);
    return true;
  };

  useEffect(() => {
    if (title.trim()) clearErrorsForFields(["title"]);
  }, [title]);

  useEffect(() => {
    if (locationName.trim()) clearErrorsForFields(["locationName"]);
  }, [locationName]);

  useEffect(() => {
    if (locationCity.trim()) clearErrorsForFields(["locationCity"]);
  }, [locationCity]);

  useEffect(() => {
    if (startsAt) clearErrorsForFields(["startsAt"]);
  }, [startsAt]);

  useEffect(() => {
    if (!endsAt) {
      clearErrorsForFields(["endsAt"]);
      return;
    }
    if (startsAt && new Date(endsAt).getTime() >= new Date(startsAt).getTime()) {
      clearErrorsForFields(["endsAt"]);
    }
  }, [endsAt, startsAt]);

  const goNext = () => {
    const ok = validateStep(currentStep);
    if (!ok) return;
    if (currentStep < steps.length - 1) {
      setValidationAlert(null);
      setError(null);
      setErrorSummary([]);
      setCurrentStep((s) => s + 1);
    } else {
      handleSave();
    }
  };

  const goPrev = () => {
    setValidationAlert(null);
    setError(null);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=event-cover", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro upload cover", err);
      setError("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleAddInvite = async (scope: "PUBLIC" | "PARTICIPANT") => {
    const isPublic = scope === "PUBLIC";
    const value = isPublic ? publicInviteInput.trim() : participantInviteInput.trim();
    const setError = isPublic ? setPublicInviteError : setParticipantInviteError;
    const setSaving = isPublic ? setPublicInviteSaving : setParticipantInviteSaving;
    const resetInput = isPublic ? () => setPublicInviteInput("") : () => setParticipantInviteInput("");
    const mutate = isPublic ? mutatePublicInvites : mutateParticipantInvites;

    if (!value) {
      setError("Indica um email ou @username.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizador/events/${event.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: value, scope }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar convite.");
      }
      resetInput();
      await mutate();
      pushToast("Convite adicionado.", "success");
    } catch (err) {
      console.error("Erro ao criar convite", err);
      const message = err instanceof Error ? err.message : "Erro ao criar convite.";
      setError(message);
      pushToast(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveInvite = async (inviteId: number, scope: "PUBLIC" | "PARTICIPANT") => {
    setInviteRemovingId(inviteId);
    const setError = scope === "PUBLIC" ? setPublicInviteError : setParticipantInviteError;
    const mutate = scope === "PUBLIC" ? mutatePublicInvites : mutateParticipantInvites;
    setError(null);
    try {
      const res = await fetch(`/api/organizador/events/${event.id}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover convite.");
      }
      await mutate();
      pushToast("Convite removido.", "success");
    } catch (err) {
      console.error("Erro ao remover convite", err);
      const message = err instanceof Error ? err.message : "Erro ao remover convite.";
      setError(message);
      pushToast(message);
    } finally {
      setInviteRemovingId(null);
    }
  };

  const handleSave = async () => {
    setStripeAlert(null);
    setValidationAlert(null);
    setBackendAlert(null);
    setError(null);
    setMessage(null);

    const issues = collectErrors("all");
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos assinalados antes de guardar o evento.");
      setError(issues[0]?.message ?? null);
      return;
    }
    clearErrorsForFields(["title", "locationCity", "locationName", "startsAt", "endsAt"]);

    if (hasPaidTicket && paymentsStatus !== "READY") {
      setStripeAlert("Podes gerir o evento, mas só vender bilhetes pagos depois de ligares o Stripe.");
      setError("Liga o Stripe em Finanças & Payouts para vender bilhetes pagos.");
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const publicTicketTypeIdsToSend =
      publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC" ? publicTicketTypeIds : [];
    const participantTicketTypeIdsToSend =
      participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC"
        ? participantTicketTypeIds
        : [];

    if (publicAccessMode === "TICKET") {
      if (ticketList.length === 0) {
        setValidationAlert("Cria pelo menos um bilhete antes de definir acesso por bilhete.");
        pushToast("Cria bilhetes para o acesso do público.");
        return;
      }
      if (publicTicketScope === "SPECIFIC" && publicTicketTypeIds.length === 0) {
        setValidationAlert("Seleciona pelo menos um tipo de bilhete para o acesso do público.");
        pushToast("Seleciona bilhetes para o acesso do público.");
        return;
      }
    }
    if (participantAccessMode === "TICKET") {
      if (ticketList.length === 0) {
        setValidationAlert("Cria pelo menos um bilhete antes de definir participantes por bilhete.");
        pushToast("Cria bilhetes para participantes.");
        return;
      }
      if (participantTicketScope === "SPECIFIC" && participantTicketTypeIds.length === 0) {
        setValidationAlert("Seleciona pelo menos um tipo de bilhete para os participantes.");
        pushToast("Seleciona bilhetes para participantes.");
        return;
      }
    }
    if (
      isPadel &&
      newTicket.name.trim() &&
      newTicket.priceEuro &&
      activePadelCategoryLinks.length > 0 &&
      !newTicket.padelEventCategoryLinkId
    ) {
      setValidationAlert("Seleciona uma categoria Padel para o novo bilhete.");
      pushToast("Seleciona a categoria do bilhete.");
      return;
    }

    setIsSaving(true);
    try {
      const ticketTypeUpdates = endingIds.map((id) => ({
        id,
        status: TicketTypeStatus.CLOSED,
      }));

      const newTicketsPayload =
        newTicket.name.trim() && newTicket.priceEuro
          ? [
              {
                name: newTicket.name.trim(),
                description: newTicket.description?.trim() || null,
                price: Math.round(Number(newTicket.priceEuro.replace(",", ".")) * 100) || 0,
                totalQuantity: newTicket.totalQuantity
                  ? Number(newTicket.totalQuantity)
                  : null,
                startsAt: newTicket.startsAt || null,
                endsAt: newTicket.endsAt || null,
                padelEventCategoryLinkId: newTicket.padelEventCategoryLinkId
                  ? Number(newTicket.padelEventCategoryLinkId)
                  : null,
              },
            ]
          : [];

      const res = await fetch("/api/organizador/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          title,
          description,
          startsAt,
          endsAt,
          locationName,
          locationCity,
          address,
          templateType,
          isFree,
          inviteOnly: publicAccessMode === "INVITE",
          coverImageUrl: coverUrl,
          liveHubVisibility,
          liveStreamUrl: liveStreamUrl.trim() || null,
          publicAccessMode,
          participantAccessMode,
          publicTicketTypeIds: publicTicketTypeIdsToSend,
          participantTicketTypeIds: participantTicketTypeIdsToSend,
          ticketTypeUpdates,
          newTicketTypes: newTicketsPayload,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar evento.");
      }

      setMessage("Evento atualizado com sucesso.");
      pushToast("Evento atualizado com sucesso.", "success");
      setEndingIds([]);
      if (ticketTypeUpdates.length > 0) {
        setTicketList((prev) =>
          prev.map((t) =>
            endingIds.includes(t.id) ? { ...t, status: TicketTypeStatus.CLOSED } : t
          )
        );
      }
      if (newTicketsPayload.length > 0) {
        // Não temos ID do novo ticket aqui, mas podemos forçar refresh manual ou deixar como está.
        // Para feedback imediato, adicionamos placeholder sem ID real.
        const padelLinkId = newTicketsPayload[0].padelEventCategoryLinkId ?? null;
        const padelLabel = padelCategoryLinks.find((link) => link.id === padelLinkId)?.category?.label ?? null;
        setTicketList((prev) => [
          ...prev,
          {
            id: Date.now(), // placeholder local
            name: newTicketsPayload[0].name,
            description: newTicketsPayload[0].description ?? null,
            price: newTicketsPayload[0].price,
            currency: "EUR",
            totalQuantity: newTicketsPayload[0].totalQuantity ?? null,
            soldQuantity: 0,
            status: TicketTypeStatus.ON_SALE,
            startsAt: newTicketsPayload[0].startsAt,
            endsAt: newTicketsPayload[0].endsAt,
            padelEventCategoryLinkId: padelLinkId,
            padelCategoryLabel: padelLabel,
          },
        ]);
      }
      setNewTicket({
        name: "",
        description: "",
        priceEuro: "",
        totalQuantity: "",
        startsAt: "",
        endsAt: "",
        padelEventCategoryLinkId: "",
      });
      setErrorSummary([]);
      setFieldErrors({});
      setMessage("Evento atualizado com sucesso.");
    } catch (err) {
      console.error("Erro ao atualizar evento", err);
      setBackendAlert(err instanceof Error ? err.message : "Erro ao atualizar evento.");
      pushToast(err instanceof Error ? err.message : "Erro ao atualizar evento.");
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setIsSaving(false);
    }
  };

  const openConfirmEnd = (id: number) => {
    setConfirmId(id);
    setConfirmText("");
  };

  const confirmEnd = async () => {
    if (!confirmId) return;
    if (confirmText.trim().toUpperCase() !== "TERMINAR VENDA") {
      setError('Escreve "TERMINAR VENDA" para confirmar.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organizador/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeUpdates: [{ id: confirmId, status: TicketTypeStatus.CLOSED }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao terminar venda.");
      }
      setTicketList((prev) =>
        prev.map((t) => (t.id === confirmId ? { ...t, status: TicketTypeStatus.CLOSED } : t)),
      );
      setMessage("Venda terminada para este bilhete.");
      pushToast("Venda terminada para este bilhete.", "success");
    } catch (err) {
      console.error("Erro ao terminar venda", err);
      setError(err instanceof Error ? err.message : "Erro ao terminar venda.");
      pushToast(err instanceof Error ? err.message : "Erro ao terminar venda.");
    } finally {
      setIsSaving(false);
      setConfirmId(null);
      setConfirmText("");
    }
  };

  const progress = steps.length > 1 ? Math.min(100, (currentStep / (steps.length - 1)) * 100) : 100;

  const renderStepContent = () => {
    const baseBlock = (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Imagem de capa</label>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="h-32 w-48 rounded-xl border border-white/15 bg-black/30 overflow-hidden flex items-center justify-center text-[11px] text-white/60">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
              ) : (
                <span>Sem imagem</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
                  <span>{coverUrl ? "Substituir imagem" : "Adicionar imagem de capa"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  disabled={uploadingCover || !coverUrl}
                  onClick={() => setCoverUrl(null)}
                  className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 hover:bg-white/10 disabled:opacity-60"
                >
                  Remover imagem
                </button>
              </div>
              {uploadingCover && <span className="text-[11px] text-white/60">A carregar imagem…</span>}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Título *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            ref={titleRef}
            aria-invalid={Boolean(fieldErrors.title)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
          {fieldErrors.title && (
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
              <span aria-hidden>⚠️</span>
              {fieldErrors.title}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
        </div>

        <div id="livehub" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">LiveHub</p>
              <p className="text-sm text-white/80">Configura visibilidade e stream do LiveHub.</p>
            </div>
            <a
              href={liveHubPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/80 hover:border-white/40"
            >
              Abrir LiveHub
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Visibilidade</label>
              <select
                value={liveHubVisibility}
                onChange={(e) => setLiveHubVisibility(e.target.value as LiveHubVisibility)}
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
              >
                <option value="PUBLIC">Público</option>
                <option value="PRIVATE">Privado (só participantes)</option>
                <option value="DISABLED">Desativado</option>
              </select>
              <p className="text-[11px] text-white/55">
                Público é sempre visível; privado mostra apenas a participantes; desativado oculta o LiveHub.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">URL da livestream</label>
              <input
                value={liveStreamUrl}
                onChange={(e) => setLiveStreamUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
              />
              <p className="text-[11px] text-white/55">Se vazio, o LiveHub mostra o módulo de vídeo como indisponível.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Local *</label>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              ref={locationNameRef}
              aria-invalid={Boolean(fieldErrors.locationName)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
            {fieldErrors.locationName && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.locationName}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Cidade *</label>
            <input
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              ref={cityRef}
              aria-invalid={Boolean(fieldErrors.locationCity)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
            {fieldErrors.locationCity && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.locationCity}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Morada</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Template</label>
          <div className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80">
            {templateLabel}
          </div>
          <p className="text-[11px] text-white/55">O template não pode ser alterado depois de criar o evento.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          <p className="font-semibold text-white">Taxas</p>
          <p className="text-[12px] text-white/65">
            As taxas são definidas pela ORYA e estão sempre incluídas no preço público. Não há repasse explícito ao cliente;
            os detalhes aparecem nas transações e relatórios.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          <p className="font-semibold text-white">Evento grátis</p>
          <p className="text-[12px] text-white/65">
            Só é possível definir se é grátis no momento da criação. Estado atual: {isFree ? "grátis" : "pago"}.
            {isFree && (
              <span className="block text-[12px] text-white/60 mt-1">
                Vagas/inscrições: {freeCapacity != null ? freeCapacity : "Sem limite definido"}.
              </span>
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">Acesso & participantes</p>
              <p className="text-[12px] text-white/65">
                Define quem pode assistir e quem é participante (competir/jogar).
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] text-white/70">
              {publicAccessSummary} · {participantSummary}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Público</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "OPEN", label: "Aberto" },
                  { value: "TICKET", label: "Por bilhete" },
                  { value: "INVITE", label: "Por convite" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPublicAccessMode(opt.value)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      publicAccessMode === opt.value
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                        : "border-white/20 bg-white/10 text-white/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {publicAccessMode === "TICKET" && (
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] text-white/70">Acesso do público</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "ALL", label: "Todos os bilhetes" },
                        { value: "SPECIFIC", label: "Tipos específicos" },
                      ] as const).map((opt) => {
                        const disabled = opt.value === "SPECIFIC" && ticketList.length === 0;
                        return (
                          <button
                            key={`pub-scope-${opt.value}`}
                            type="button"
                            onClick={() => setPublicTicketScope(opt.value)}
                            disabled={disabled}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                              publicTicketScope === opt.value
                                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                                : "border-white/20 bg-white/10 text-white/70"
                            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {publicTicketScope === "ALL" && (
                    <p className="text-[11px] text-white/55">Qualquer bilhete do evento dá acesso ao público.</p>
                  )}
                  {publicTicketScope === "SPECIFIC" && (
                    <>
                      {ticketList.length === 0 && (
                        <p className="text-[11px] text-white/50">Ainda não existem bilhetes.</p>
                      )}
                      <div className="grid gap-2">
                        {ticketList.map((ticket) => (
                          <label key={`pub-${ticket.id}`} className="flex items-center gap-2 text-[12px]">
                            <input
                              type="checkbox"
                              checked={publicTicketTypeIds.includes(ticket.id)}
                              onChange={() => toggleTicketType(ticket.id, setPublicTicketTypeIds)}
                            />
                            <span className="text-white/80">{ticket.name}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {publicAccessMode === "INVITE" && (
                <p className="text-[11px] text-white/55">
                  Só convidados podem aceder ao checkout e ao LiveHub público.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Participantes</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "NONE", label: "Sem participantes" },
                  { value: "INSCRIPTION", label: "Por inscrição" },
                  { value: "TICKET", label: "Por bilhete" },
                  { value: "INVITE", label: "Por convite" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setParticipantAccessMode(opt.value)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      participantAccessMode === opt.value
                        ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                        : "border-white/20 bg-white/10 text-white/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {participantAccessMode === "TICKET" && (
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] text-white/70">Participantes por bilhete</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "ALL", label: "Todos os bilhetes" },
                        { value: "SPECIFIC", label: "Tipos específicos" },
                      ] as const).map((opt) => {
                        const disabled = opt.value === "SPECIFIC" && ticketList.length === 0;
                        return (
                          <button
                            key={`part-scope-${opt.value}`}
                            type="button"
                            onClick={() => setParticipantTicketScope(opt.value)}
                            disabled={disabled}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                              participantTicketScope === opt.value
                                ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                                : "border-white/20 bg-white/10 text-white/70"
                            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {participantTicketScope === "ALL" && (
                    <p className="text-[11px] text-white/55">Qualquer bilhete identifica o participante.</p>
                  )}
                  {participantTicketScope === "SPECIFIC" && (
                    <>
                      {ticketList.length === 0 && (
                        <p className="text-[11px] text-white/50">Ainda não existem bilhetes.</p>
                      )}
                      <div className="grid gap-2">
                        {ticketList.map((ticket) => (
                          <label key={`part-${ticket.id}`} className="flex items-center gap-2 text-[12px]">
                            <input
                              type="checkbox"
                              checked={participantTicketTypeIds.includes(ticket.id)}
                              onChange={() =>
                                toggleTicketType(ticket.id, setParticipantTicketTypeIds)
                              }
                            />
                            <span className="text-white/80">{ticket.name}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {participantAccessMode === "INSCRIPTION" && (
                <p className="text-[11px] text-white/55">
                  Participantes são definidos pelas inscrições/torneio (sem necessidade de bilhete específico).
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Resumo rápido</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Público</p>
                <p className="mt-1 text-sm font-semibold text-white">{publicAccessSummary}</p>
                <p className="text-[12px] text-white/60">{publicAccessDescription}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Participantes</p>
                <p className="mt-1 text-sm font-semibold text-white">{participantSummary}</p>
                <p className="text-[12px] text-white/60">{participantAccessDescription}</p>
              </div>
            </div>
            {accessWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-50">
                <p className="font-semibold">Atenções</p>
                <div className="mt-1 space-y-1 text-amber-50/90">
                  {accessWarnings.map((warning) => (
                    <p key={warning}>• {warning}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {showInviteSection && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75 space-y-4">
            <div>
              <p className="font-semibold text-white">Convites</p>
              <p className="text-[12px] text-white/65">
                Gerir listas separadas para público e participantes, conforme o modo escolhido.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {inviteGroups.map((group) => (
                <div
                  key={group.scope}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{group.title}</p>
                      <p className="text-[11px] text-white/55">{group.description}</p>
                    </div>
                    <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] text-white/65 uppercase tracking-[0.18em]">
                      {group.scope === "PUBLIC" ? "Público" : "Participantes"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={group.input}
                      onChange={(e) => group.setInput(e.target.value)}
                      placeholder="Email ou @username (podes separar por vírgulas)"
                      className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddInvite(group.scope)}
                      disabled={group.isSaving}
                      className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                    >
                      {group.isSaving ? "A adicionar…" : "Adicionar"}
                    </button>
                  </div>
                  {group.error && <p className="text-[11px] font-semibold text-amber-100">{group.error}</p>}

                  <div className="space-y-2">
                    {group.isLoading && <p className="text-[11px] text-white/60">A carregar convites…</p>}
                    {!group.isLoading && group.invites.length === 0 && (
                      <p className="text-[11px] text-white/60">Sem convites adicionados.</p>
                    )}
                    {group.invites.map((invite) => {
                      const resolvedUsername = invite.targetUser?.username
                        ? `@${invite.targetUser.username}`
                        : null;
                      return (
                        <div
                          key={invite.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px]"
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {resolvedUsername ?? invite.targetIdentifier}
                            </span>
                            {resolvedUsername && (
                              <span className="text-[11px] text-white/60">{invite.targetIdentifier}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveInvite(invite.id, group.scope)}
                            disabled={inviteRemovingId === invite.id}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-60"
                          >
                            {inviteRemovingId === invite.id ? "A remover…" : "Remover"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-white/55">
                    Convites por email permitem checkout como convidado. Eventos grátis continuam a exigir conta e username.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    const datesBlock = (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div ref={startsRef} className="space-y-1">
            <InlineDateTimePicker
              label="Data/hora início"
              value={startsAt}
              onChange={(v) => setStartsAt(v)}
            />
            {fieldErrors.startsAt && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.startsAt}
              </p>
            )}
          </div>
          <div ref={endsRef} className="space-y-1">
            <InlineDateTimePicker
              label="Data/hora fim"
              value={endsAt}
              onChange={(v) => setEndsAt(v)}
              minDateTime={startsAt ? new Date(startsAt) : undefined}
            />
            {fieldErrors.endsAt && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.endsAt}
              </p>
            )}
          </div>
        </div>
      </div>
    );

    const ticketsBlock = (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Bilhetes (não removemos, só terminamos venda)
          </h2>
          <Link href={`/organizador?tab=analyze&section=vendas&eventId=${event.id}`} className="text-[11px] text-[#6BFFFF]">
            Ver vendas →
          </Link>
        </div>

        {isPadel && (
          <div className="rounded-xl border border-white/12 bg-black/25 p-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold">Categorias Padel</p>
                <p className="text-[11px] text-white/60">
                  Ativa as categorias que aceitam inscrições neste evento. Desativar antes do início gera refunds base-only.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePadelCategories}
                disabled={padelCategorySaving || padelCategoryLinks.length === 0}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                {padelCategorySaving ? "A guardar…" : "Guardar categorias"}
              </button>
            </div>
            {padelCategoryError && (
              <p className="text-[11px] text-amber-200">{padelCategoryError}</p>
            )}
            {padelCategoryLinks.length === 0 ? (
              <p className="text-[11px] text-white/60">Sem categorias associadas ao evento.</p>
            ) : (
              <div className="space-y-2">
                {padelCategoryLinks.map((link) => {
                  const draft =
                    padelCategoryDrafts[link.padelCategoryId] ?? {
                      isEnabled: link.isEnabled,
                      isHidden: link.isHidden ?? false,
                      capacityTeams: typeof link.capacityTeams === "number" ? String(link.capacityTeams) : "",
                    };
                  return (
                    <div key={link.id} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {link.category?.label ?? `Categoria ${link.padelCategoryId}`}
                          </p>
                          <p className="text-[11px] text-white/60">
                            {draft.isEnabled ? "Ativa" : "Desativada"}
                            {draft.isHidden ? " · Oculta" : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/70">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.isEnabled}
                              onChange={(e) => updatePadelCategoryDraft(link.padelCategoryId, { isEnabled: e.target.checked })}
                              className="h-4 w-4 rounded border-white/30 bg-black/30"
                            />
                            Ativa
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.isHidden}
                              onChange={(e) => updatePadelCategoryDraft(link.padelCategoryId, { isHidden: e.target.checked })}
                              className="h-4 w-4 rounded border-white/30 bg-black/30"
                            />
                            Oculta
                          </label>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-white/70">
                          Capacidade (equipas)
                          <input
                            type="number"
                            min={0}
                            value={draft.capacityTeams}
                            onChange={(e) => updatePadelCategoryDraft(link.padelCategoryId, { capacityTeams: e.target.value })}
                            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-white/70">
                Adicionar categoria
                <select
                  value={padelCategoryAddId}
                  onChange={(e) => setPadelCategoryAddId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
                >
                  <option value="">Seleciona uma categoria</option>
                  {availablePadelCategories.map((cat) => (
                    <option key={`padel-cat-${cat.id}`} value={String(cat.id)}>
                      {cat.label ?? `Categoria ${cat.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleAddPadelCategory}
                disabled={padelCategorySaving || availablePadelCategories.length === 0}
                className="rounded-full border border-white/20 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                Adicionar
              </button>
            </div>
            {availablePadelCategories.length === 0 && padelCategories.length > 0 && (
              <p className="text-[11px] text-white/60">Todas as categorias do organizador já estão ligadas ao evento.</p>
            )}
            {padelCategories.length === 0 && (
              <p className="text-[11px] text-white/60">
                Cria categorias no Hub Padel para poderes adicioná-las ao evento.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {ticketList.map((t) => {
            const price = (t.price / 100).toFixed(2);
            const remaining =
              t.totalQuantity !== null && t.totalQuantity !== undefined
                ? t.totalQuantity - t.soldQuantity
                : null;
            const isEnding = endingIds.includes(t.id) || t.status === TicketTypeStatus.CLOSED;

            return (
              <div
                key={t.id}
                className="rounded-xl border border-white/12 bg-black/30 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-[11px] text-white/60">
                      {price} € • Vendidos: {t.soldQuantity}
                      {remaining !== null ? ` • Stock restante: ${remaining}` : ""}
                      {isPadel && t.padelCategoryLabel ? ` • Categoria: ${t.padelCategoryLabel}` : ""}
                  </p>
                </div>
                  <span className="text-[10px] rounded-full border border-white/20 px-2 py-0.5 text-white/75">
                    {isEnding ? "Venda terminada" : t.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => openConfirmEnd(t.id)}
                    disabled={t.status === TicketTypeStatus.CLOSED}
                    className={`rounded-full px-3 py-1 border ${
                      t.status === TicketTypeStatus.CLOSED
                        ? "border-white/15 text-white/40 cursor-not-allowed"
                        : "border-amber-300/60 text-amber-100 hover:bg-amber-500/10"
                    }`}
                  >
                    Terminar venda
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/12 bg-black/25 p-3 space-y-2">
          <p className="text-[12px] font-semibold">Adicionar novo bilhete</p>
          {isPadel && activePadelCategoryLinks.length === 0 && (
            <p className="text-[11px] text-amber-200">
              Cria categorias Padel no hub e associa-as ao evento antes de adicionar bilhetes.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              placeholder="Nome"
              value={newTicket.name}
              onChange={(e) => setNewTicket((p) => ({ ...p, name: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              placeholder="Preço (euros)"
              value={newTicket.priceEuro}
              onChange={(e) => setNewTicket((p) => ({ ...p, priceEuro: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            {isPadel && activePadelCategoryLinks.length > 0 && (
              <label className="text-[11px] text-white/70">
                Categoria Padel
                <select
                  value={newTicket.padelEventCategoryLinkId}
                  onChange={(e) => setNewTicket((p) => ({ ...p, padelEventCategoryLinkId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
                >
                  <option value="">Seleciona uma categoria</option>
                  {activePadelCategoryLinks.map((link) => (
                    <option key={`padel-category-${link.id}`} value={String(link.id)}>
                      {link.category?.label ?? `Categoria ${link.padelCategoryId}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <input
              placeholder="Quantidade total"
              value={newTicket.totalQuantity}
              onChange={(e) => setNewTicket((p) => ({ ...p, totalQuantity: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              placeholder="Descrição (opcional)"
              value={newTicket.description}
              onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <div className="text-[11px] text-white/70">
              Início vendas
              <input
                type="datetime-local"
                value={newTicket.startsAt}
                onChange={(e) => setNewTicket((p) => ({ ...p, startsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
            </div>
            <div className="text-[11px] text-white/70">
              Fim vendas
              <input
                type="datetime-local"
                value={newTicket.endsAt}
                onChange={(e) => setNewTicket((p) => ({ ...p, endsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-white/50">
            Novo bilhete fica ON_SALE por padrão. Não removemos bilhetes antigos para manter histórico.
          </p>
        </div>
      </div>
    );

    const summaryBlock = (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Resumo rápido</p>
          <p className="text-white/70 text-sm mt-1">Confirma os detalhes antes de guardar.</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Evento</p>
              <p className="font-semibold">{title || "Sem título"}</p>
              <p className="text-white/60 text-sm line-clamp-2">{description || "Sem descrição"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Local e datas</p>
              <p>{locationName || "Local a definir"}</p>
              <p className="text-white/70">{locationCity || "Cidade a definir"}</p>
              <p className="text-white/70">
                {startsAt ? new Date(startsAt).toLocaleString() : "Início por definir"}{" "}
                {endsAt ? `→ ${new Date(endsAt).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Estado</p>
              <p className="font-semibold">{isFree ? "Evento grátis" : "Evento pago"}</p>
              {isFree && (
                <p className="text-white/70">
                  Vagas/inscrições: {freeCapacity != null ? freeCapacity : "Sem limite definido"}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    switch (steps[currentStep].key) {
      case "base":
        return baseBlock;
      case "dates":
        return datesBlock;
      case "tickets":
        return ticketsBlock;
      case "summary":
        return summaryBlock;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="space-y-6">
        {confirmId && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur">
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-3">
              <h3 className="text-lg font-semibold">Terminar venda do bilhete?</h3>
              <p className="text-sm text-white/70">
                Esta ação é definitiva para este tipo de bilhete. Escreve{" "}
                <span className="font-semibold">TERMINAR VENDA</span> para confirmar.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
                placeholder="TERMINAR VENDA"
              />
              <div className="flex justify-end gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmId(null);
                    setConfirmText("");
                  }}
                  className="rounded-full border border-white/20 px-3 py-1 text-white/75 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmEnd}
                  className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Edição em passos</p>
              <p className="text-lg font-semibold text-white">Editar evento</p>
              <p className="text-sm text-white/60">
                Define o teu evento passo a passo. Podes guardar como rascunho em qualquer momento.
              </p>
            </div>
            <div className="text-right text-[12px] text-white/60">
              <p>Estado: {isFree ? "Grátis" : "Pago"}</p>
              <p>Template: {templateLabel}</p>
            </div>
          </div>

          {errorSummary.length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
            >
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>⚠️</span>
                <span>Revê estes campos antes de continuar</span>
              </div>
              <ul className="mt-2 space-y-1 text-[13px]">
                {errorSummary.map((err) => (
                  <li key={`${err.field}-${err.message}`}>
                    <button
                      type="button"
                      onClick={() => focusField(err.field)}
                      className="inline-flex items-center gap-2 text-left font-semibold text-white underline decoration-amber-200 underline-offset-4 hover:text-amber-50"
                    >
                      <span aria-hidden>↘</span>
                      <span>{err.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div className="relative h-1 rounded-full bg-white/10">
              <div
                className="absolute left-0 top-0 h-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {steps.map((step, idx) => {
                const state = idx === currentStep ? "active" : idx < currentStep ? "done" : "future";
                const allowClick = idx < currentStep;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => allowClick && setCurrentStep(idx)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-3 text-left transition ${
                      state === "active"
                        ? "border-white/40 bg-white/10 shadow"
                        : state === "done"
                          ? "border-white/15 bg-white/5 text-white/80"
                          : "border-white/10 bg-black/10 text-white/60"
                    } ${!allowClick ? "cursor-default" : "hover:border-white/30 hover:bg-white/5"}`}
                    disabled={!allowClick}
                  >
                    <div
                      className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full border ${
                        state === "active"
                          ? "border-white bg-white text-black shadow-[0_0_0_6px_rgba(255,255,255,0.08)]"
                          : state === "done"
                            ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-100"
                            : "border-white/30 text-white/70"
                      }`}
                    >
                      {state === "done" ? "✔" : idx + 1}
                    </div>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="text-[12px] text-white/60">{step.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            {renderStepContent()}
          </div>

          <div ref={ctaRef} className="space-y-3">
            {stripeAlert && (
              <FormAlert
                variant={hasPaidTicket ? "error" : "warning"}
                title="Stripe incompleto"
                message={stripeAlert}
              />
            )}
            {validationAlert && <FormAlert variant="warning" message={validationAlert} />}
            {error && <FormAlert variant="error" message={error} />}
            {backendAlert && (
              <FormAlert
                variant="error"
                title="Algo correu mal ao guardar o evento"
                message={backendAlert}
              />
            )}
            {message && <FormAlert variant="success" message={message} />}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentStep === 0 || isSaving}
                  className="rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Anterior
                </button>
                <Link
                  href={`/organizador/eventos/${event.id}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10"
                >
                  Voltar
                </Link>
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={isSaving}
                className={`${CTA_PRIMARY} px-5 py-2 text-sm disabled:opacity-60`}
              >
                {currentStep === steps.length - 1 ? (isSaving ? "A gravar…" : "Guardar alterações") : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto min-w-[240px] rounded-lg border px-4 py-3 text-sm shadow-lg ${
                toast.tone === "success"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50"
                  : "border-red-400/50 bg-red-500/15 text-red-50"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
