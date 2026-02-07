"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sanitizeUsername, validateUsername, USERNAME_RULES_HINT } from "@/lib/username";
import {
  DEFAULT_PRIMARY_MODULE,
  getDefaultOrganizationModules,
} from "@/lib/organizationCategories";
import { Avatar } from "@/components/ui/avatar";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { fetchGeoAutocomplete, fetchGeoDetails } from "@/lib/geo/client";
import type { GeoAutocompleteItem } from "@/lib/geo/provider";

const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type OrgItem = {
  organizationId: number;
  role: string;
  lastUsedAt: string | null;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    entityType: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
  };
};

type Props = {
  initialOrgs: OrgItem[];
  activeId: number | null;
};

export default function OrganizationsHubClient({ initialOrgs, activeId }: Props) {
  const router = useRouter();

  const [orgs, setOrgs] = useState<OrgItem[]>(initialOrgs);
  const [currentActive, setCurrentActive] = useState<number | null>(activeId);
  const [businessName, setBusinessName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [orgUsername, setOrgUsername] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressSeqRef = useRef(0);
  const addressDetailsSeqRef = useRef(0);
  const activeAddressProviderRef = useRef<string | null>(null);
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadingSwitch, setLoadingSwitch] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const query = addressQuery.trim();
    if (query.length < 2) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressError(null);
      return;
    }
    if (addressSearchTimeoutRef.current) {
      clearTimeout(addressSearchTimeoutRef.current);
    }
    setAddressError(null);
    const seq = ++addressSeqRef.current;
    addressSearchTimeoutRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const items = await fetchGeoAutocomplete(query);
        if (addressSeqRef.current === seq) {
          setAddressSuggestions(items);
        }
      } catch (err) {
        if (addressSeqRef.current === seq) {
          setAddressSuggestions([]);
          setAddressError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
        }
      } finally {
        if (addressSeqRef.current === seq) {
          setAddressLoading(false);
        }
      }
    }, 260);

    return () => {
      if (addressSearchTimeoutRef.current) {
        clearTimeout(addressSearchTimeoutRef.current);
      }
    };
  }, [addressQuery]);

  const handleSelectAddressSuggestion = async (item: GeoAutocompleteItem) => {
    setAddressError(null);
    setAddressId(null);
    setAddressLabel(item.label);
    setAddressQuery(item.label);
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    activeAddressProviderRef.current = item.providerId;
    const seq = ++addressDetailsSeqRef.current;
    setAddressLoading(true);
    try {
      const details = await fetchGeoDetails(item.providerId, {
        sourceProvider: item.sourceProvider ?? null,
        lat: item.lat,
        lng: item.lng,
      });
      if (addressDetailsSeqRef.current !== seq) return;
      if (activeAddressProviderRef.current !== item.providerId) return;
      const resolvedAddressId = details?.addressId ?? null;
      if (!resolvedAddressId) {
        setAddressError("Morada inválida.");
        return;
      }
      const formatted = details?.formattedAddress ?? item.label;
      setAddressId(resolvedAddressId);
      setAddressLabel(formatted);
      setAddressQuery(formatted);
    } catch (err) {
      if (addressDetailsSeqRef.current === seq) {
        setAddressError(err instanceof Error ? err.message : "Falha ao normalizar morada.");
      }
    } finally {
      if (addressDetailsSeqRef.current === seq) {
        setAddressLoading(false);
      }
    }
  };

  const checkUsernameAvailability = async (value: string) => {
    const cleaned = sanitizeUsername(value);
    if (!cleaned) {
      setUsernameHint(USERNAME_RULES_HINT);
      setUsernameStatus("idle");
      return false;
    }
    const validation = validateUsername(cleaned);
    if (!validation.valid) {
      setUsernameHint(validation.error);
      setUsernameStatus("error");
      return false;
    }
    setUsernameHint(null);
    setUsernameStatus("checking");
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(cleaned)}`);
      if (!res.ok) {
        setUsernameHint("Não foi possível verificar o @ agora.");
        setUsernameStatus("error");
        return false;
      }
      const data = (await res.json().catch(() => null)) as { available?: boolean } | null;
      const available = Boolean(data?.available);
      if (!available) setUsernameHint("Este @ já está a ser usado — escolhe outro.");
      setUsernameStatus(available ? "available" : "taken");
      return available;
    } catch (err) {
      console.error("[org hub] check username error", err);
      setUsernameHint("Erro ao verificar o @.");
      setUsernameStatus("error");
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleSwitch = async (organizationId: number, redirectToDashboard = false) => {
    if (loadingSwitch) return;
    setLoadingSwitch(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/organizacao/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setActionMessage(json?.error || "Não foi possível mudar de organização.");
        return;
      }
      setCurrentActive(organizationId);
      if (redirectToDashboard) {
        // força cookie no browser e navegação direta com org na query
        try {
          document.cookie = `orya_organization=${organizationId}; path=/; Max-Age=${ORG_COOKIE_MAX_AGE}; SameSite=Lax`;
        } catch (err) {
          console.warn("[org switch] não foi possível escrever cookie no browser", err);
        }
        // usa router para evitar cache, depois fallback para reload completo
        router.replace(`/organizacao/overview?organizationId=${organizationId}`);
        setTimeout(() => {
          if (window?.location?.href.includes(`organizationId=${organizationId}`) === false) {
            window.location.href = `/organizacao/overview?organizationId=${organizationId}`;
          }
        }, 50);
      } else {
        setActionMessage("Organização ativa atualizada.");
      }
    } catch (err) {
      console.error("[org hub] switch error", err);
      setActionMessage("Erro inesperado ao mudar de organização.");
    } finally {
      setLoadingSwitch(false);
    }
  };

  const handleCreate = async () => {
    if (!businessName.trim() || !entityType.trim() || !addressId) {
      setError("Preenche nome, tipo de entidade e morada (Apple Maps).");
      return;
    }
    const usernameValid = validateUsername(orgUsername);
    if (!usernameValid.valid) {
      setError(usernameValid.error);
      return;
    }
    const available = await checkUsernameAvailability(orgUsername);
    if (!available) {
      setError("Este @ já está a ser usado — escolhe outro.");
      return;
    }
    setSaving(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch("/api/organizacao/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          entityType: entityType.trim(),
          addressId,
          publicName: businessName.trim(),
          username: usernameValid.normalized,
          primaryModule: DEFAULT_PRIMARY_MODULE,
          modules: getDefaultOrganizationModules(DEFAULT_PRIMARY_MODULE),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível criar a organização.");
      } else {
        const newId = json?.organization?.id as number | undefined;
        setBusinessName("");
        setEntityType("");
        setOrgUsername("");
        setAddressQuery("");
        setAddressId(null);
        setAddressLabel(null);
        setAddressSuggestions([]);
        setAddressError(null);
        setUsernameStatus("idle");
        setUsernameHint(null);
        if (newId) {
          // Atualiza lista localmente para evitar refetch
          setOrgs((prev) => [
            ...prev,
            {
              organizationId: newId,
              role: "OWNER",
              lastUsedAt: null,
              organization: {
                id: newId,
                username: usernameValid.normalized,
                publicName: json.organization.publicName ?? json.organization.businessName ?? "Organização",
                businessName: json.organization.businessName ?? null,
                entityType: json.organization.entityType ?? null,
                status: "ACTIVE",
              },
            },
          ]);
          await handleSwitch(newId, true);
        } else {
          router.push(appendOrganizationIdToHref("/organizacao/overview", currentActive));
        }
      }
    } catch (err) {
      console.error("[org hub] create error", err);
      setError("Erro inesperado ao criar organização.");
    } finally {
      setSaving(false);
    }
  };

  const renderOrgCard = (item: OrgItem) => {
    const isActive = currentActive === item.organizationId;
    const normalizedRole = item.role.toUpperCase();
    const typeLine = item.organization.entityType || "Tipo não definido";
    const handle = item.organization.username ? `@${item.organization.username}` : "Sem username";
    const roleLabel = normalizedRole;
    const statusLabel = (item.organization.status || "—").toUpperCase();
    const handleCardClick = () => {
      if (isActive) {
        router.push(`/organizacao/overview?organizationId=${item.organizationId}`);
        return;
      }
      handleSwitch(item.organizationId, true);
    };

    const badgeClass = (kind: "status" | "role", value: string) => {
      if (kind === "status" && value === "ACTIVE") {
        return "border-emerald-400/50 bg-emerald-400/15 text-emerald-50";
      }
      if (kind === "status" && value === "PENDING") {
        return "border-amber-400/50 bg-amber-400/15 text-amber-50";
      }
      if (kind === "status" && value === "SUSPENDED") {
        return "border-red-400/50 bg-red-400/15 text-red-50";
      }
      if (kind === "role" && value === "OWNER") {
        return "border-cyan-300/60 bg-cyan-300/15 text-cyan-50";
      }
      if (kind === "role" && value === "ADMIN") {
        return "border-sky-300/60 bg-sky-300/15 text-sky-50";
      }
      return "border-white/20 bg-white/10 text-white/70";
    };

    return (
      <div
        key={item.organizationId}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleCardClick();
          }
        }}
        className={`cursor-pointer rounded-2xl border p-5 shadow-[0_16px_50px_rgba(0,0,0,0.45)] transition hover:-translate-y-[3px] hover:border-[#6BFFFF]/50 hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6BFFFF]/60 ${
          isActive ? "border-[#6BFFFF]/60 bg-[#0b152d]/50" : "border-white/10 bg-white/5"
        }`}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <Avatar
            src={item.organization.brandingAvatarUrl ?? null}
            name={item.organization.publicName || item.organization.businessName || "Organização"}
            className="h-12 w-12 border border-white/15"
            textClassName="text-sm font-semibold uppercase tracking-[0.16em] text-white/80"
            fallbackText="OR"
          />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {item.organization.publicName || item.organization.businessName || "Organização"}
            </h3>
            <p className="text-[12px] text-white/60">
              {handle} · {typeLine}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em]">
            <span className={`rounded-full border px-3 py-[5px] ${badgeClass("status", statusLabel)}`}>
              {statusLabel}
            </span>
            <span className={`rounded-full border px-3 py-[5px] ${badgeClass("role", roleLabel)}`}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const loading = false; // server já enviou dados; não repetir fetch
  const emptyState = orgs.length === 0;
  const hasError = false; // como não há fetch client, não há erro aqui

  return (
    <div className={cn("w-full py-8 text-white")}>
      <div className="space-y-8">
        {hasError && (
          <div className="rounded-2xl border border-red-400/40 bg-red-900/30 p-4 text-sm text-red-100">
            Não foi possível carregar as organizações neste momento.
          </div>
        )}

        {loading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && !hasError && !emptyState && (
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Organizações</p>
              <h2 className="text-2xl font-semibold">As tuas organizações</h2>
              <p className="text-[12px] text-white/65">Escolhe onde queres entrar.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orgs.map(renderOrgCard)}
              <button
                type="button"
                onClick={() => router.push(appendOrganizationIdToHref("/organizacao/become", currentActive))}
                className="flex flex-col justify-between rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)] hover:-translate-y-[3px] hover:border-white/30 transition text-left"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl font-bold">
                      +
                    </div>
                    <h3 className="text-lg font-semibold">Nova organização</h3>
                  </div>
                </div>
              </button>
            </div>
          </section>
        )}

        {emptyState && !hasError && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Ainda não tens nenhuma organização</h2>
              <p className="text-sm text-white/65">
                Cria a primeira para vender bilhetes e gerir equipa.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                <li>Cria o teu clube, bar, espaço ou marca.</li>
                <li>Vende bilhetes e recebe pagamentos.</li>
                <li>Adiciona staff e controla acessos.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => router.push(appendOrganizationIdToHref("/organizacao/become", currentActive))}
              className={`${CTA_PRIMARY} px-5 py-2 text-sm`}
            >
              Criar primeira organização
            </button>
          </div>
        )}
        {showForm && (
          <div
            className={`${
              emptyState ? "" : "fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur"
            }`}
          >
            <section className="w-full max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Criar nova organização</h3>
                  <p className="text-[12px] text-white/65">Nome, tipo e morada base (Apple).</p>
                </div>
                <div className="flex items-center gap-3">
                  {actionMessage && <p className="text-[12px] text-emerald-200">{actionMessage}</p>}
                  {!emptyState && (
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white hover:bg-white/10"
                    >
                      Fechar
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[12px] text-white/70">Nome da organização</label>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    placeholder="Ex.: ORYA TEAM, Casa Guedes"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">Tipo de entidade</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  >
                    <option value="">Seleciona</option>
                    <option value="PESSOA_SINGULAR">Pessoa singular</option>
                    <option value="EMPRESA">Empresa</option>
                    <option value="ASSOCIACAO">Associação</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[12px] text-white/70">Morada base (Apple Maps)</label>
                  <div className="relative overflow-visible">
                    <input
                      value={addressQuery}
                      onChange={(event) => {
                        const next = event.target.value;
                        setAddressQuery(next);
                        setAddressId(null);
                        setAddressLabel(null);
                        setAddressError(null);
                        activeAddressProviderRef.current = null;
                        setShowAddressSuggestions(true);
                      }}
                      onFocus={() => setShowAddressSuggestions(true)}
                      onBlur={() => {
                        if (addressBlurTimeoutRef.current) {
                          clearTimeout(addressBlurTimeoutRef.current);
                        }
                        addressBlurTimeoutRef.current = setTimeout(
                          () => setShowAddressSuggestions(false),
                          120,
                        );
                      }}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      placeholder="Procura um local ou morada"
                    />
                    {showAddressSuggestions && (
                      <div className="mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl">
                        {addressLoading ? (
                          <div className="px-3 py-2 text-sm text-white/70 animate-pulse">
                            A procurar…
                          </div>
                        ) : addressError ? (
                          <div className="px-3 py-2 text-sm text-amber-100">
                            {addressError}
                          </div>
                        ) : addressSuggestions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-white/60">Sem sugestões.</div>
                        ) : (
                          addressSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.providerId}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSelectAddressSuggestion(suggestion)}
                              className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                            >
                              <div className="flex w-full items-center justify-between gap-3">
                                <span className="font-semibold text-white">{suggestion.label}</span>
                                <div className="flex items-center gap-2 text-[12px] text-white/65">
                                  <span>{suggestion.city || "—"}</span>
                                  {suggestion.sourceProvider === "APPLE_MAPS" && (
                                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                                      Apple
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {addressId && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                      Morada confirmada: {addressLabel || addressQuery}
                    </div>
                  )}
                  {addressError && (
                    <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                      {addressError}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">Username ORYA</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">@</span>
                    <input
                      value={orgUsername}
                      onChange={(e) => {
                        const cleaned = sanitizeUsername(e.target.value);
                        setOrgUsername(cleaned);
                        const validation = validateUsername(cleaned);
                        setUsernameHint(validation.valid ? null : validation.error);
                        setUsernameStatus("idle");
                      }}
                      onBlur={(e) => checkUsernameAvailability(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 pl-7 text-sm outline-none focus:border-[#6BFFFF]"
                      maxLength={30}
                      placeholder="casaguedes"
                    />
                  </div>
                  <p className="text-[11px] text-white/55">@ é único (3-30 chars).</p>
                  {usernameHint && <p className="text-[11px] text-amber-300">{usernameHint}</p>}
                  {checkingUsername && <p className="text-[11px] text-white/60">A verificar disponibilidade…</p>}
                  {usernameStatus === "taken" && !checkingUsername && (
                    <p className="text-[11px] text-red-300">Este @ já está a ser usado.</p>
                  )}
                  {usernameStatus === "available" && !checkingUsername && (
                    <p className="text-[11px] text-emerald-300">Disponível ✔</p>
                  )}
                </div>
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button
                type="button"
                onClick={handleCreate}
                disabled={
                  saving ||
                  !businessName.trim() ||
                  !entityType.trim() ||
                  !addressId ||
                  !validateUsername(sanitizeUsername(orgUsername)).valid
                }
                className={`${CTA_PRIMARY} self-start px-5 py-2 text-sm disabled:opacity-60`}
              >
                {saving ? "A criar…" : "Criar organização"}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
