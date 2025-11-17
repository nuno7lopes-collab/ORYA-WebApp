// app/me/edit/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "Festas & Noite",
  "Concertos",
  "Padel",
  "Desporto",
  "Cafés & Brunch",
  "Jantares sociais",
  "Networking",
  "Aulas & Workshops",
  "Arte & Cultura",
  "Viagens",
  "Gaming",
  "Fitness",
  "Ao ar livre",
  "Tecnologia",
];

type ProfileResponse = {
  success: boolean;
  profile?: any;
  error?: string;
};

type ToggleProps = {
  label: string;
  value: boolean;
  setValue: (v: boolean) => void;
};

type InputProps = {
  label: string;
  value: string;
  setValue: (v: string) => void;
  type?: string;
};

type TextareaProps = {
  label: string;
  value: string;
  setValue: (v: string) => void;
};

export default function EditProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dados do perfil
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [favouriteCategories, setFavouriteCategories] = useState<string[]>([]);

  // Privacidade
  const [showProfile, setShowProfile] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showInterests, setShowInterests] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        setErrorMsg(null);
        const res = await fetch("/api/profile", { cache: "no-store" });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (!res.ok) {
          console.error("Erro ao carregar /api/profile:", res.status);
          setErrorMsg("Erro ao carregar o perfil.");
          setLoading(false);
          return;
        }

        const json: ProfileResponse = await res.json();

        if (!json.success || !json.profile) {
          setErrorMsg(json.error || "Erro ao carregar o perfil.");
          setLoading(false);
          return;
        }

        const p = json.profile;

        setUsername(p.username ?? "");
        setFullName(p.full_name ?? "");
        setBio(p.bio ?? "");

        // Garantir formato YYYY-MM-DD para o input date
        const rawBirthdate: string | null = p.birthdate ?? null;
        if (rawBirthdate) {
          const trimmed =
            rawBirthdate.length > 10 ? rawBirthdate.slice(0, 10) : rawBirthdate;
          setBirthdate(trimmed);
        } else {
          setBirthdate("");
        }

        setGender(p.gender ?? "");
        setPhone(p.phone ?? "");
        setCity(p.city ?? "");
        // Nome real da coluna na DB: user_mode
        setMode(p.user_mode ?? "");
        setInstagram(p.instagram ?? "");
        setTiktok(p.tiktok ?? "");

        setAvatarUrl(p.avatar_url ?? null);
        setFavouriteCategories(p.favourite_categories ?? []);

        setShowProfile(p.show_profile ?? true);
        setShowEvents(p.show_events ?? true);
        setShowInterests(p.show_interests ?? true);
      } catch (e) {
        console.error("EDIT /me ERROR:", e);
        setErrorMsg("Erro ao carregar dados do perfil.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  // ---- Upload da imagem ----
  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        console.error("Erro /api/profile/avatar:", res.status);
        setErrorMsg("Erro ao enviar imagem.");
        return;
      }

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || "Erro ao enviar imagem.");
        return;
      }

      setAvatarUrl(json.avatar_url);
      setSuccessMsg("Foto atualizada!");
    } catch (err) {
      console.error("Erro inesperado no upload do avatar:", err);
      setErrorMsg("Erro inesperado ao enviar imagem.");
    }
  }

  // ---- Guardar alterações ----
  async function save() {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          full_name: fullName,
          bio,
          birthdate,
          gender,
          phone,
          city,
          mode,
          instagram,
          tiktok,
          avatar_url: avatarUrl,
          favourite_categories: favouriteCategories,
          show_profile: showProfile,
          show_events: showEvents,
          show_interests: showInterests,
        }),
      });

      if (!res.ok) {
        console.error("Erro ao guardar /api/profile:", res.status);
        setSaving(false);
        setErrorMsg("Erro ao guardar o perfil.");
        return;
      }

      const json = await res.json();

      if (!json.success) {
        setSaving(false);
        setErrorMsg(json.error || "Erro ao guardar o perfil.");
        return;
      }

      setSuccessMsg("Perfil atualizado!");
      setSaving(false);

      setTimeout(() => router.push("/me"), 1000);
    } catch (err) {
      console.error("Erro inesperado ao guardar perfil:", err);
      setSaving(false);
      setErrorMsg("Erro inesperado ao guardar o perfil.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen orya-body-bg text-white flex items-center justify-center">
        <p className="text-white/60 text-sm">A carregar o teu perfil…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen orya-body-bg text-white pb-24">
      <div className="max-w-3xl mx-auto px-5 pt-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Editar perfil
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Ajusta como te apresentas dentro da ORYA — nome, bio, modo e
              interesses.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/me")}
            className="hidden sm:inline-flex items-center gap-2 text-[11px] text-white/55 hover:text-white/85"
          >
            ← Voltar à conta
          </button>
        </header>

        {/* Mensagens */}
        {errorMsg && (
          <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 rounded-lg text-red-200 text-sm">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 border border-emerald-500/40 bg-emerald-500/10 rounded-lg text-emerald-200 text-sm">
            {successMsg}
          </div>
        )}

        {/* Avatar */}
        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#FF8AD910] via-[#9BE7FF1F] to-[#020617f2] backdrop-blur-xl p-6 mb-8 shadow-[0_16px_40px_rgba(15,23,42,0.7)]">
          <h2 className="text-xl font-semibold mb-4">Foto de perfil</h2>

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#6BFFFF] shadow-[0_0_18px_#6BFFFF55]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/40 text-sm">
                  Sem foto
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="cursor-pointer inline-flex px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-medium shadow-[0_0_18px_#1646F577]">
                Alterar foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadAvatar}
                />
              </label>
              <p className="text-[11px] text-white/70 max-w-xs">
                Escolhe uma imagem que te represente — o avatar aparece na tua
                conta e, no futuro, nas interações sociais da ORYA.
              </p>
            </div>
          </div>
        </section>

        {/* Informação básica */}
        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-slate-950/85 to-slate-950 backdrop-blur-xl p-6 mb-8 shadow-[0_14px_34px_rgba(15,23,42,0.8)]">
          <h2 className="text-xl font-semibold mb-4">Informação básica</h2>

          <div className="grid gap-4">
            <Input label="Nome completo" value={fullName} setValue={setFullName} />
            <Input label="Username" value={username} setValue={setUsername} />
            <Textarea label="Bio" value={bio} setValue={setBio} />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data de nascimento"
                type="date"
                value={birthdate}
                setValue={setBirthdate}
              />
              <Input label="Género" value={gender} setValue={setGender} />
            </div>

            <Input label="Telefone" value={phone} setValue={setPhone} />
            <Input label="Cidade base" value={city} setValue={setCity} />
            <Input
              label="Modo (ex: estudante, turista…)"
              value={mode}
              setValue={setMode}
            />
          </div>
        </section>

        {/* Categorias */}
        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#FF8AD910] via-[#9BE7FF1F] to-[#020617f2] backdrop-blur-xl p-6 mb-8 shadow-[0_14px_34px_rgba(15,23,42,0.8)]">
          <h2 className="text-xl font-semibold mb-4">Interesses</h2>

          <p className="text-[11px] text-white/70 mb-3">
            Escolhe o tipo de experiências que mais combinam contigo. Isto vai
            ajudar a ORYA a recomendar-te eventos mais alinhados com o teu
            perfil.
          </p>

          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((cat) => {
              const active = favouriteCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    if (active) {
                      setFavouriteCategories(
                        favouriteCategories.filter((c) => c !== cat),
                      );
                    } else {
                      setFavouriteCategories([...favouriteCategories, cat]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition ${
                    active
                      ? "bg-[#FF00C8]/22 border-[#FF00C8]/80 text-[#FFD6F6]"
                      : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </section>

        {/* Privacidade */}
        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-slate-950/85 to-slate-950 backdrop-blur-xl p-6 mb-8 shadow-[0_14px_34px_rgba(15,23,42,0.8)]">
          <h2 className="text-xl font-semibold mb-4">Privacidade</h2>

          <p className="text-[11px] text-white/70 mb-3">
            Controla o que as outras pessoas vão conseguir ver sobre ti dentro
            da ORYA. No futuro, isto também vai impactar a parte social da app.
          </p>

          <div className="space-y-2">
            <Toggle
              label="Mostrar o meu perfil publicamente"
              value={showProfile}
              setValue={setShowProfile}
            />
            <Toggle
              label="Mostrar eventos onde vou / fui"
              value={showEvents}
              setValue={setShowEvents}
            />
            <Toggle
              label="Mostrar lista de interesses"
              value={showInterests}
              setValue={setShowInterests}
            />
          </div>
        </section>

        {/* Redes sociais */}
        <section className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.04] via-slate-950/85 to-slate-950 backdrop-blur-xl p-6 mb-8 shadow-[0_14px_34px_rgba(15,23,42,0.8)]">
          <h2 className="text-xl font-semibold mb-4">Redes sociais</h2>

          <p className="text-[11px] text-white/70 mb-3">
            Opcional — podes ligar as tuas redes para, no futuro, facilitar
            ligações e partilhas dentro da ORYA.
          </p>

          <div className="grid gap-4">
            <Input
              label="Instagram"
              value={instagram}
              setValue={setInstagram}
            />
            <Input label="TikTok" value={tiktok} setValue={setTiktok} />
          </div>
        </section>

        {/* Guardar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-10">
          <button
            type="button"
            onClick={() => router.push("/me")}
            className="inline-flex justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-xs font-medium text-white/80 hover:border-white/40 hover:bg-white/10 transition"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] shadow-[0_0_22px_#1646F577] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "A guardar…" : "Guardar alterações"}
          </button>
        </div>
      </div>
    </main>
  );
}

// Reusable components
function Input({ label, value, setValue, type = "text" }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/70 text-sm">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 text-sm"
      />
    </div>
  );
}

function Textarea({ label, value, setValue }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/70 text-sm">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60 text-sm"
      />
    </div>
  );
}

function Toggle({ label, value, setValue }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/85">{label}</span>
      <button
        type="button"
        onClick={() => setValue(!value)}
        className={`w-12 h-6 rounded-full transition relative ${
          value ? "bg-[#6BFFFF]" : "bg.white/14"
        }`}
      >
        <div
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition ${
            value ? "translate-x-6" : ""
          }`}
        />
      </button>
    </div>
  );
}