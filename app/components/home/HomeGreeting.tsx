"use client";

import { useUser } from "@/app/hooks/useUser";

function resolveFirstName(value?: string | null) {
  if (!value) return "";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? "";
}

export default function HomeGreeting() {
  const { profile, isLoggedIn } = useUser();
  const name = resolveFirstName(profile?.fullName) || profile?.username || "";
  const greeting = isLoggedIn && name ? `Bem-vindo de volta, ${name}` : "Bem-vindo de volta";

  return (
    <div className="space-y-1">
      <p className="text-2xl font-semibold text-white md:text-3xl">
        {greeting} 👋
      </p>
      <p className="text-sm text-white/70">O que vais querer fazer hoje?</p>
    </div>
  );
}
