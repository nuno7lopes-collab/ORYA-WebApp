

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

type ExperienceListItem = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  locationName: string | null;
  locationCity: string | null;
  isFree: boolean;
  host: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Data a definir";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Data a definir";
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExperiencesPage() {
  const [items, setItems] = useState<ExperienceListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoadingList(true);
        setError(null);
        const res = await fetch("/api/experiencias/list");
        if (!res.ok) {
          throw new Error("Falha ao carregar experiências.");
        }
        const data = (await res.json()) as { items: ExperienceListItem[] };
        if (!cancelled) {
          setItems(data.items || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Falha a carregar experiências:", err);
          setError("Não foi possível carregar as experiências.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreateClick() {
    if (isUserLoading) return;

    if (!user) {
      openModal({ mode: "login", redirectTo: "/experiencias/nova", showGoogle: true });
      return;
    }

    router.push("/experiencias/nova");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Experiências</h1>
          <p className="text-sm text-neutral-500">
            Explora experiências criadas por outros utilizadores ORYA ou cria a tua.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateClick}
          className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-white/10 border border-white/20 hover:bg-white/20 transition"
        >
          Criar experiência
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {isLoadingList ? (
        <div className="text-sm text-neutral-400">A carregar experiências...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-neutral-400">
          Ainda não existem experiências. Sê o primeiro a criar uma.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((exp) => (
            <Link
              key={exp.id}
              href={`/experiencias/${exp.slug}`}
              className="group rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold line-clamp-1 group-hover:underline">
                  {exp.title}
                </h2>
                <span className="text-[11px] px-2 py-1 rounded-full border border-white/20 text-neutral-200">
                  {exp.isFree ? "Gratuita" : "Com custo"}
                </span>
              </div>

              <p className="text-xs text-neutral-400 line-clamp-2">
                {exp.description || "Sem descrição."}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-300">
                <span>{formatDateTime(exp.startsAt)}</span>
                {exp.locationName && (
                  <span>• {exp.locationName}</span>
                )}
                {exp.locationCity && (
                  <span>• {exp.locationCity}</span>
                )}
              </div>

              {exp.host && (
                <div className="mt-2 text-[11px] text-neutral-400">
                  Criado por {" "}
                  <span className="font-medium">@{exp.host.username || "utilizador"}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
