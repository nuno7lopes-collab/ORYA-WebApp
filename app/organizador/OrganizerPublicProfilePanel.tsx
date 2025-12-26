"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_NEUTRAL } from "@/app/organizador/dashboardUi";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { cn } from "@/lib/utils";

const BIO_LIMIT = 280;

type OrganizerProfileInfo = {
  id?: number;
  publicName?: string | null;
  businessName?: string | null;
  username?: string | null;
  publicDescription?: string | null;
  brandingAvatarUrl?: string | null;
};

type OrganizerPublicProfilePanelProps = {
  organizer: OrganizerProfileInfo | null;
  membershipRole?: string | null;
  categoryLabel?: string;
};

export default function OrganizerPublicProfilePanel({
  organizer,
  membershipRole,
  categoryLabel,
}: OrganizerPublicProfilePanelProps) {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();
  const canEdit = membershipRole === "OWNER";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!organizer) return;
    const initialName = organizer.publicName || organizer.businessName || "";
    setName(initialName);
    setUsername(organizer.username ?? "");
    setBio(organizer.publicDescription ?? "");
    setAvatarUrl(organizer.brandingAvatarUrl ?? null);
  }, [organizer]);

  const publicProfileUrl = username ? `/${username}` : null;

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
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

  const handleSaveProfile = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: "/organizador?tab=promote&section=marketing&marketing=perfil" });
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
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setMessage(json?.error || "Não foi possível guardar o perfil público.");
        return;
      }
      setMessage("Perfil público atualizado.");
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
      openModal({ mode: "login", redirectTo: "/organizador?tab=promote&section=marketing&marketing=perfil" });
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
      router.refresh();
    } catch (err) {
      console.error("[perfil-publico] username", err);
      setUsernameMessage("Erro ao atualizar o username.");
    } finally {
      setSavingUsername(false);
    }
  };

  if (!organizer) {
    return (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-6 text-white/70">
        A carregar perfil público…
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr,1fr]">
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/70 to-[#050810]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Editar perfil</p>
            <h3 className="text-lg font-semibold text-white">Informação pública</h3>
            <p className="text-[12px] text-white/60">Foto, nome, username e bio.</p>
          </div>
          {publicProfileUrl ? (
            <Link href={publicProfileUrl} className={CTA_SECONDARY}>
              Abrir perfil
            </Link>
          ) : (
            <span className="text-[11px] text-white/50">Sem username</span>
          )}
        </div>

        {!canEdit && (
          <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-100">
            Apenas o Owner pode editar o perfil público.
          </div>
        )}

        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/10">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  {name.trim().slice(0, 2).toUpperCase() || "OR"}
                </div>
              )}
            </div>
            <div className="space-y-2 text-[12px] text-white/70">
              <input
                type="file"
                accept="image/*"
                disabled={!canEdit || uploading}
                onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={CTA_NEUTRAL}
                  disabled={!canEdit || uploading}
                  onClick={() => setAvatarUrl(null)}
                >
                  Remover foto
                </button>
                {uploading && <span className="text-[11px] text-white/50">A carregar…</span>}
              </div>
            </div>
          </div>

          <label className="text-[12px] text-white/60">Nome público</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Nome da organização"
          />

          <div className="space-y-2">
            <label className="text-[12px] text-white/60">Username</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white">
                <span className="text-white/50">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                  disabled={!canEdit}
                  className="ml-2 min-w-[160px] bg-transparent text-sm text-white outline-none"
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
            {usernameMessage && <p className="text-[11px] text-white/60">{usernameMessage}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[12px] text-white/60">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
              disabled={!canEdit}
              rows={3}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Uma descrição curta da organização"
            />
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>{bio.length}/{BIO_LIMIT}</span>
              <span>{categoryLabel ? `Categoria: ${categoryLabel}` : ""}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveProfile}
              className={CTA_PRIMARY}
              disabled={!canEdit || saving}
            >
              {saving ? "A guardar…" : "Guardar alterações"}
            </button>
          </div>

          {message && <p className="text-[12px] text-white/70">{message}</p>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0f1a2e]/80 via-[#0b1124]/70 to-[#050810]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Pré-visualização</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/10">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                {name.trim().slice(0, 2).toUpperCase() || "OR"}
              </div>
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{name.trim() || "Organização ORYA"}</p>
            <p className="text-[12px] text-white/60">{username ? `@${username}` : "Define um @username"}</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          {bio.trim() || "Adiciona uma bio curta para o teu perfil público."}
        </div>
        {publicProfileUrl && (
          <Link href={publicProfileUrl} className={cn(CTA_SECONDARY, "mt-4 w-full justify-center")}>
            Ver perfil público
          </Link>
        )}
      </div>
    </div>
  );
}
