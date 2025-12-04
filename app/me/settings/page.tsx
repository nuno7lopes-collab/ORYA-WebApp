"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { user, profile, isLoading, error, mutate } = useUser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [allowEmailNotifications, setAllowEmailNotifications] = useState(true);
  const [allowEventReminders, setAllowEventReminders] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (profile?.visibility) setVisibility(profile.visibility as "PUBLIC" | "PRIVATE");
    if (typeof profile?.allowEmailNotifications === "boolean") {
      setAllowEmailNotifications(profile.allowEmailNotifications);
    }
    if (typeof profile?.allowEventReminders === "boolean") {
      setAllowEventReminders(profile.allowEventReminders);
    }
    if (typeof profile?.allowFriendRequests === "boolean") {
      setAllowFriendRequests(profile.allowFriendRequests);
    }
  }, [profile?.allowEmailNotifications, profile?.allowEventReminders, profile?.allowFriendRequests, profile?.visibility, user?.email]);

  async function handleSaveSettings() {
    if (!user) return;
    setSavingSettings(true);
    setFeedback(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/me/settings/save", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          allowEmailNotifications,
          allowEventReminders,
          allowFriendRequests,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Erro ao guardar definições.");
      }
      setFeedback("Definições guardadas.");
      await mutate();
    } catch (err) {
      console.error(err);
      setErrorMsg("Não foi possível guardar as definições.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleEmailUpdate() {
    if (!email.trim()) {
      setErrorMsg("Indica um email válido.");
      return;
    }

    setSavingEmail(true);
    setFeedback(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/me/settings/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Erro ao atualizar email.");
      }
      setFeedback(json.message || "Email atualizado.");
      await mutate();
    } catch (err) {
      console.error(err);
      setErrorMsg("Não foi possível atualizar o email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Erro no logout:", err);
    } finally {
      setLogoutLoading(false);
      router.push("/login");
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== "APAGAR CONTA") {
      setErrorMsg("Para confirmar, escreve: APAGAR CONTA");
      return;
    }
    setDeleting(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/me/settings/delete", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao apagar conta.");
      }
      if (json.warning) {
        setFeedback(json.warning);
      }
      setShowDeleteConfirm(false);
      router.push("/login");
    } catch (err) {
      console.error(err);
      setErrorMsg("Não foi possível apagar a conta. Tenta mais tarde.");
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <div className="max-w-4xl mx-auto px-5 py-10">
          <div className="h-36 rounded-2xl border border-white/10 bg-white/5 animate-pulse blur-[0.2px]" />
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <div className="max-w-3xl mx-auto px-5 py-10 space-y-4">
          <h1 className="text-xl font-semibold">Definições</h1>
          <p className="text-sm text-white/70">
            Precisas de iniciar sessão para aceder às definições da conta.
          </p>
          <Link
            href="/login?redirectTo=/me/settings"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm font-semibold"
          >
            Entrar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="orya-body-bg min-h-screen text-white">
      <section className="max-w-4xl mx-auto px-5 py-10 space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Definições</h1>
          <p className="text-sm text-white/70">
            Zona segura para gerir email, privacidade, notificações e terminar sessão.
          </p>
        </header>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMsg}
          </div>
        )}
        {feedback && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-xl p-5 space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white/90">Email</h2>
              <p className="text-xs text-white/60">
                Atualiza o email de login. O Supabase pode pedir confirmação.
              </p>
            </div>
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60"
              />
              <button
                type="button"
                onClick={handleEmailUpdate}
                disabled={savingEmail}
                className="inline-flex items-center justify-center rounded-full bg-white text-black px-4 py-2 text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60"
              >
                {savingEmail ? "A atualizar..." : "Atualizar email"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-xl p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white/90">Privacidade</h2>
              <p className="text-xs text-white/60">Controla quem pode ver o teu perfil.</p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  value="PUBLIC"
                  checked={visibility === "PUBLIC"}
                  onChange={() => setVisibility("PUBLIC")}
                  className="h-3 w-3 accent-[#6BFFFF]"
                />
                <span>Perfil público</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  value="PRIVATE"
                  checked={visibility === "PRIVATE"}
                  onChange={() => setVisibility("PRIVATE")}
                  className="h-3 w-3 accent-[#FF00C8]"
                />
                <span>Perfil privado (mostra só avatar, nome e username)</span>
              </label>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-xl p-5 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white/90">Notificações</h2>
            <p className="text-xs text-white/60">Controla emails e alertas relevantes.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-white/80">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowEmailNotifications}
                onChange={(e) => setAllowEmailNotifications(e.target.checked)}
                className="h-3 w-3 accent-[#6BFFFF]"
              />
              <span>Email de novidades e segurança</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowEventReminders}
                onChange={(e) => setAllowEventReminders(e.target.checked)}
                className="h-3 w-3 accent-[#6BFFFF]"
              />
              <span>Lembretes de eventos / experiências</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowFriendRequests}
                onChange={(e) => setAllowFriendRequests(e.target.checked)}
                className="h-3 w-3 accent-[#6BFFFF]"
              />
              <span>Pedidos de amizade / convites</span>
            </label>
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-white text-black px-4 py-2 text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60"
          >
            {savingSettings ? "A guardar..." : "Guardar definições"}
          </button>
        </section>

        <section className="rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-xl p-5 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white/90">Sessão e conta</h2>
            <p className="text-xs text-white/60">
              Termina sessão ou apaga a tua conta. Apagar é definitivo (events ficam marcados como
              apagados).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-60"
            >
              {logoutLoading ? "A terminar sessão..." : "Terminar sessão"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteConfirmText("");
                setFeedback(null);
                setErrorMsg(null);
              }}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-100 hover:bg-red-500/20 transition disabled:opacity-60"
            >
              {deleting ? "A apagar..." : "Apagar conta"}
            </button>
          </div>
        </section>

        <div className="flex items-center gap-2">
          <Link
            href="/me"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
          >
            ← Voltar à conta
          </Link>
        </div>
      </section>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="relative w-full max-w-md rounded-2xl border border-white/12 bg-gradient-to-b from-[#0b0b13]/95 to-[#0b0b13]/90 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Zona segura</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Apagar conta ORYA</h3>
              </div>
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-white/10 text-white/70 hover:bg-white/10 transition"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
                aria-label="Fechar confirmação"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm text-white/70 leading-relaxed">
              Esta ação é definitiva. Os teus eventos e dados serão marcados como apagados. Para
              continuares, escreve <span className="font-semibold text-white">APAGAR CONTA</span>{" "}
              e confirma.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs text-white/60" htmlFor="delete-confirm-input">
                Confirmação
              </label>
              <input
                id="delete-confirm-input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="APAGAR CONTA"
                className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#FF4D8F] focus:ring-1 focus:ring-[#FF4D8F]/50 text-white placeholder:text-white/30"
                disabled={deleting}
              />
              {deleteConfirmText.length > 0 && deleteConfirmText.trim().toUpperCase() !== "APAGAR CONTA" && (
                <p className="text-xs text-red-300">Escreve exatamente: APAGAR CONTA.</p>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="w-full sm:w-auto rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "APAGAR CONTA"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-red-400/50 bg-gradient-to-r from-[#FF2A6F] to-[#FF6B2A] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_30px_rgba(255,77,143,0.35)] hover:translate-y-[-1px] active:translate-y-[0px] transition disabled:opacity-60"
              >
                {deleting ? "A apagar..." : "Confirmar eliminação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
