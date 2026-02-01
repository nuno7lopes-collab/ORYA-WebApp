"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { getProfileCoverUrl, sanitizeProfileCoverUrl } from "@/lib/profileCover";
import { appendOrganizationIdToHref, getOrganizationIdFromBrowser } from "@/lib/organizationIdUtils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const SPECIALTIES_OPTIONS = [
  "Iniciação",
  "Tática",
  "Técnica",
  "Competição",
  "Alto rendimento",
  "Padel infantil",
  "Fitness",
  "Mental",
];

const CERTIFICATIONS_OPTIONS = [
  "FPP N1",
  "FPP N2",
  "FPP N3",
  "FIP",
  "PTR",
  "Outro",
];

const MAX_SPECIALTIES = 8;
const MAX_CERTIFICATIONS = 6;

type TrainerProfile = {
  id: number;
  bio: string | null;
  specialties: string[];
  certifications: string | null;
  experienceYears: number | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  reviewStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewRequestedAt: string | null;
  organization: { id: number; username: string | null; publicName: string | null };
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null };
};

type ProfileResponse = {
  ok: boolean;
  profile: TrainerProfile | null;
  organization: { id: number; username: string | null; publicName: string | null } | null;
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
  role: string | null;
  error?: string;
};

export default function TrainerProfilePage() {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const loginRedirectHref = appendOrganizationIdToHref("/organizacao/treinadores", getOrganizationIdFromBrowser());
  const { data, isLoading, mutate } = useSWR<ProfileResponse>(
    user ? "/api/organizacao/trainers/profile" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const profile = data?.profile ?? null;
  const organization = data?.organization ?? profile?.organization ?? null;
  const profileUser = profile?.user ?? data?.user ?? null;
  const role = data?.role ?? null;
  const canEdit = role === "TRAINER";
  const displayName = profileUser?.fullName || profileUser?.username || "Treinador";
  const reviewStatus = profile?.reviewStatus ?? "DRAFT";
  const statusLabel =
    reviewStatus === "PENDING"
      ? "Em revisão"
      : reviewStatus === "APPROVED"
        ? "Aprovado"
        : reviewStatus === "REJECTED"
          ? "Recusado"
          : "Rascunho";

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? "");
    setSpecialties(profile.specialties ?? []);
    setCertifications(
      profile.certifications
        ? profile.certifications
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    );
    setExperienceYears(profile.experienceYears?.toString() ?? "");
    setCoverImageUrl(sanitizeProfileCoverUrl(profile.coverImageUrl));
  }, [profile?.id]);

  const previewHref = useMemo(() => {
    if (!organization?.username || !profileUser?.username) return null;
    return `/${organization.username}/treinadores/${profileUser.username}`;
  }, [organization?.username, profileUser?.username]);
  const coverPreviewUrl = coverImageUrl
    ? getProfileCoverUrl(coverImageUrl, {
        width: 900,
        height: 900,
        quality: 70,
        format: "webp",
      })
    : null;

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=profile-cover", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setMessage(json?.error || "Não foi possível carregar a capa.");
        return;
      }
      setCoverImageUrl(json.url as string);
      setMessage("Capa atualizada. Guarda para publicar.");
    } catch (err) {
      setMessage("Erro ao carregar a capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: loginRedirectHref });
      return;
    }
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organizacao/trainers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          specialties,
          certifications: certifications.join(", "),
          experienceYears,
          coverImageUrl,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMessage(json?.error || "Não foi possível guardar o perfil.");
        return;
      }
      setMessage("Perfil atualizado.");
      await mutate();
    } catch {
      setMessage("Erro ao guardar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      openModal({ mode: "login", redirectTo: loginRedirectHref });
      return;
    }
    if (!canEdit) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organizacao/trainers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          specialties,
          certifications: certifications.join(", "),
          experienceYears,
          coverImageUrl,
          requestReview: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMessage(json?.error || "Não foi possível submeter o perfil.");
        return;
      }
      setMessage("Perfil enviado para revisão.");
      await mutate();
    } catch {
      setMessage("Erro ao submeter o perfil.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user && !isLoading) {
    return (
      <main className="min-h-screen w-full py-10 text-white">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 text-white/80">
          <h1 className="text-xl font-semibold text-white">Perfil de treinador</h1>
          <p className="mt-2 text-sm text-white/65">Faz login para editar o teu perfil.</p>
          <button
            type="button"
            onClick={() => openModal({ mode: "login", redirectTo: loginRedirectHref })}
            className={`${CTA_PRIMARY} mt-4`}
          >
            Entrar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full py-10 text-white">
      <div className="w-full space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Treinador</p>
          <h1 className="text-3xl font-semibold text-white">{displayName}</h1>
          <p className="text-sm text-white/65">
            Este perfil só aparece na aba &quot;Treinadores&quot; depois de aprovado e publicado.
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Link href="/organizacao/reservas" className={CTA_SECONDARY}>
                Ver agenda
              </Link>
              <Link href="/organizacao/reservas?create=service" className={CTA_SECONDARY}>
                Criar serviço
              </Link>
            </div>
          )}
        </header>

        {!canEdit && !isLoading && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            O perfil só pode ser editado por membros com role Treinador.
          </div>
        )}

        <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-white/70">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Estado</p>
              <p className="text-sm font-semibold text-white">{statusLabel}</p>
              {profile?.reviewNote && reviewStatus === "REJECTED" && (
                <p className="text-[11px] text-rose-200">Motivo: {profile.reviewNote}</p>
              )}
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                reviewStatus === "APPROVED"
                  ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                  : reviewStatus === "PENDING"
                    ? "border-amber-300/50 bg-amber-400/10 text-amber-100"
                    : reviewStatus === "REJECTED"
                      ? "border-rose-300/50 bg-rose-400/10 text-rose-100"
                      : "border-white/15 bg-white/10 text-white/60"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/70">Capa (1:1)</label>
            <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreviewUrl} alt="Capa" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-[#0b1222] via-[#101a2c] to-[#1e2038]" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={!canEdit || uploadingCover}
              />
            </div>
            {uploadingCover && <p className="text-[11px] text-white/60">A carregar capa…</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-white/70">Nome</label>
              <div className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                {displayName}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/70">Anos de experiência</label>
              <input
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Ex: 6"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/70">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              placeholder="Conta a tua história como treinador."
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/70">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES_OPTIONS.map((option) => {
                const selected = specialties.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      if (!canEdit) return;
                      setSpecialties((prev) => {
                        if (prev.includes(option)) return prev.filter((item) => item !== option);
                        if (prev.length >= MAX_SPECIALTIES) return prev;
                        return [...prev, option];
                      });
                    }}
                    className={`rounded-full border px-3 py-1 text-[12px] transition ${
                      selected
                        ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                        : "border-white/15 bg-white/5 text-white/70 hover:border-white/35"
                    } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-white/50">Máx. {MAX_SPECIALTIES} especialidades.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/70">Certificações</label>
            <div className="flex flex-wrap gap-2">
              {CERTIFICATIONS_OPTIONS.map((option) => {
                const selected = certifications.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      if (!canEdit) return;
                      setCertifications((prev) => {
                        if (prev.includes(option)) return prev.filter((item) => item !== option);
                        if (prev.length >= MAX_CERTIFICATIONS) return prev;
                        return [...prev, option];
                      });
                    }}
                    className={`rounded-full border px-3 py-1 text-[12px] transition ${
                      selected
                        ? "border-sky-300/50 bg-sky-400/10 text-sky-100"
                        : "border-white/15 bg-white/5 text-white/70 hover:border-white/35"
                    } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-white/50">Máx. {MAX_CERTIFICATIONS} certificações.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canEdit || saving}
              className={`${CTA_PRIMARY} disabled:opacity-60`}
            >
              {saving ? "A guardar…" : "Guardar perfil"}
            </button>
            <button
              type="button"
              onClick={handleSubmitReview}
              disabled={!canEdit || submitting || reviewStatus === "PENDING"}
              className={`${CTA_SECONDARY} disabled:opacity-60`}
            >
              {submitting ? "A enviar…" : "Enviar para revisão"}
            </button>
            {previewHref && profile?.isPublished && (
              <Link href={previewHref} className={CTA_SECONDARY}>
                Ver página pública
              </Link>
            )}
            <span
              className={`rounded-full border px-3 py-1 text-[11px] ${
                profile?.isPublished
                  ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                  : reviewStatus === "PENDING"
                    ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
                    : reviewStatus === "REJECTED"
                      ? "border-rose-300/40 bg-rose-400/10 text-rose-100"
                      : "border-white/15 bg-white/10 text-white/60"
              }`}
            >
              {statusLabel}
            </span>
          </div>

          {message && (
            <p className="text-sm text-white/70">{message}</p>
          )}
        </section>
      </div>
    </main>
  );
}
