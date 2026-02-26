"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type CommunityInviteLandingClientProps = {
  token: string;
  invitePath: string;
  isAuthenticated: boolean;
};

export default function CommunityInviteLandingClient({
  token,
  invitePath,
  isAuthenticated,
}: CommunityInviteLandingClientProps) {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [hasTriedAutoOpen, setHasTriedAutoOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const deepLink = useMemo(
    () => `orya://messages/community-invite/${encodeURIComponent(token)}?source=web_invite_link`,
    [token],
  );
  const loginHref = useMemo(
    () => `/login?redirectTo=${encodeURIComponent(invitePath)}`,
    [invitePath],
  );

  useEffect(() => {
    const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
    setIsMobileDevice(mobile);
  }, []);

  const openInApp = useCallback(() => {
    setFeedback(null);
    setHasTriedAutoOpen(true);
    window.location.href = deepLink;

    window.setTimeout(() => {
      setFeedback("Se a app não abriu, abre a ORYA manualmente no telemóvel.");
    }, 1200);
  }, [deepLink]);

  useEffect(() => {
    if (!isAuthenticated || !isMobileDevice || hasTriedAutoOpen) return;
    openInApp();
  }, [hasTriedAutoOpen, isAuthenticated, isMobileDevice, openInApp]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#04070f_0%,#0a1224_58%,#0f1b2f_100%)] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-xl space-y-5 rounded-3xl border border-white/14 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/64">Convite</p>
          <h1 className="text-2xl font-semibold text-white">Entrar numa comunidade ORYA</h1>
          <p className="text-sm text-white/75">
            Este convite continua na app ORYA no telemóvel.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="space-y-3 rounded-2xl border border-white/14 bg-white/[0.04] p-4">
            <p className="text-sm text-white/80">Inicia sessão para continuar com este convite.</p>
            <Link
              href={loginHref}
              className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_14px_34px_rgba(255,255,255,0.22)]"
            >
              Iniciar sessão
            </Link>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-white/14 bg-white/[0.04] p-4">
            <p className="text-sm text-white/82">
              {isMobileDevice
                ? "A abrir o convite na app ORYA..."
                : "Abre este convite no telemóvel para continuar na app ORYA."}
            </p>
            <button
              type="button"
              onClick={openInApp}
              className="inline-flex rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/18"
            >
              Abrir na app ORYA
            </button>
            <a
              href={deepLink}
              className="inline-flex rounded-full border border-white/25 bg-transparent px-4 py-2 text-sm text-white/86 hover:border-white/40"
            >
              Tentar deep link direto
            </a>
          </div>
        )}

        {feedback ? <p className="text-xs text-cyan-100/90">{feedback}</p> : null}
      </div>
    </main>
  );
}
