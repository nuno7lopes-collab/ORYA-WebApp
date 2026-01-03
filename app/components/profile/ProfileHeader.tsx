"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import FollowClient from "@/app/[username]/FollowClient";
import ProfileHeaderLayout, {
  ProfileStatPill,
  ProfileVerifiedBadge,
} from "@/app/components/profile/ProfileHeaderLayout";
import { Avatar } from "@/components/ui/avatar";

export type ProfileHeaderProps = {
  /** Se é o próprio utilizador a ver o seu perfil */
  isOwner: boolean;
  /** Nome completo do utilizador (ex: "Nuno Lopes") */
  name?: string | null;
  /** Username público (ex: "nuno") */
  username?: string | null;
  /** URL do avatar (pode ser null) */
  avatarUrl?: string | null;
  /** Versão do avatar (para cache-busting) */
  avatarUpdatedAt?: string | number | null;
  /** URL da capa (opcional) */
  coverUrl?: string | null;
  /** Pequena descrição ou bio (opcional, para o futuro) */
  bio?: string | null;
  /** Cidade ou localização curta */
  city?: string | null;
  /** Visibilidade do perfil */
  visibility?: "PUBLIC" | "PRIVATE" | string | null;
  /** Seguidores (placeholder enquanto não temos API) */
  followers?: number | null;
  /** Seguindo (placeholder enquanto não temos API) */
  following?: number | null;
  /** Id do alvo para follow/unfollow (quando não é dono) */
  targetUserId?: string | null;
  /** Estado inicial de follow (quando visitante) */
  initialIsFollowing?: boolean;
  /** Se o perfil é verificado */
  isVerified?: boolean;
  /** Se pode abrir listas de seguidores */
  canOpenLists?: boolean;
  /** Se o viewer é amigo (follow mútuo) */
  isMutual?: boolean;
};

