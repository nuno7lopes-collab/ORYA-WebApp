// app/me/edit/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { sanitizeUsername, validateUsername, USERNAME_RULES_HINT } from "@/lib/username";

type SaveBasicResponse = {
  ok: boolean;
  profile?: {
    id: string;
    username: string | null;
    fullName: string | null;
    onboardingDone: boolean;
  } | null;
  error?: string;
};

export default function EditProfilePage() {
  const router = useRouter();
  const { user, profile, isLoading, mutate } = useUser();
  const { openModal } = useAuthModal();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [allowEmailNotifications, setAllowEmailNotifications] = useState(true);
  const [allowEventReminders, setAllowEventReminders] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [allowSalesAlerts, setAllowSalesAlerts] = useState(true);
  const [allowSystemAnnouncements, setAllowSystemAnnouncements] = useState(true);

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload.");
      }
      setAvatarUrl(json.url);
      setSuccessMsg("Foto atualizada. Não te esqueças de guardar.");
    } catch (err) {
      console.error("[me/edit] upload avatar", err);
      setUploadError("Não foi possível enviar a foto. Tenta outra vez.");
    } finally {
      setAvatarUploading(false);
    }
  }

  // Preenche o formulário quando o perfil estiver carregado
  useEffect(() => {
    if (!isLoading && !user) {
      // Se alguém chegar aqui sem sessão, mandamos para login
      openModal({ mode: "login", redirectTo: "/me/edit", showGoogle: true });
      router.push("/");
      return;
    }

    if (profile) {
      setFullName(profile.fullName ?? "");
      setUsername(sanitizeUsername(profile.username ?? ""));
      setAvatarUrl(profile.avatarUrl ?? null);
      setProfileVisibility(profile.profileVisibility === "PRIVATE" ? "PRIVATE" : "PUBLIC");
      setAllowEmailNotifications(Boolean(profile.allowEmailNotifications));
      setAllowEventReminders(Boolean(profile.allowEventReminders));
      setAllowFriendRequests(Boolean(profile.allowFriendRequests));
    }
  }, [isLoading, user, profile, openModal, router]);

  useEffect(() => {
    let cancelled = false;
    const loadPrefs = async () => {
      try {
        const res = await fetch("/api/notifications/prefs");
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.prefs || cancelled) return;
        setAllowEmailNotifications(Boolean(json.prefs.allowEmailNotifications));
        setAllowEventReminders(Boolean(json.prefs.allowEventReminders));
        setAllowFriendRequests(Boolean(json.prefs.allowFriendRequests));
        setAllowSalesAlerts(Boolean(json.prefs.allowSalesAlerts));
        setAllowSystemAnnouncements(Boolean(json.prefs.allowSystemAnnouncements));
      } catch (err) {
        console.warn("[me/edit] prefs fetch failed", err);
      }
    };
    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkUsernameAvailability(value: string) {
    const trimmed = sanitizeUsername(value);

    if (!trimmed) {
      setUsernameAvailable(null);
      setUsernameHint(USERNAME_RULES_HINT);
      return false;
    }

    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setUsernameHint(validation.error);
      setUsernameAvailable(false);
      return false;
    }

    // Se não mudou em relação ao username atual, consideramos disponível
    if (trimmed === (profile?.username ?? "")) {
      setUsernameAvailable(true);
      setUsernameHint(null);
      return true;
    }

    try {
      setCheckingUsername(true);
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(trimmed)}`);

      if (!res.ok) {
        setUsernameAvailable(null);
        return false;
      }

      const json = (await res.json()) as { available: boolean };
      setUsernameAvailable(json.available);
      setUsernameHint(json.available ? null : "Esse username já existe.");
      return json.available;
    } catch (err) {
      console.error("Erro a verificar username:", err);
      setUsernameAvailable(null);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedUsername = sanitizeUsername(username);
    const validation = validateUsername(trimmedUsername);

    if (!validation.valid) {
      setErrorMsg(validation.error);
      return;
    }

    if (usernameAvailable === false) {
      setErrorMsg("Esse username já está a ser usado.");
      return;
    }

    if (usernameAvailable === null) {
      const ok = await checkUsernameAvailability(trimmedUsername);
      if (!ok) {
        setErrorMsg("Esse username já está a ser usado.");
        return;
      }
    }

    try {
      setSaving(true);

      const res = await fetch("/api/profiles/save-basic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim() || null,
          username: validation.normalized,
          avatarUrl: avatarUrl ?? null,
          visibility: profileVisibility,
          allowEmailNotifications,
          allowEventReminders,
          allowFriendRequests,
        }),
      });

      if (!res.ok) {
        setErrorMsg("Erro a guardar o perfil.");
        setSaving(false);
        return;
      }

      const json = (await res.json()) as SaveBasicResponse;

      if (!json.ok) {
        setErrorMsg(json.error || "Erro a guardar o perfil.");
        setSaving(false);
        return;
      }

      await fetch("/api/notifications/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowEmailNotifications,
          allowEventReminders,
          allowFriendRequests,
          allowSalesAlerts,
          allowSystemAnnouncements,
        }),
      }).catch(() => null);

      setSuccessMsg("Perfil atualizado!");

      // Atualiza o cache do /api/auth/me
      await mutate();

      setTimeout(() => {
        router.push("/me");
      }, 800);
    } catch (err) {
      console.error("Erro inesperado ao guardar perfil:", err);
      setErrorMsg("Erro inesperado ao guardar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen orya-body-bg text-white flex items-center justify-center">
        <p className="text-white/60 text-sm">A carregar o teu perfil…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen orya-body-bg text-white pb-24">
      <div className="max-w-xl mx-auto px-5 pt-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Editar perfil
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Ajusta o teu nome e username dentro da ORYA.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/me")}
            className="hidden sm:inline-flex items-center gap-2 text-[11px] text-white/55 hover:text-white/85"
          >
            ← Voltar à conta
          </button>
        </header>

        {/* Mensagens */}
        {errorMsg && (
          <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 rounded-lg text-red-200 text-sm">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 border border-emerald-500/40 bg-emerald-500/10 rounded-lg text-emerald-200 text-sm">
            {successMsg}
          </div>
        )}

        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-slate-950/85 to-slate-950 backdrop-blur-xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.8)] space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-full border border-white/15 bg-white/5 overflow-hidden flex items-center justify-center shadow-[0_0_18px_rgba(107,255,255,0.35)]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-white/70">
                  {fullName?.[0]?.toUpperCase() || "?"}
                </span>
              )}
              <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/10" />
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex gap-2 flex-wrap">
                <label className="cursor-pointer rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 hover:border-white/35">
                  {avatarUploading ? "A enviar..." : "Carregar nova foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
                    disabled={avatarUploading}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/75 hover:border-red-400 hover:text-red-200"
                >
                  Remover foto
                </button>
              </div>
              <p className="text-[11px] text-white/55">Foto circular, idealmente quadrada (ex.: 800x800).</p>
              {uploadError && <p className="text-[11px] text-red-300">{uploadError}</p>}
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-sm">Nome público</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 text-sm"
                placeholder="Como te chamas?"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white/70 text-sm">Username</label>
              <input
                type="text"
                inputMode="text"
                pattern="[A-Za-z0-9._]{0,30}"
                value={username}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cleaned = sanitizeUsername(raw);
                  setUsername(cleaned);
                  const validation = validateUsername(cleaned);
                  setUsernameHint(validation.valid ? null : validation.error);
                  setUsernameAvailable(null);
                }}
                onBlur={(e) => checkUsernameAvailability(e.target.value)}
                maxLength={30}
                className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 text-sm"
                placeholder="Escolhe o teu @username"
              />
              {usernameHint && (
                <p className="text-[11px] text-amber-300 mt-1">{usernameHint}</p>
              )}
              <p className="text-[11px] text-white/55 mt-1">
                Este será o link do teu perfil público (ex.: orya.app/@teuusername).
              </p>
              {checkingUsername && (
                <p className="text-[11px] text-white/60 mt-1">
                  A verificar disponibilidade…
                </p>
              )}
              {usernameAvailable === false && !checkingUsername && (
                <p className="text-[11px] text-red-300 mt-1">
                  Esse username já está usado.
                </p>
              )}
              {usernameAvailable && !checkingUsername && (
                <p className="text-[11px] text-emerald-300 mt-1">
                  Username disponível ✔
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-black/30 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Visibilidade do perfil</p>
                <div className="space-y-2 text-sm text-white/75">
                  {[
                    {
                      key: "PUBLIC" as const,
                      title: "Público",
                      desc: "Visível em listas públicas, convites e páginas de evento.",
                    },
                    {
                      key: "PRIVATE" as const,
                      title: "Privado",
                      desc: "Mostra só avatar, nome e username. Sem email/telefone.",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 transition ${
                        profileVisibility === opt.key
                          ? "border-white/60 bg-white/10"
                          : "border-white/15 bg-black/30 hover:border-white/35"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{opt.title}</span>
                        <input
                          type="radio"
                          name="visibility"
                          className="accent-white"
                          checked={profileVisibility === opt.key}
                          onChange={() => setProfileVisibility(opt.key)}
                        />
                      </div>
                      <p className="text-xs text-white/65">{opt.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Notificações</p>
                <div className="space-y-2 text-sm text-white/75">
                  {[
                    {
                      key: "allowEmailNotifications" as const,
                      label: "Emails de novidades e segurança",
                      value: allowEmailNotifications,
                      setter: setAllowEmailNotifications,
                    },
                    {
                      key: "allowEventReminders" as const,
                      label: "Lembretes de eventos/experiências",
                      value: allowEventReminders,
                      setter: setAllowEventReminders,
                    },
                    {
                      key: "allowFriendRequests" as const,
                      label: "Pedidos de amizade / convites",
                      value: allowFriendRequests,
                      setter: setAllowFriendRequests,
                    },
                    {
                      key: "allowSalesAlerts" as const,
                      label: "Alertas de vendas/promoções",
                      value: allowSalesAlerts,
                      setter: setAllowSalesAlerts,
                    },
                    {
                      key: "allowSystemAnnouncements" as const,
                      label: "Anúncios do sistema",
                      value: allowSystemAnnouncements,
                      setter: setAllowSystemAnnouncements,
                    },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
                    >
                      <span className="text-white/80">{opt.label}</span>
                      <button
                        type="button"
                        onClick={() => opt.setter(!opt.value)}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                          opt.value ? "bg-white text-black" : "border border-white/25 text-white/70 hover:border-white/60"
                        }`}
                      >
                        {opt.value ? "On" : "Off"}
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/me")}
                className="inline-flex justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-xs font-medium text-white/80 hover:border-white/40 hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] shadow-[0_0_22px_#1646F577] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
