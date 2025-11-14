// app/me/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
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
        const res = await fetch("/api/profile", { cache: "no-store" });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const json = await res.json();
        if (!json.success || !json.profile) {
          setErrorMsg("Erro ao carregar o perfil.");
          return;
        }

        const p = json.profile;

        setUsername(p.username ?? "");
        setFullName(p.full_name ?? "");
        setBio(p.bio ?? "");
        setBirthdate(p.birthdate ?? "");
        setGender(p.gender ?? "");
        setPhone(p.phone ?? "");
        setCity(p.city ?? "");
        setMode(p.mode ?? "");
        setInstagram(p.instagram ?? "");
        setTiktok(p.tiktok ?? "");

        setAvatarUrl(p.avatar_url ?? null);
        setFavouriteCategories(p.favourite_categories ?? []);

        setShowProfile(p.show_profile ?? true);
        setShowEvents(p.show_events ?? true);
        setShowInterests(p.show_interests ?? true);
      } catch (e) {
        console.error(e);
        setErrorMsg("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  // ---- Upload da imagem ----
  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      body: form,
    });

    const json = await res.json();
    if (!json.success) {
      setErrorMsg(json.error || "Erro ao enviar imagem.");
      return;
    }

    setAvatarUrl(json.avatar_url);
    setSuccessMsg("Foto atualizada!");
  }

  // ---- Guardar alterações ----
  async function save() {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

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

    const json = await res.json();
    setSaving(false);

    if (!json.success) {
      setErrorMsg(json.error || "Erro ao guardar.");
      return;
    }

    setSuccessMsg("Perfil atualizado!");
    setTimeout(() => router.push("/me"), 1200);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/60">A carregar…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#02030a] via-[#050316] to-black text-white p-6 pb-24">
      <div className="max-w-3xl mx-auto">

        <h1 className="text-3xl font-bold mb-6">
          Editar Perfil <span className="text-white/40">/ ORYA</span>
        </h1>

        {/* Mensagens */}
        {errorMsg && (
          <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 rounded-lg text-red-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 border border-emerald-500/40 bg-emerald-500/10 rounded-lg text-emerald-300">
            {successMsg}
          </div>
        )}

        {/* Avatar */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold mb-4">Foto de perfil</h2>

          <div className="flex items-center gap-6">
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-[#6BFFFF] shadow-[0_0_20px_#6BFFFF55]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/40">
                  Sem foto
                </div>
              )}
            </div>

            <label className="cursor-pointer px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF00C8] to-[#1646F5] text-sm font-medium">
              Alterar foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadAvatar}
              />
            </label>
          </div>
        </section>

        {/* Informação básica */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold mb-4">Informação Básica</h2>

          <div className="grid gap-4">
            <Input label="Nome completo" value={fullName} setValue={setFullName} />
            <Input label="Username" value={username} setValue={setUsername} />
            <Textarea label="Bio" value={bio} setValue={setBio} />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Data de nascimento" type="date" value={birthdate} setValue={setBirthdate} />
              <Input label="Género" value={gender} setValue={setGender} />
            </div>

            <Input label="Telefone" value={phone} setValue={setPhone} />
            <Input label="Cidade base" value={city} setValue={setCity} />
            <Input label="Modo (ex: estudante, turista…)" value={mode} setValue={setMode} />
          </div>
        </section>

        {/* Categorias */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold mb-4">Interesses</h2>

          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((cat) => {
              const active = favouriteCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => {
                    if (active) {
                      setFavouriteCategories(favouriteCategories.filter((c) => c !== cat));
                    } else {
                      setFavouriteCategories([...favouriteCategories, cat]);
                    }
                  }}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    active
                      ? "bg-[#FF00C8]/30 border-[#FF00C8] text-[#FF00C8]"
                      : "bg-white/5 border-white/10 text-white/70"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </section>

        {/* Privacidade */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold mb-4">Privacidade</h2>

          <Toggle label="Mostrar perfil publicamente" value={showProfile} setValue={setShowProfile} />
          <Toggle label="Mostrar eventos que vais" value={showEvents} setValue={setShowEvents} />
          <Toggle label="Mostrar interesses" value={showInterests} setValue={setShowInterests} />
        </section>

        {/* Social */}
        <section className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold mb-4">Redes Sociais</h2>

          <Input label="Instagram" value={instagram} setValue={setInstagram} />
          <Input label="TikTok" value={tiktok} setValue={setTiktok} />
        </section>

        {/* Guardar */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-2xl text-lg font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] shadow-[0_0_20px_#1646F577]"
        >
          {saving ? "A guardar..." : "Guardar Alterações"}
        </button>

      </div>
    </main>
  );
}

// Reusable components
function Input({ label, value, setValue, type = "text" }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/60 text-sm">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
      />
    </div>
  );
}

function Textarea({ label, value, setValue }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/60 text-sm">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
      />
    </div>
  );
}

function Toggle({ label, value, setValue }: any) {
  return (
    <div className="flex items-center justify-between py-2">
      <span>{label}</span>
      <button
        onClick={() => setValue(!value)}
        className={`w-12 h-6 rounded-full transition ${
          value ? "bg-[#6BFFFF]" : "bg-white/10"
        } relative`}
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