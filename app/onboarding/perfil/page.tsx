"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";

export default function OnboardingPerfilPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const { user, profile, isLoading, refetch } = useUser();

  // Se não estiver autenticado e não estiver a carregar, manda embora
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-gray-500">A carregar o teu perfil...</p>
      </div>
    );
  }

  return (
    <ProfileForm
      initialFullName={profile.fullName ?? ""}
      initialUsername={profile.username ?? ""}
      onSaved={async () => {
        await refetch();
        router.push(redirectTo || "/");
      }}
    />
  );
}

type ProfileFormProps = {
  initialFullName: string;
  initialUsername: string;
  onSaved: () => Promise<void>;
};

function ProfileForm({
  initialFullName,
  initialUsername,
  onSaved,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [username, setUsername] = useState(initialUsername);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function checkUsernameAvailability(currentUsername: string) {
    const trimmed = currentUsername.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");
    try {
      const res = await fetch("/api/profiles/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      if (!res.ok) {
        setUsernameStatus("error");
        return;
      }

      const data = (await res.json()) as { available: boolean };
      setUsernameStatus(data.available ? "available" : "taken");
    } catch (e) {
      console.error("Erro a verificar username:", e);
      setUsernameStatus("error");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedName || !trimmedUsername) {
      setError("Preenche o nome e o username.");
      return;
    }

    setIsSubmitting(true);

    // Garantir que o username está disponível antes de gravar
    await checkUsernameAvailability(trimmedUsername);
    if (usernameStatus === "taken") {
      setIsSubmitting(false);
      setError("Este username já está a ser usado.");
      return;
    }

    try {
      const res = await fetch("/api/profiles/save-basic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: trimmedName, username: trimmedUsername }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || "Não foi possível gravar o perfil.";
        setError(message);
        setIsSubmitting(false);
        return;
      }

      await onSaved();
    } catch (err) {
      console.error("Erro a gravar perfil:", err);
      setError("Ocorreu um erro ao gravar. Tenta novamente.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Completa o teu perfil</h1>
        <p className="text-sm text-gray-500 mb-6">
          Só precisas de definir o teu nome e um username. Depois disto já estás
          pronto para criar experiências e juntar-te a eventos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="fullName">
              Nome completo
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/80"
              placeholder="Como os teus amigos te conhecem"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="username">
              Username
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                @
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameStatus("idle");
                }}
                onBlur={() => checkUsernameAvailability(username)}
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/80"
                placeholder="teu.nome"
              />
            </div>
            <p className="text-xs text-gray-400">
              Este será o link público do teu perfil: orya.app/@{username || "teu.username"}
            </p>
            {usernameStatus === "checking" && (
              <p className="text-xs text-gray-500">A verificar disponibilidade...</p>
            )}
            {usernameStatus === "available" && username && (
              <p className="text-xs text-green-600">Este username está disponível.</p>
            )}
            {usernameStatus === "taken" && (
              <p className="text-xs text-red-600">Este username já existe, escolhe outro.</p>
            )}
            {usernameStatus === "error" && (
              <p className="text-xs text-red-600">Não foi possível verificar o username.</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
          >
            {isSubmitting ? "A guardar..." : "Guardar e continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
