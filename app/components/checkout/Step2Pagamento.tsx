"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  loadStripe,
  type Appearance,
  type StripeElementsOptions,
} from "@stripe/stripe-js";
import { useCheckout } from "./contextoCheckout";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type CheckoutItem = {
  ticketId: number;
  quantity: number;
};

type CheckoutWave = {
  id: number | string;
  price: number;
};

type CheckoutData = {
  slug?: string;
  waves?: CheckoutWave[];
  additional?: {
    quantidades?: Record<string, number>;
    total?: number;
  };
};

export default function Step2Pagamento() {
  const { dados, irParaPasso } = useCheckout();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [serverAmount, setServerAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔐 Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const safeDados: CheckoutData | null =
    dados && typeof dados === "object" ? (dados as CheckoutData) : null;

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    return loadStripe(key);
  }, []);

  useEffect(() => {
    if (!stripePromise) {
      setError("Configuração de pagamentos indisponível. Tenta novamente mais tarde.");
      setLoading(false);
    }
  }, [stripePromise]);

  // Primeiro: verificar se há sessão Supabase no browser e ficar a escutar mudanças de auth
  useEffect(() => {
    let cancelled = false;

    async function checkAuthOnce() {
      try {
        setAuthChecking(true);
        const { data, error } = await supabaseBrowser.auth.getUser();

        if (cancelled) return;

        if (error || !data?.user) {
          setUserId(null);
        } else {
          setUserId(data.user.id);
        }
      } catch (err) {
        console.error("[Step2Pagamento] Erro ao verificar auth inicial:", err);
        if (!cancelled) {
          setUserId(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
          setAuthChecking(false);
        }
      }
    }

    checkAuthOnce();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (session?.user) {
        setUserId(session.user.id);
        setAuthChecked(true);
        setAuthChecking(false);
      } else {
        setUserId(null);
        setAuthChecked(true);
        setAuthChecking(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const payload = useMemo(() => {
    if (!safeDados) return null;

    const waves = Array.isArray(safeDados.waves) ? safeDados.waves : [];
    const additional =
      safeDados.additional && typeof safeDados.additional === "object"
        ? safeDados.additional
        : {};

    const quantidades: Record<string, number> =
      (additional.quantidades as Record<string, number> | undefined) ?? {};

    if (!safeDados.slug || waves.length === 0) return null;

    const items: CheckoutItem[] = waves
      .map((w) => {
        const qty = quantidades[w.id] ?? 0;
        if (!qty || qty <= 0) return null;
        const ticketId = Number(w.id);
        if (!Number.isFinite(ticketId)) return null;
        return { ticketId, quantity: qty };
      })
      .filter(Boolean) as CheckoutItem[];

    if (items.length === 0) return null;

    const totalFromStep1 =
      typeof additional.total === "number" ? additional.total : null;

    return {
      slug: safeDados.slug,
      items,
      total: totalFromStep1,
    };
  }, [safeDados]);

  useEffect(() => {
    // Se não houver dados de checkout, mandamos de volta
    if (!payload) {
      irParaPasso(1);
      return;
    }

    // Enquanto não sabemos se está logado, não fazemos nada
    if (!authChecked) return;

    // Se não está logado, garantimos que aparece o AuthWall e não chamamos a API
    if (!userId) {
      setLoading(false);
      setClientSecret(null);
      setServerAmount(null);
      return;
    }
    if (!stripePromise) return;

    let cancelled = false;

    async function createIntent() {
      try {
        setLoading(true);
        setError(null);

        console.log(
          "[Step2Pagamento] A enviar payload para /api/payments/intent:",
          payload,
        );

        const res = await fetch("/api/payments/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        console.log("[Step2Pagamento] Resposta de /api/payments/intent:", {
          status: res.status,
          ok: res.ok,
          data,
        });

        // Se a API disser 401 ➜ perder sessão entretanto
        if (res.status === 401) {
          if (!cancelled) {
            setUserId(null);
            setClientSecret(null);
            setServerAmount(null);
            setError(null);
          }
          return;
        }

        if (!res.ok || !data?.ok || !data.clientSecret) {
          const msg =
            typeof data?.error === "string"
              ? data.error
              : "Não foi possível preparar o pagamento.";

          if (!cancelled) setError(msg);
          return;
        }

        if (!cancelled) {
          setClientSecret(data.clientSecret as string);
          setServerAmount(
            typeof data.amount === "number" ? data.amount : null,
          );
        }
      } catch (err) {
        console.error("Erro ao criar PaymentIntent:", err);
        if (!cancelled) {
          setError("Erro inesperado ao preparar o pagamento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    createIntent();

    return () => {
      cancelled = true;
    };
  }, [payload, irParaPasso, authChecked, userId, stripePromise]);

  if (!safeDados) {
    return (
      <div className="p-6 text-sm text-white/70">
        Ocorreu um problema com os dados do checkout. Volta atrás e tenta de
        novo.
      </div>
    );
  }

  const additional =
    safeDados.additional && typeof safeDados.additional === "object"
      ? safeDados.additional
      : {};
  const totalFromContext =
    typeof additional.total === "number" ? additional.total : null;

  const total =
    totalFromContext !== null
      ? totalFromContext
      : serverAmount !== null
      ? serverAmount / 100
      : null;

  const appearance: Appearance = {
    theme: "night",
    variables: {
      colorPrimary: "#FF00C8",
      colorBackground: "#0A0A0F",
      colorText: "#F5F5F5",
      colorDanger: "#FF4242",
      fontFamily:
        "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      borderRadius: "16px",
    },
    rules: {
      ".Input": {
        padding: "14px",
        backgroundColor: "#11131A",
        border: "1px solid rgba(255,255,255,0.08)",
      },
    },
  };

  const options: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance,
        paymentMethodOrder: ["apple_pay", "card", "mb_way"],
      }
    : undefined;

  // Callback chamado pelo AuthWall quando o utilizador faz login/cria conta com sucesso
  const handleAuthenticated = (newUserId: string) => {
    setUserId(newUserId);
    setAuthChecked(true);
    setAuthChecking(false);
  };

  return (
    <div className="flex flex-col gap-6 text-white max-h-[80vh] overflow-hidden">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Passo 2 de 3
          </p>
          <h2 className="text-xl font-semibold leading-tight">Pagamento</h2>
          <p className="text-[11px] text-white/60 max-w-xs">
            Pagamento seguro processado pela Stripe.
          </p>
        </div>
      </header>

      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]" />
      </div>

      {/* 🔐 Se ainda estamos a verificar auth */}
      {authChecking && (
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_0_40px_rgba(255,0,200,0.25)]">
          <div className="relative mb-6">
            <div className="h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin" />
            <div className="absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20" />
          </div>
          <h3 className="text-sm font-semibold mb-1 animate-pulse">
            A verificar sessão…
          </h3>
          <p className="text-[11px] text-white/65 max-w-xs leading-relaxed">
            Estamos a confirmar se já tens sessão iniciada na ORYA.
          </p>
        </div>
      )}

      {/* 🔐 Se não está logado ➜ mostrar muro de autenticação dentro do Step 2 */}
      {!authChecking && !userId && <AuthWall onAuthenticated={handleAuthenticated} />}

      {/* 💳 Se está logado ➜ mostrar Stripe / estados normais */}
      {!authChecking && userId && (
        <>
          {error || !stripePromise ? (
            <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <span className="text-lg">⚠️</span> Ocorreu um problema
              </p>
              <p className="text-[12px] mb-4 leading-relaxed">
                {error ?? "Configuração de pagamentos indisponível. Tenta novamente mais tarde."}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
              >
                Tentar novamente
              </button>
            </div>
          ) : loading || !clientSecret || !options ? (
            <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_0_40px_rgba(255,0,200,0.25)]">
              <div className="relative mb-6">
                <div className="h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin" />
                <div className="absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20" />
              </div>
              <h3 className="text-sm font-semibold mb-1 animate-pulse">
                A preparar o teu pagamento…
              </h3>
              <p className="text-[11px] text-white/65 max-w-xs leading-relaxed">
                Estamos a ligar-te à Stripe para criar uma transação segura.
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <span className="text-lg">⚠️</span> Ocorreu um problema
              </p>
              <p className="text-[12px] mb-4 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[65vh]">
              <Elements stripe={stripePromise} options={options}>
                <PaymentForm total={total} />
              </Elements>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type PaymentFormProps = {
  total: number | null;
};

function PaymentForm({ total }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { irParaPasso, atualizarDados, dados } = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        setError(error.message ?? "O pagamento não foi concluído.");
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        atualizarDados({
          additional: {
            ...(dados?.additional ?? {}),
            paymentIntentId: paymentIntent.id,
          },
        });
        irParaPasso(3);
      }
    } catch (err) {
      console.error("Erro ao confirmar pagamento:", err);
      setError("Erro inesperado ao confirmar o pagamento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {total !== null && (
        <div className="flex items-center justify-between rounded-xl bg-black/50 px-5 py-3 text-sm shadow-inner shadow-black/40 border border-white/10">
          <div className="flex items-center gap-2 text-white/75">
            <span className="text-xs">🔒</span>
            <span>Total a pagar</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            {total.toFixed(2)} €
          </span>
        </div>
      )}

      <div className="rounded-xl bg-black/40 px-3 py-3 text-sm min-h-[320px] max-h-[400px] overflow-y-auto pr-1">
        <PaymentElement />
      </div>

      {error && (
        <p className="text-[11px] text-red-300 mt-1 leading-snug">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-3 text-xs font-semibold text-black shadow-[0_0_32px_rgba(107,255,255,0.55)] disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-95 transition-transform"
      >
        {submitting ? "A processar…" : "Pagar agora"}
      </button>

      <p className="mt-2 text-[10px] text-white/40 text-center leading-snug">
        Pagamento seguro processado pela Stripe. A ORYA nunca guarda dados do
        teu cartão.
      </p>
    </form>
  );
}

type AuthWallProps = {
  onAuthenticated?: (userId: string) => void;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function AuthWall({ onAuthenticated }: AuthWallProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!identifier || !password) {
        setError("Preenche o email/username e a palavra-passe.");
        return;
      }

      let emailToUse = identifier;
      if (!identifier.includes("@")) {
        const res = await fetch("/api/auth/resolve-identifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data?.email) {
          setError("Credenciais inválidas. Confirma username/email e password.");
          return;
        }
        emailToUse = data.email;
      }

      if (mode === "login") {
        const { error } = await supabaseBrowser.auth.signInWithPassword({
          email: emailToUse,
          password,
        });
        if (error) {
          setError(error.message ?? "Não foi possível iniciar sessão.");
          return;
        }
      } else {
        const { error } = await supabaseBrowser.auth.signUp({
          email: emailToUse,
          password,
        });
        if (error) {
          setError(error.message ?? "Não foi possível criar conta.");
          return;
        }
      }

      // Pequeno delay para garantir que a sessão foi escrita nos cookies
      await delay(600);

      // Depois do delay, garantimos que a sessão está disponível e notificamos o Step2
      try {
        const { data: userData } = await supabaseBrowser.auth.getUser();
        if (userData?.user) {
          onAuthenticated?.(userData.user.id);
        }
      } catch (e: unknown) {
        console.warn("[AuthWall] Não foi possível ler user após login:", e);
      }
    } catch (err) {
      console.error("[AuthWall] Erro:", err);
      setError("Ocorreu um erro. Tenta novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">
            Inicia sessão para continuar
          </h3>
          <p className="text-[11px] text-white/60 max-w-sm leading-relaxed">
            Para associar os bilhetes à tua conta ORYA e evitar problemas no
            check-in, tens de estar com a sessão iniciada antes de pagar.
          </p>
        </div>
        <span className="text-[20px]">🔐</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
        <div className="flex gap-2 text-[11px] bg-black/40 rounded-full p-1 border border-white/10 w-fit">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`px-3 py-1 rounded-full ${
              mode === "login"
                ? "bg-white text-black font-semibold"
                : "text-white/70"
            }`}
          >
            Já tenho conta
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`px-3 py-1 rounded-full ${
              mode === "signup"
                ? "bg-white text-black font-semibold"
                : "text-white/70"
            }`}
          >
            Criar conta
          </button>
        </div>

        <div className="flex flex-col gap-2 text-[12px]">
          <div className="flex flex-col gap-1">
            <label className="text-white/70">Email ou username</label>
            <input
              type="text"
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="nome@exemplo.com ou @username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/70">Palavra-passe</label>
            <input
              type="password"
              className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>
        </div>

        {error && (
          <p className="text-[11px] text-red-300 mt-1 leading-snug">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-xs font-semibold text-black shadow-[0_0_24px_rgba(107,255,255,0.55)] disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-transform"
        >
          {submitting
            ? mode === "login"
              ? "A entrar…"
              : "A criar conta…"
            : mode === "login"
            ? "Iniciar sessão e continuar"
            : "Criar conta e continuar"}
        </button>

        <p className="mt-1 text-[10px] text-white/40 leading-snug">
          Ao continuares, aceitas os termos da ORYA. Podes gerir a tua conta e
          eventos em qualquer momento dentro da app.
        </p>
      </form>
    </div>
  );
}
