"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ForbiddenClientProps = {
  email?: string | null;
};

export default function ForbiddenClient({ email }: ForbiddenClientProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const prev = document.body.getAttribute("data-nav-hidden");
    document.body.setAttribute("data-nav-hidden", "true");
    return () => {
      if (prev) {
        document.body.setAttribute("data-nav-hidden", prev);
      } else {
        document.body.removeAttribute("data-nav-hidden");
      }
    };
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    } finally {
      window.location.href = "/login?logout=1";
    }
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-3 text-sm">
      {email ? (
        <p className="text-white/60">Sessão ativa: {email}</p>
      ) : (
        <p className="text-white/60">Sem sessão ativa.</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-rose-100 hover:bg-rose-500/20"
        >
          {loggingOut ? "A terminar sessão…" : "Terminar sessão"}
        </button>
        <Link
          href="/login?redirectTo=/admin"
          className="rounded-full border border-white/15 px-4 py-2 text-white/80 hover:bg-white/10"
        >
          Trocar de conta
        </Link>
        <Link
          href="/"
          className="rounded-full border border-white/10 px-4 py-2 text-white/60 hover:bg-white/5"
        >
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}
