"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_NEUTRAL } from "@/app/organizador/dashboardUi";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

const BIO_LIMIT = 280;

type OrganizerProfileInfo = {
  id?: number;
  publicName?: string | null;
  businessName?: string | null;
  username?: string | null;
  publicDescription?: string | null;
  brandingAvatarUrl?: string | null;
  brandingCoverUrl?: string | null;
  publicListingEnabled?: boolean | null;
  publicWebsite?: string | null;
  publicInstagram?: string | null;
  publicYoutube?: string | null;
  publicHours?: string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: string | Date | null;
  address?: string | null;
  showAddressPublicly?: boolean | null;
  city?: string | null;
  liveHubPremiumEnabled?: boolean | null;
};

type OrganizerPublicProfilePanelProps = {
  organizer: OrganizerProfileInfo | null;
  membershipRole?: string | null;
  categoryLabel?: string;
  coverUrl?: string | null;
};

export default function OrganizerPublicProfilePanel({
  organizer,
  membershipRole,
  categoryLabel,
  coverUrl,
}: OrganizerPublicProfilePanelProps) {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();
  const canEdit = membershipRole === "OWNER";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"name" | "username" | "city" | "bio" | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverDirty, setCoverDirty] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!organizer) return;
    const initialName = organizer.publicName || organizer.businessName || "";
    setName(initialName);
    setUsername(organizer.username ?? "");
    setBio(organizer.publicDescription ?? "");
    setAvatarUrl(organizer.brandingAvatarUrl ?? null);
    setCity(organizer.city ?? "");
    if (!coverDirty) {
      setCoverImageUrl(organizer.brandingCoverUrl ?? coverUrl ?? null);
    }
  }, [organizer, coverUrl, coverDirty]);

  useEffect(() => {
    setCoverDirty(false);
  }, [organizer?.id]);


  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=avatar", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setMessage(json?.error || "Não foi possível carregar a imagem.");
        return;
      }
      setAvatarUrl(json.url as string);
      setMessage("Imagem atualizada. Não te esqueças de guardar.");
    } catch (err) {
      console.error("[perfil-publico] upload", err);
      setMessage("Erro ao carregar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=event-cover", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setMessage(json?.error || "Não foi possível carregar a capa.");
        return;
      }
      setCoverImageUrl(json.url as string);
      setCoverDirty(true);
      setMessage("Capa atualizada. Não te esqueças de guardar.");
    } catch (err) {
      console.error("[perfil-publico] cover upload", err);
      setMessage("Erro ao carregar a capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizador?tab=overview" });
      return;
    }
    if (!canEdit) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("O nome público é obrigatório.");
      return;
    }
    if (bio.length > BIO_LIMIT) {
      setMessage("A bio é demasiado longa.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organizador/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicName: trimmedName,
          publicDescription: bio.trim(),
          brandingAvatarUrl: avatarUrl,
          brandingCoverUrl: coverImageUrl,
          city: city.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setMessage(json?.error || "Não foi possível guardar o perfil público.");
        return;
      }
      setMessage("Perfil público atualizado.");
      setEditingField(null);
      setCoverDirty(false);
      router.refresh();
    } catch (err) {
      console.error("[perfil-publico] save", err);
      setMessage("Erro ao guardar alterações.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizador?tab=overview" });
      return;
    }
    if (!canEdit) return;
    setUsernameMessage(null);
    const validation = validateUsername(username);
    if (!validation.valid) {
      setUsernameMessage(validation.error);
      return;
    }
    setSavingUsername(true);
    try {
      const res = await fetch("/api/organizador/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: validation.normalized }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setUsernameMessage(json?.error || "Não foi possível atualizar o username.");
        return;
      }
      setUsername(validation.normalized);
      setUsernameMessage("Username atualizado.");
      setEditingField(null);
      router.refresh();
    } catch (err) {
      console.error("[perfil-publico] username", err);
      setUsernameMessage("Erro ao atualizar o username.");
    } finally {
      setSavingUsername(false);
    }
  };

  const displayName = name.trim() || organizer?.businessName?.trim() || "Organização ORYA";
  const displayUsername = username.trim() || organizer?.username?.trim() || null;
  const displayBio = bio.trim() || organizer?.publicDescription?.trim() || "";
  const displayCity = city.trim() || organizer?.city?.trim() || "";
  const avatarPreviewUrl = avatarUrl ?? organizer?.brandingAvatarUrl ?? null;
  const coverPreviewUrl = coverImageUrl ?? coverUrl ?? null;
  const publicProfileUrl = displayUsername ? `/${displayUsername}` : null;

  if (!organizer) {
    return (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-6 text-white/70">
        A carregar perfil público…
      </div>
    );
  }

  return (
    <div className="mt-4">
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!canEdit || uploadingCover}
        onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!canEdit || uploading}
        onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
      />

      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/7 via-[#060914]/92 to-[#05070f]/96 shadow-[0_26px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        <div className="px-5 pt-5 sm:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-white/10">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={coverPreviewUrl ? { backgroundImage: `url(${coverPreviewUrl})` } : undefined}
              />
              {!coverPreviewUrl && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(107,255,255,0.25),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(255,0,200,0.2),transparent_55%),linear-gradient(135deg,rgba(6,10,20,0.8),rgba(9,10,18,0.95))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-[#05070f]/95" />
              {canEdit && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] text-white/80 hover:bg-black/60"
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? "A carregar…" : "Alterar capa"}
                  </button>
                  {coverPreviewUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverImageUrl(null);
                        setCoverDirty(true);
                        setMessage("Capa removida. Não te esqueças de guardar.");
                      }}
                      className={CTA_NEUTRAL}
                      disabled={uploadingCover}
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute inset-0 z-0"
                  aria-label="Editar capa"
                />
              )}
            </div>
          </div>
        </div>

        <div className="relative -mt-10 px-5 pb-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] p-[2px] shadow-[0_0_24px_rgba(255,0,200,0.26)]"
                  disabled={!canEdit || uploading}
                >
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/90">
                    {avatarPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreviewUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        {displayName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/70 p-1.5 text-white/80">
                      <PencilIcon />
                    </span>
                  )}
                </button>
                {canEdit && avatarPreviewUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl(null);
                      setMessage("Foto removida. Não te esqueças de guardar.");
                    }}
                    className="mt-2 text-[11px] text-white/70 hover:text-white"
                  >
                    Remover foto
                  </button>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {editingField === "name" ? (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-lg font-semibold text-white outline-none focus:border-white/40"
                      placeholder="Nome público"
                    />
                  ) : (
                    <h1 className="text-[22px] sm:text-3xl font-semibold tracking-tight text-white truncate">
                      {displayName}
                    </h1>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "name" ? null : "name")}
                      className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/80">
                  {editingField === "username" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white">
                        <span className="text-white/50">@</span>
                        <input
                          value={username}
                          onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                          className="ml-2 min-w-[140px] bg-transparent text-sm text-white outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        className={CTA_SECONDARY}
                        onClick={handleSaveUsername}
                        disabled={!canEdit || savingUsername}
                      >
                        {savingUsername ? "A guardar…" : "Guardar @"}
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full border border-white/15 bg-white/6 px-3 py-1 font-semibold text-white">
                      {displayUsername ? `@${displayUsername}` : "Define um @username"}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "username" ? null : "username")}
                      className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                  {editingField === "city" ? (
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white outline-none focus:border-white/40"
                      placeholder="Cidade"
                    />
                  ) : (
                    <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                      {displayCity || "Cidade por definir"}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "city" ? null : "city")}
                      className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  {editingField === "bio" ? (
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
                      rows={3}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                      placeholder="Escreve uma bio curta"
                    />
                  ) : (
                    <p className="max-w-xl text-sm text-white/85 leading-relaxed">
                      {displayBio || "Sem bio no momento."}
                    </p>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditingField(editingField === "bio" ? null : "bio")}
                      className="mt-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>
                {categoryLabel && <span className="text-[11px] text-white/50">Categoria: {categoryLabel}</span>}
                {usernameMessage && <p className="text-[11px] text-white/60">{usernameMessage}</p>}
                {message && <p className="text-[12px] text-white/70">{message}</p>}
              </div>
            </div>

            {organizer && (
              <div className="rounded-2xl border border-white/12 bg-white/5 px-3 py-3 text-sm text-white/75">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                  Premium da organização
                </p>
                <p className="text-sm text-white/80">
                  {organizer.liveHubPremiumEnabled ? "Ativo" : "Inativo"} · Gerido automaticamente pela subscrição.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {publicProfileUrl && (
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-white/70">
                  {publicProfileUrl}
                </span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className={CTA_PRIMARY}
                  disabled={saving}
                >
                  {saving ? "A guardar…" : "Guardar alterações"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4 20l4.5-1 9.2-9.2a2.5 2.5 0 0 0 0-3.5l-.9-.9a2.5 2.5 0 0 0-3.5 0L4 14.6V20z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6.5l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
