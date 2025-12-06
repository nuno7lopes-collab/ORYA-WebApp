"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { sanitizeUsername, validateUsername, USERNAME_RULES_HINT } from "@/lib/username";

type OrgItem = {
  organizerId: number;
  role: string;
  lastUsedAt: string | null;
  organizer: {
    id: number;
    username: string | null;
    displayName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    status: string | null;
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
  const [city, setCity] = useState("");
  const [orgUsername, setOrgUsername] = useState("");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loadingSwitch, setLoadingSwitch] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const handleSwitch = async (organizerId: number, redirectToDashboard = false) => {
    if (loadingSwitch) return;
    setLoadingSwitch(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/organizador/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setActionMessage(json?.error || "Não foi possível mudar de organização.");
        return;
      }
      setCurrentActive(organizerId);
      if (redirectToDashboard) {
        router.push("/organizador?tab=overview");
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
    if (!businessName.trim() || !entityType.trim() || !city.trim()) {
      setError("Preenche nome, tipo de entidade e cidade.");
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
      const res = await fetch("/api/organizador/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          entityType: entityType.trim(),
          city: city.trim(),
          displayName: businessName.trim(),
          username: usernameValid.normalized,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível criar a organização.");
      } else {
        const newId = json?.organizer?.id as number | undefined;
        setBusinessName("");
        setCity("");
        setEntityType("");
        setOrgUsername("");
        setUsernameStatus("idle");
        setUsernameHint(null);
        if (newId) {
          // Atualiza lista localmente para evitar refetch
          setOrgs((prev) => [
            ...prev,
            {
              organizerId: newId,
              role: "OWNER",
              lastUsedAt: null,
              organizer: {
                id: newId,
                username: usernameValid.normalized,
                displayName: json.organizer.displayName ?? json.organizer.businessName ?? "Organização",
                businessName: json.organizer.businessName ?? null,
                city: json.organizer.city ?? null,
                entityType: json.organizer.entityType ?? null,
                status: "ACTIVE",
              },
            },
          ]);
          await handleSwitch(newId, true);
        } else {
          router.push("/organizador?tab=overview");
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
    const isActive = currentActive === item.organizerId;
    const isOwnerOrAdmin = ["OWNER", "ADMIN"].includes(item.role.toUpperCase());
    const cityLine = item.organizer.city || "Cidade não definida";
    const typeLine = item.organizer.entityType || "Tipo não definido";
    const handle = item.organizer.username ? `@${item.organizer.username}` : "Sem username";

    return (
      <div
        key={item.organizerId}
        className={`rounded-2xl border p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)] transition hover:border-white/20 hover:bg-white/8 ${
          isActive ? "border-[#6BFFFF]/40 bg-[#0b152d]/40" : "border-white/10 bg-white/5"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {item.organizer.displayName || item.organizer.businessName || "Organização"}
            </h3>
            <p className="text-[12px] text-white/60">
              {cityLine} · {typeLine}
            </p>
            <p className="text-[11px] text-white/55">{handle}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-[11px]">
            {isActive && (
              <span className="rounded-full border border-[#6BFFFF]/50 bg-[#6BFFFF]/15 px-2 py-0.5 text-[#CFFAFE]">
                Ativa
              </span>
            )}
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 uppercase tracking-[0.16em] text-white/60">
              {item.role}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[12px] text-white/70">
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1">
            Estado: {item.organizer.status || "—"}
          </span>
          <div className="flex items-center gap-2">
            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={() => router.push(`/organizador/(dashboard)/staff?organizerId=${item.organizerId}`)}
                className="text-white/70 hover:text-white underline-offset-2"
              >
                Gerir equipa
              </button>
            )}
            {isActive ? (
              <button
                type="button"
                onClick={() => router.push("/organizador?tab=overview")}
                className="rounded-full bg-white text-black px-4 py-2 text-sm font-semibold shadow hover:opacity-90"
              >
                Ver dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSwitch(item.organizerId, true)}
                className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-110"
              >
                Entrar no dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const loading = false; // server já enviou dados; não repetir fetch
  const emptyState = orgs.length === 0;
  const hasError = false; // como não há fetch client, não há erro aqui

  return (
    <div className="orya-body-bg min-h-screen text-white px-4 py-10 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/60">Organizações</p>
            <h1 className="text-3xl font-semibold">As tuas organizações</h1>
            <p className="text-sm text-white/65 max-w-2xl">
              Cria e gere as organizações com que trabalhas na ORYA. Escolhe uma para entrares no dashboard do organizador.
            </p>
          </div>
          <button
            type="button"
            onClick={scrollToForm}
            className="self-start rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-110"
          >
            Criar organização
          </button>
        </header>

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
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">As tuas organizações</h2>
              <p className="text-[12px] text-white/65">
                Escolhe em que organização estás a trabalhar. Podes alternar a qualquer momento.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orgs.map(renderOrgCard)}
              <div className="flex flex-col justify-between rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
                <div className="space-y-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-bold">
                    +
                  </div>
                  <h3 className="text-lg font-semibold">Criar nova organização</h3>
                  <p className="text-[12px] text-white/65">Clubes, espaços, marcas, promotores ou equipas.</p>
                </div>
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="self-start rounded-full border border-white/25 px-4 py-2 text-sm text-white hover:bg-white/10"
                >
                  Abrir formulário
                </button>
              </div>
            </div>
          </section>
        )}

        {emptyState && !hasError && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Ainda não tens nenhuma organização</h2>
              <p className="text-sm text-white/65">
                Cria a primeira para vender bilhetes, gerir equipa e pagamentos.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                <li>Cria o teu clube, bar, espaço ou marca.</li>
                <li>Vende bilhetes e recebe os pagamentos diretamente na tua conta.</li>
                <li>Adiciona staff com acesso a check-in e relatórios.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={scrollToForm}
              className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow hover:brightness-110"
            >
              Criar primeira organização
            </button>
          </div>
        )}

        <section ref={formRef} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Criar nova organização</h3>
              <p className="text-[12px] text-white/65">Define nome, tipo de entidade e cidade base para começares.</p>
            </div>
            {actionMessage && <p className="text-[12px] text-emerald-200">{actionMessage}</p>}
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
              <label className="text-[12px] text-white/70">Cidade base</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Lisboa, Porto..."
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
              <p className="text-[11px] text-white/55">@ é único na ORYA (3-30 chars, letras/números/_ ou .)</p>
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
              !city.trim() ||
              !validateUsername(sanitizeUsername(orgUsername)).valid
            }
            className="self-start rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "A criar…" : "Criar organização"}
          </button>
        </section>
      </div>
    </div>
  );
}
