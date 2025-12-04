"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

type ExperienceItem = {
  id: number;
  slug: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  locationCity: string;
  isFree: boolean;
  host?: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string;
  };
};

export default function ExperiencePage() {
  const params = useParams();
  const slug = params.slug as string;

  const { user, profile, isLoading } = useUser();
  const { openModal } = useAuthModal();

  const [experience, setExperience] = useState<ExperienceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function checkJoined(eventId: number) {
    if (!user) return;
    try {
      const res = await fetch(`/api/experiencias/join/status?eventId=${eventId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.joined) setJoined(true);
    } catch (err) {
      console.error("Erro a verificar join:", err);
    }
  }

  async function loadExperience() {
    setLoading(true);
    setExperience(null);

    try {
      const res = await fetch(
        "/api/experiencias/list?slug=" + encodeURIComponent(slug) + "&limit=1",
      );
      const json = await res.json();
      setExperience(json.items?.[0] || null);
      if (json.items?.[0]?.id) {
        await checkJoined(json.items[0].id);
      }
    } catch {
      setExperience(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    loadExperience();
  }, [slug]);

  async function handleJoin() {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/experiencias/" + slug, showGoogle: true });
      return;
    }
    if (!experience) return;

    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/experiencias/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: experience.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        setJoinError(data?.error || "Erro ao juntar-se à experiência.");
      } else {
        setJoined(true);
        await loadExperience();
      }
    } catch {
      setJoinError("Erro ao juntar-se à experiência.");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!experience) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <p>Experiência não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-10">
      <h1 className="text-xl font-semibold">{experience.title}</h1>
      {experience.host?.username && (
        <p className="mt-2 text-sm text-gray-600">
          Criado por{" "}
          <a href={`/${experience.host.username}`} className="text-blue-600 hover:underline">
            @{experience.host.username}
          </a>
        </p>
      )}
      <p className="mt-4">{experience.description}</p>
      <p className="mt-4 text-sm text-gray-700">
        Início: {new Date(experience.startsAt).toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-gray-700">
        Local: {experience.locationName}, {experience.locationCity}
      </p>
      {experience.isFree && (
        <p className="mt-1 text-sm font-semibold text-green-600">Gratuita</p>
      )}
      <div className="mt-6">
        <button
          onClick={handleJoin}
          disabled={joining || joined}
          className={`px-4 py-2 rounded ${
            joined
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {joined ? "Já vais" : joining ? "A juntar-me..." : "Juntar-me"}
        </button>
        {joinError && <p className="mt-2 text-red-600">{joinError}</p>}
      </div>
    </div>
  );
}
