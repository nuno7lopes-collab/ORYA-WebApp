"use client";

import Link from "next/link";

export type ProfileHeaderProps = {
  /** Se é o próprio utilizador a ver o seu perfil */
  isOwner: boolean;
  /** Nome completo do utilizador (ex: "Nuno Lopes") */
  name?: string | null;
  /** Username público (ex: "nuno") */
  username?: string | null;
  /** URL do avatar (pode ser null) */
  avatarUrl?: string | null;
  /** Pequena descrição ou bio (opcional, para o futuro) */
  bio?: string | null;
  /** Data de criação da conta em ISO (opcional) */
  createdAt?: string | null;
};

function formatJoinedDate(createdAt?: string | null): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function ProfileHeader({
  isOwner,
  name,
  username,
  avatarUrl,
  bio,
  createdAt,
}: ProfileHeaderProps) {
  const displayName = name?.trim() || "Utilizador ORYA";
  const handle = username?.trim() || undefined;
  const joinedLabel = formatJoinedDate(createdAt);

  const ownerHasPublicProfile = Boolean(handle);

  const safeAvatarUrl = avatarUrl && avatarUrl.trim().length > 0
    ? avatarUrl
    : undefined;

  const publicProfileHref = ownerHasPublicProfile ? `/${handle}` : null;

  return (
    <section className="w-full rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 via-black/80 to-black/95 px-4 py-5 sm:px-6 sm:py-6 shadow-[0_28px_80px_rgba(0,0,0,0.9)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Esquerda: avatar + info principal */}
        <div className="flex items-start gap-4 sm:gap-5">
          {/* Avatar com aro em gradiente ORYA */}
          <div className="shrink-0">
            <div className="relative inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] p-[2px] shadow-[0_0_40px_rgba(255,0,200,0.45)]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-black/90 overflow-hidden">
                {safeAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeAvatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    {displayName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 3)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Nome + username + badges */}
          <div className="flex flex-col gap-2 min-w-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white truncate">
                {displayName}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                {handle && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium text-white/75">
                    @{handle}
                  </span>
                )}
                {!handle && isOwner && (
                  <span className="rounded-full border border-dashed border-white/25 px-2 py-0.5 text-[10px] text-white/70">
                    Define um @username para ativares o teu perfil público
                  </span>
                )}
                {joinedLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/3 px-2 py-0.5 text-[10px] text-white/65">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Na ORYA desde {joinedLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Badges de perfil (placeholders por agora) */}
            <div className="mt-1" />

            {/* Bio / descrição curta */}
            {bio && (
              <p className="mt-1 max-w-xl text-xs text-white/75 leading-relaxed">
                {bio}
              </p>
            )}
          </div>
        </div>

        {/* Direita: botões de ação (diferentes para owner vs público) */}
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end text-[11px]">
          {isOwner ? (
            <>
              {publicProfileHref && (
                <Link
                  href={publicProfileHref}
                  className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-white/80 hover:bg-white/10 transition-colors"
                >
                  Ver perfil público
                </Link>
              )}
              <Link
                href="/me/edit"
                className="inline-flex items-center gap-1 rounded-full bg-white text-black px-3 py-1.5 font-semibold shadow-[0_0_22px_rgba(255,255,255,0.35)] hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Editar perfil
              </Link>

              {!ownerHasPublicProfile && (
                <Link
                  href="/me/edit"
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/25 bg-black/30 px-3 py-1.5 text-white/75 hover:bg-white/5 transition-colors"
                >
                  Ativar perfil público
                </Link>
              )}

              <Link
                href="/me/settings"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-white/70 hover:bg-white/10 transition-colors"
              >
                Definições
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.7)] hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Seguir
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-white/85 hover:bg-white/10 transition-colors"
              >
                Mensagem
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-white/80 hover:bg-white/10 transition-colors"
              >
                Partilhar perfil
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