export default function ProfileHeader({
  isOwner,
  name,
  username,
  avatarUrl,
  avatarUpdatedAt,
  coverUrl,
  bio,
  city,
  visibility,
  followers,
  following,
  targetUserId,
  initialIsFollowing,
  isVerified = false,
  canOpenLists = true,
  isMutual = false,
}: ProfileHeaderProps) {
  const router = useRouter();
  const displayName = name?.trim() || "Utilizador ORYA";
  const handle = username?.trim() || undefined;

  const safeAvatarUrl = avatarUrl && avatarUrl.trim().length > 0
    ? avatarUrl
    : undefined;
  const safeCoverUrl = coverUrl && coverUrl.trim().length > 0 ? coverUrl : null;


  const [nameInput, setNameInput] = useState(displayName);
  const [usernameInput, setUsernameInput] = useState(handle ?? "");
  const [bioInput, setBioInput] = useState(bio ?? "");
  const [avatar, setAvatar] = useState<string | null | undefined>(safeAvatarUrl);
  const [cover, setCover] = useState<string | null>(safeCoverUrl);
  const [editingField, setEditingField] = useState<"name" | "username" | "bio" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarVersion, setAvatarVersion] = useState<string | number | null>(
    avatarUpdatedAt ?? null,
  );
  const showEditControls = isOwner && isEditing;

  useEffect(() => {
    setNameInput(displayName);
    setUsernameInput(handle ?? "");
    setBioInput(bio ?? "");
    setAvatar(safeAvatarUrl);
    setCover(safeCoverUrl);
    setAvatarVersion(avatarUpdatedAt ?? null);
    setMutualBadge(isMutual);
  }, [displayName, handle, bio, safeAvatarUrl, safeCoverUrl, avatarUpdatedAt, isMutual]);

  useEffect(() => {
    if (!showEditControls) {
      setEditingField(null);
      setAvatarMenu(false);
    }
  }, [showEditControls]);

  const runSave = async (opts?: {
    fullName?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
  }) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const fullName = (opts?.fullName ?? nameInput).trim();
    const rawUsername = opts?.username ?? usernameInput.replace(/^@/, "");
    const cleaned = sanitizeUsername(rawUsername);
    const validation = validateUsername(cleaned);
    if (!fullName || !validation.valid) {
      const message =
        !fullName ? "O nome é obrigatório." : "error" in validation ? validation.error : "Username inválido.";
      setError(message);
      setSaving(false);
      return false;
    }
    const payload = {
      fullName,
      username: validation.normalized,
      bio: opts?.bio ?? bioInput.trim(),
      avatarUrl: opts?.avatarUrl ?? avatar ?? null,
      coverUrl: opts?.coverUrl ?? cover ?? null,
      visibility: visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    };
    const res = await fetch("/api/profiles/save-basic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Erro ao guardar.");
      setSaving(false);
      return false;
    }
    const savedProfile = json?.profile ?? null;
    const savedAvatarUrl = savedProfile ? savedProfile.avatarUrl ?? null : payload.avatarUrl ?? null;
    const savedCoverUrl = savedProfile ? savedProfile.coverUrl ?? null : payload.coverUrl ?? null;
    const savedUpdatedAt =
      savedProfile?.updatedAt ?? null;
    setNameInput(fullName);
    setUsernameInput(validation.normalized);
    setBioInput(payload.bio ?? "");
    setAvatar(savedAvatarUrl);
    setCover(savedCoverUrl);
    if (savedUpdatedAt) setAvatarVersion(savedUpdatedAt);
    setSuccess("Guardado.");
    setSaving(false);
    setEditingField(null);
    router.refresh();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("orya:profile-updated"));
    }
    return true;
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload?scope=avatar", { method: "POST", body: formData });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.url) {
      setError(json?.error || "Falha no upload da foto.");
      return;
    }
    setAvatar(json.url);
    await runSave({ avatarUrl: json.url });
  };

  const triggerFile = () => fileInputRef.current?.click();
  const triggerCoverFile = () => coverInputRef.current?.click();

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload?scope=event-cover", { method: "POST", body: formData });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.url) {
      setError(json?.error || "Falha no upload da capa.");
      return;
    }
    setCover(json.url);
    await runSave({ coverUrl: json.url });
  };

  const handleCoverRemove = async () => {
    setCover(null);
    await runSave({ coverUrl: null });
  };

  const handleAvatarError = () => {
    if (!avatar) return;
    setAvatar(null);
    if (isOwner) {
      void runSave({ avatarUrl: null });
    }
  };

  const showPrivateBadge = visibility ? visibility !== "PUBLIC" : false;
  const [mutualBadge, setMutualBadge] = useState(isMutual);
  const showMutualBadge = !isOwner && mutualBadge;
  const followersCount = followers ?? null;
  const followingCount = following ?? null;
  const [followersDisplay, setFollowersDisplay] = useState(followersCount ?? 0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listItems, setListItems] = useState<
    Array<{
      userId: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      isMutual?: boolean;
    }>
  >([]);
  const handleFollowChange = (next: boolean) => {
    setFollowersDisplay((prev) => Math.max(0, (prev ?? 0) + (next ? 1 : -1)));
  };

  const loadList = async (mode: "followers" | "following") => {
    if (!targetUserId) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/social/${mode}?userId=${targetUserId}`);
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setListItems(Array.isArray(json.items) ? json.items : []);
      } else {
        setListItems([]);
      }
    } catch {
      setListItems([]);
    } finally {
      setListLoading(false);
    }
  };

  const statsSlot = (
    <>
      <ProfileStatPill
        label="Seguidores"
        value={followersDisplay ?? "—"}
        onClick={
          canOpenLists
            ? () => {
                setShowFollowersModal(true);
                loadList("followers");
              }
            : undefined
        }
      />
      <ProfileStatPill
        label="A seguir"
        value={followingCount ?? "—"}
        onClick={
          canOpenLists
            ? () => {
                setShowFollowingModal(true);
                loadList("following");
              }
            : undefined
        }
      />
    </>
  );

  const titleSlot = showEditControls && editingField === "name" ? (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        className="rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-lg font-semibold text-white focus:outline-none focus:border-white/40"
        maxLength={80}
        autoFocus
      />
      <button
        onClick={() => runSave({ fullName: nameInput })}
        className="rounded-full bg-white text-black px-3 py-1 text-xs font-semibold shadow"
        disabled={saving}
      >
        Guardar
      </button>
      <button
        onClick={() => {
          setNameInput(displayName);
          setEditingField(null);
        }}
        className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
      >
        Cancelar
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <h1 className="text-[22px] sm:text-3xl font-semibold tracking-tight text-white truncate">
        {nameInput}
      </h1>
      {isVerified && <ProfileVerifiedBadge />}
      {showEditControls && (
        <button
          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75 hover:bg-white/12"
          onClick={() => setEditingField("name")}
          aria-label="Editar nome"
        >
          ✎
        </button>
      )}
    </div>
  );

  const showMetaRow = showEditControls || Boolean(handle) || Boolean(city);
  const metaSlot = showMetaRow ? (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/80">
      {showEditControls && editingField === "username" ? (
        <div className="flex items-center gap-2">
          <input
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/50 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/40"
            maxLength={24}
            autoFocus
          />
          <button
            onClick={() => runSave({ username: usernameInput })}
            className="rounded-full bg-white text-black px-3 py-1 text-[11px] font-semibold shadow"
            disabled={saving}
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setUsernameInput(handle ?? "");
              setEditingField(null);
            }}
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          {handle && (
            <span className="rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white">
              @{handle}
            </span>
          )}
          {!handle && showEditControls && (
            <span className="rounded-full border border-dashed border-white/25 px-2 py-0.5 text-[11px] text-white/70">
              Define um @username para ativares o teu perfil público
            </span>
          )}
          {showEditControls && (
            <button
              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
              onClick={() => setEditingField("username")}
              aria-label="Editar username"
            >
              ✎
            </button>
          )}
        </>
      )}
      {city && <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">{city}</span>}
    </div>
  ) : null;

  const bioSlot = showEditControls && editingField === "bio" ? (
    <div className="flex flex-col gap-2">
      <textarea
        value={bioInput}
        onChange={(e) => setBioInput(e.target.value.slice(0, 280))}
        className="min-h-[80px] max-w-xl rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/35"
        placeholder="Escreve uma bio curta."
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => runSave({ bio: bioInput })}
          className="rounded-full bg-white text-black px-3 py-1 text-[11px] font-semibold shadow"
          disabled={saving}
        >
          Guardar bio
        </button>
        <button
          onClick={() => {
            setBioInput(bio ?? "");
            setEditingField(null);
          }}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80"
        >
          Cancelar
        </button>
        <span className="text-[11px] text-white/50">{bioInput.length}/280</span>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-start gap-2">
      <p className="max-w-xl text-sm text-white/85 leading-relaxed">
        {bioInput || (isOwner ? "Adiciona uma bio curta para o teu perfil." : "Sem bio no momento.")}
      </p>
      {showEditControls && (
        <button
          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
          onClick={() => setEditingField("bio")}
          aria-label="Editar bio"
        >
          ✎
        </button>
      )}
    </div>
  );

  const linksSlot = showPrivateBadge || showMutualBadge ? (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/75">
      {showPrivateBadge && (
        <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] text-white/75">
          Perfil privado
        </span>
      )}
      {showMutualBadge && (
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-50">
          Teu amigo
        </span>
      )}
    </div>
  ) : null;

  const actionsSlot = isOwner ? (
    <button
      type="button"
      onClick={() => setIsEditing((prev) => !prev)}
      className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/12"
    >
      {isEditing ? "Fechar edição" : "Editar perfil"}
    </button>
  ) : targetUserId ? (
    <FollowClient
      targetUserId={targetUserId}
      initialIsFollowing={initialIsFollowing ?? false}
      onChange={handleFollowChange}
      onMutualChange={setMutualBadge}
    />
  ) : null;

  const coverActionsSlot = showEditControls ? (
    <>
      <button
        type="button"
        onClick={triggerCoverFile}
        disabled={saving}
        className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/85 shadow-[0_10px_26px_rgba(0,0,0,0.35)] hover:bg-white/15 disabled:opacity-60"
      >
        {cover ? "Trocar capa" : "Adicionar capa"}
      </button>
      {cover && (
        <button
          type="button"
          onClick={handleCoverRemove}
          disabled={saving}
          className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] text-white/70 hover:bg-black/60 disabled:opacity-60"
        >
          Remover
        </button>
      )}
    </>
  ) : null;

  const avatarSlot = (
    <>
      <div
        className={`relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] p-[2px] shadow-[0_0_24px_rgba(255,0,200,0.26)] sm:h-28 sm:w-28 ${
          showEditControls ? "cursor-pointer transition-all hover:shadow-[0_0_26px_rgba(255,0,200,0.32)]" : ""
        }`}
        onClick={showEditControls ? () => setAvatarMenu((v) => !v) : undefined}
      >
        <Avatar
          src={avatar ?? null}
          version={avatarVersion}
          name={displayName}
          className="h-full w-full"
          textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
          onError={handleAvatarError}
        />
      </div>
      {showEditControls && avatarMenu && (
        <div className="absolute left-0 top-[110%] z-30 w-52 rounded-2xl border border-white/15 bg-[rgba(5,8,15,0.9)] p-2 text-sm text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          {avatar && (
            <button
              className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
              onClick={() => {
                setAvatarMenu(false);
                setShowFollowersModal(false);
                setShowFollowingModal(false);
                const overlay = document.createElement("div");
                overlay.style.position = "fixed";
                overlay.style.inset = "0";
                overlay.style.background = "rgba(0,0,0,0.75)";
                overlay.style.backdropFilter = "blur(8px)";
                overlay.style.zIndex = "9999";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                const img = document.createElement("img");
                img.src = avatar;
                img.alt = displayName;
                img.style.maxWidth = "85vw";
                img.style.maxHeight = "85vh";
                img.style.borderRadius = "20px";
                img.style.border = "1px solid rgba(255,255,255,0.2)";
                img.style.boxShadow = "0 30px 120px rgba(0,0,0,0.55)";
                overlay.appendChild(img);
                overlay.addEventListener("click", () => document.body.removeChild(overlay));
                document.body.appendChild(overlay);
              }}
            >
              Ver foto em grande
            </button>
          )}
          <button
            className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
            onClick={() => {
              setAvatarMenu(false);
              triggerFile();
            }}
          >
            Mudar foto
          </button>
          <button
            className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
            onClick={() => {
              setAvatarMenu(false);
              runSave({ avatarUrl: null });
            }}
          >
            Remover foto
          </button>
        </div>
      )}
    </>
  );

  const afterSlot =
    error || success ? (
      <div className="orya-page-width mt-3 text-[12px]">
        {error && <p className="text-red-200">{error}</p>}
        {!error && success && <p className="text-emerald-200">{success}</p>}
      </div>
    ) : null;

  return (
    <>
      <ProfileHeaderLayout
        coverUrl={cover}
        coverActionsSlot={coverActionsSlot}
        avatarSlot={avatarSlot}
        statsSlot={statsSlot}
        titleSlot={titleSlot}
        metaSlot={metaSlot}
        bioSlot={bioSlot}
        linksSlot={linksSlot}
        actionsSlot={actionsSlot}
        afterSlot={afterSlot}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
      />
      {(showFollowersModal || showFollowingModal) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFollowersModal(false);
              setShowFollowingModal(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[rgba(8,10,18,0.92)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {showFollowersModal ? "Seguidores" : "A seguir"}
              </h3>
              <button
                onClick={() => {
                  setShowFollowersModal(false);
                  setShowFollowingModal(false);
                }}
                className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/80 hover:bg-white/15"
              >
                Fechar
              </button>
            </div>
            {listLoading ? (
              <div className="space-y-2">
                <div className="h-12 rounded-xl orya-skeleton-surface animate-pulse" />
                <div className="h-12 rounded-xl orya-skeleton-surface animate-pulse" />
              </div>
            ) : listItems.length === 0 ? (
              <p className="text-[12px] text-white/70">Nada para mostrar.</p>
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {listItems.map((item) => {
                  const handle = item.username || item.userId;
                  return (
                    <Link
                      key={item.userId}
                      href={item.username ? `/${item.username}` : `/me`}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2 hover:border-white/20 hover:bg-white/8 transition-colors"
                      onClick={() => {
                        setShowFollowersModal(false);
                        setShowFollowingModal(false);
                      }}
                    >
                      <Avatar
                        src={item.avatarUrl}
                        name={item.fullName || item.username || handle}
                        className="h-10 w-10 border border-white/12"
                        textClassName="text-[11px] font-semibold uppercase text-white/80"
                        fallbackText="OR"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {item.fullName || item.username || "Utilizador ORYA"}
                        </p>
                        {item.username && (
                          <p className="text-[11px] text-white/65 truncate">@{item.username}</p>
                        )}
                        {item.isMutual && (
                          <span className="mt-1 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-50">
                            Teu amigo
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
