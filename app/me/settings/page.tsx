"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Visibility = "PUBLIC" | "PRIVATE";
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { user, profile, isLoading, error, mutate } = useUser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [allowEmailNotifications, setAllowEmailNotifications] = useState(true);
  const [allowEventReminders, setAllowEventReminders] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [allowSalesAlerts, setAllowSalesAlerts] = useState(true);
  const [allowSystemAnnouncements, setAllowSystemAnnouncements] = useState(true);

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
    if (profile?.visibility) setVisibility(profile.visibility as Visibility);
    if (typeof profile?.allowEmailNotifications === "boolean") {
      setAllowEmailNotifications(profile.allowEmailNotifications);
    }
    if (typeof profile?.allowEventReminders === "boolean") {
      setAllowEventReminders(profile.allowEventReminders);
    }
    if (typeof profile?.allowFriendRequests === "boolean") {
      setAllowFriendRequests(profile.allowFriendRequests);
    }
  }, [
    profile?.allowEmailNotifications,
    profile?.allowEventReminders,
    profile?.allowFriendRequests,
    profile?.visibility,
    user?.email,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      try {
        const res = await fetch("/api/notifications/prefs");
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.prefs) {
          setAllowEmailNotifications(Boolean(json.prefs.allowEmailNotifications));
          setAllowEventReminders(Boolean(json.prefs.allowEventReminders));
          setAllowFriendRequests(Boolean(json.prefs.allowFriendRequests));
          setAllowSalesAlerts(Boolean(json.prefs.allowSalesAlerts));
          setAllowSystemAnnouncements(Boolean(json.prefs.allowSystemAnnouncements));
        }
      } catch (err) {
        console.warn("[settings] load prefs failed", err);
      }
    }
    if (user) loadPrefs();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
          allowSalesAlerts,
          allowSystemAnnouncements,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao guardar definições.");

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
      });

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
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao atualizar email.");
      setFeedback(json.message || "Email atualizado.");
      await mutate();
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível atualizar o email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await supabaseBrowser.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Erro no logout:", err);
    } finally {
      setLogoutLoading(false);
      router.refresh();
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
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao apagar conta.");
      setFeedback(json.message || "Conta marcada para eliminação. Podes reverter dentro de 30 dias.");
      setShowDeleteConfirm(false);
      router.push("/login?pending_delete=1");
    } catch (err) {
      console.error(err);
      setErrorMsg("Não foi possível marcar a eliminação. Tenta mais tarde.");
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden text-white">
        <div className="relative orya-page-width px-5 py-10">
          <div className="h-36 rounded-3xl border border-white/15 orya-skeleton-surface animate-pulse shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl" />
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden text-white">
        <div className="relative orya-page-width px-5 py-10 space-y-4">
          <h1 className="text-xl font-semibold">Definições</h1>
          <p className="text-sm text-white/70">Precisas de iniciar sessão para aceder às definições da conta.</p>
          <Link
            href="/login?redirectTo=/me/settings"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm font-semibold shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:shadow-[0_22px_55px_rgba(255,255,255,0.25)]"
          >
            Entrar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <section className="relative orya-page-width px-4 pb-14 pt-10 space-y-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">Área pessoal</p>
            <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-bold leading-tight text-transparent">
              Definições
            </h1>
            <p className="text-sm text-white/70">
              Controla email, privacidade, notificações e sessão num painel com efeito glassy ORYA.
            </p>
          </div>
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-[0_16px_40px_rgba(127,29,29,0.35)] backdrop-blur-xl">
            {errorMsg}
          </div>
        )}
        {feedback && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-[0_16px_40px_rgba(16,185,129,0.35)] backdrop-blur-xl">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white/90 tracking-[0.08em]">Email</h2>
              <p className="text-xs text-white/65">Atualiza o email de login. Podemos pedir confirmação.</p>
            </div>
            <div className="mt-3 space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-black/35 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60"
              />
              <button
                type="button"
                onClick={handleEmailUpdate}
                disabled={savingEmail}
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 text-black px-4 py-2 text-sm font-semibold shadow-[0_10px_26px_rgba(255,255,255,0.2)] hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60"
              >
                {savingEmail ? "A atualizar..." : "Atualizar email"}
              </button>
            </div>
          </Card>

          <Card>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white/90 tracking-[0.08em]">Privacidade</h2>
              <p className="text-xs text-white/65">Controla quem pode ver o teu perfil.</p>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/80">
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2">
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
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                <input
                  type="radio"
                  name="visibility"
                  value="PRIVATE"
                  checked={visibility === "PRIVATE"}
                  onChange={() => setVisibility("PRIVATE")}
                  className="h-3 w-3 accent-[#FF00C8]"
                />
                <span>Perfil privado (conteúdo do perfil só para ti)</span>
              </label>
            </div>
          </Card>
        </div>

        <Card>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white/90 tracking-[0.08em]">Notificações</h2>
            <p className="text-xs text-white/65">Controla emails e alertas relevantes.</p>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm text-white/80">
            {[
              { value: allowEmailNotifications, setter: setAllowEmailNotifications, label: "Email de novidades e segurança" },
              { value: allowEventReminders, setter: setAllowEventReminders, label: "Lembretes de eventos" },
              { value: allowFriendRequests, setter: setAllowFriendRequests, label: "Pedidos de amizade / convites" },
              { value: allowSalesAlerts, setter: setAllowSalesAlerts, label: "Alertas de vendas / estado Stripe" },
              { value: allowSystemAnnouncements, setter: setAllowSystemAnnouncements, label: "Anúncios do sistema / updates críticos" },
            ].map((opt) => (
              <label
                key={opt.label}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={opt.value}
                  onChange={(e) => opt.setter(e.target.checked)}
                  className="h-3 w-3 accent-[#6BFFFF]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 text-black px-4 py-2 text-sm font-semibold shadow-[0_10px_26px_rgba(255,255,255,0.2)] hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60"
          >
            {savingSettings ? "A guardar..." : "Guardar definições"}
          </button>
        </Card>

        <Card>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white/90 tracking-[0.08em]">Sessão e conta</h2>
            <p className="text-xs text-white/65">
              Termina sessão ou marca a tua conta para eliminação. Tens 30 dias para reverter; depois desse prazo, a conta é anonimizada.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 transition disabled:opacity-60"
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
              className="inline-flex items-center gap-2 rounded-full border border-red-400/35 bg-red-500/12 px-4 py-2 text-sm text-red-100 hover:bg-red-500/18 transition disabled:opacity-60"
            >
              {deleting ? "A apagar..." : "Apagar conta"}
            </button>
          </div>
        </Card>

        <div className="flex items-center gap-2">
          <Link
            href="/me"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10 transition"
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
              Vamos marcar a tua conta para eliminação e desativá-la de imediato. Tens 30 dias para reativar fazendo
              login ou clicando no link do email de cancelamento. Após esse prazo, os dados pessoais são anonimizados.
              Para continuares, escreve <span className="font-semibold text-white">APAGAR CONTA</span> e confirma.
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
