"use client";

import { useState } from "react";

type Mood = "orya default";
type Theme = "dark" | "light";

const PALETTES: Record<
  Mood,
  { name: string; gradient: string; accent: string; glow: string; surface: string; text: string; muted: string }
> = {
  "orya default": {
    name: "ORYA Default",
    gradient: "from-[#050814] via-[#0b1224] to-[#020308]",
    accent: "#6BFFFF",
    glow: "0 0 24px rgba(107,255,255,0.28), 0 0 14px rgba(22,70,245,0.16)",
    surface: "bg-white/12",
    text: "text-white",
    muted: "text-white/72",
  },
};

const LIGHT_BACKDROP =
  "radial-gradient(circle at 25% 20%, rgba(215,175,111,0.16), transparent 35%), radial-gradient(circle at 70% 10%, rgba(158,168,204,0.22), transparent 38%), linear-gradient(180deg, #fdfcf9 0%, #eef2ff 40%, #fef9f2 100%)";

const MOOD_BACKDROPS: Record<Mood, { light: string; dark: string }> = {
  "orya default": {
    light: LIGHT_BACKDROP,
    dark: [
      "radial-gradient(1200px 800px at 50% -200px, rgba(107,255,255,0.18), transparent 60%)",
      "radial-gradient(900px 700px at -220px 45%, rgba(156,114,255,0.22), transparent 65%)",
      "radial-gradient(980px 720px at 18% 68%, rgba(255,198,140,0.06), transparent 68%)",
      "radial-gradient(1000px 750px at 115% 65%, rgba(22,70,245,0.22), transparent 70%)",
      "radial-gradient(1100px 820px at 52% 82%, rgba(122,255,214,0.08), transparent 72%)",
      "linear-gradient(180deg, #050814 0%, #05040f 45%, #020308 100%)",
    ].join(", "),
  },
};

const TAGS = ["Eventos", "Tickets", "Comunidade", "Vendas"];

function Swatch({ color, isLight }: { color: string; isLight: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-8 w-8 rounded-full border border-white/10" style={{ background: color }} />
      <span className={`text-xs font-mono ${isLight ? "text-slate-700" : "text-white/70"}`}>{color}</span>
    </div>
  );
}

function Badge({ label, active, accent, light }: { label: string; active?: boolean; accent: string; light?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        active ? "text-black" : light ? "text-slate-600" : "text-white/70"
      }`}
      style={{
        background: active ? accent : light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
        border: active ? "1px solid transparent" : light ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {active ? "●" : "○"} {label}
    </span>
  );
}

export default function BrandTestPage() {
  const [mood] = useState<Mood>("orya default");
  const [tagline, setTagline] = useState("Eventos que respiram marca.");
  const [theme, setTheme] = useState<Theme>("dark");
  const isLight = theme === "light";
  const palette = PALETTES[mood];
  const accent = palette.accent;
  const cardShadow = isLight ? "0 12px 32px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.05)" : undefined;
  const accentGlow = palette.glow;
  const textMuted = theme === "light" ? "text-slate-600" : palette.muted;
  const neonFrame = {
    borderColor: `${accent}55`,
    boxShadow: isLight
      ? `${cardShadow}, 0 0 0 1px ${accent}2e, 0 18px 48px rgba(15,23,42,0.18)`
      : `0 0 0 1px ${accent}3a, ${accentGlow}`,
  };
  const backgroundImage = theme === "light" ? MOOD_BACKDROPS[mood].light : MOOD_BACKDROPS[mood].dark;
  const violetVeil =
    theme === "light"
      ? "radial-gradient(900px 700px at 70% 10%, rgba(156,114,255,0.12), transparent 52%)"
      : "radial-gradient(1000px 720px at 68% 18%, rgba(156,114,255,0.22), transparent 55%)";
  const glassBg =
    theme === "light"
      ? `linear-gradient(150deg, rgba(255,255,255,0.96), rgba(248,250,255,0.9), ${accent}1f)`
      : `linear-gradient(145deg, rgba(8,12,24,0.9), rgba(12,18,32,0.82), ${accent}1e)`;
  const glassBgSoft =
    theme === "light"
      ? `linear-gradient(150deg, rgba(255,255,255,0.96), rgba(244,248,255,0.9), ${accent}19)`
      : `linear-gradient(145deg, rgba(10,14,24,0.9), rgba(14,20,30,0.86), ${accent}20)`;
  const glassBgDeep =
    theme === "light"
      ? `linear-gradient(150deg, rgba(255,255,255,0.94), rgba(236,242,255,0.9), ${accent}14)`
      : `linear-gradient(145deg, rgba(6,10,18,0.92), rgba(10,15,24,0.9), ${accent}18)`;
  const blendedBg = `${glassBg}, ${violetVeil}, ${backgroundImage}`;
  const blendedSoft = `${glassBgSoft}, ${violetVeil}, ${backgroundImage}`;
  const blendedDeep = `${glassBgDeep}, ${violetVeil}, ${backgroundImage}`;
  const titleGradientClass =
    "bg-gradient-to-r from-[#ff3fc6] via-[#7f8dff] to-[#32d4ff] bg-clip-text text-transparent";
  const titleGlow = theme === "light" ? "0 0 32px rgba(86,140,255,0.55)" : "0 0 24px rgba(122,182,255,0.48)";
  const innerBgClass =
    theme === "light"
      ? "bg-gradient-to-br from-[#f7f9ff] via-[#eef2ff] to-[#fef7ff]"
      : `bg-gradient-to-br ${palette.gradient}`;

  const profile = {
    name: "Inês Duarte",
    handle: "@inesduarte",
    role: "Curadora de eventos · Comunidade Aurora",
    location: "Lisboa, PT",
    tagline: "Cria eventos imersivos e cuida das pessoas — o foco é sempre a energia no dia seguinte.",
  };

  const highlights = [
    { label: "Seguidores", value: "12.4K", delta: "+280" },
    { label: "Eventos criados", value: "48", delta: "+2 este mês" },
    { label: "Ingressos vendidos", value: "18.2K", delta: "+3%" },
    { label: "Avaliação média", value: "4.9 ★", delta: "Top 3%" },
  ];

  const timeline = [
    {
      title: "Rooftop Aurora",
      time: "Há 2h",
      detail: "Lançou nova edição com pré-venda limitada",
      tag: "Evento",
      tone: "accent",
    },
    {
      title: "Live Session · Padel Night",
      time: "Ontem",
      detail: "Resumo de vendas: 82% dos ingressos esgotados",
      tag: "Insights",
      tone: "muted",
    },
    {
      title: "Comunidade",
      time: "3 dias",
      detail: "Abriram 3 convites VIP para hosts parceiros",
      tag: "Rede",
      tone: "soft",
    },
    {
      title: "Aurora Evento",
      time: "1 semana",
      detail: "Survey pós-evento: NPS 72 e comentários positivos",
      tag: "Feedback",
      tone: "glow",
    },
  ];

  const passes = [
    { name: "Aurora Club", level: "Gold Pass", status: "Renova em 18 dias", perk: "Acesso antecipado + lounges" },
    { name: "Night Padel", level: "Season Access", status: "Ativo até Jun 2024", perk: "Entradas ilimitadas" },
  ];

  const tickets = [
    { title: "Night Padel Series", date: "12 Mar · 21:00", city: "Lisboa", status: "Check-in ativo", fill: 82 },
    { title: "Brunch Talks", date: "18 Mar · 11:00", city: "Porto", status: "Pré-venda", fill: 54 },
    { title: "Sunset Rooftop", date: "22 Mar · 18:30", city: "Lisboa", status: "Listas abertas", fill: 68 },
  ];

  const badges = [
    { title: "Super Host", desc: "20 eventos acima de 4.8 ★", color: palette.accent },
    { title: "Trusted", desc: "Verificação KYC concluída", color: "#7effe0" },
    { title: "Growth Maker", desc: "Taxa média de ocupação > 75%", color: "#ffc857" },
  ];

  const glassVariants = [
    {
      title: "Azure Frost",
      bg: "linear-gradient(145deg, rgba(120,195,255,0.24), rgba(18,30,50,0.9))",
      stroke: "1px solid rgba(120,195,255,0.22)",
      shadow: "0 20px 48px rgba(120,195,255,0.16)",
      text: "#e5e7eb",
    },
    {
      title: "Helio Violet",
      bg: "linear-gradient(150deg, rgba(156,114,255,0.28), rgba(18,18,36,0.9))",
      stroke: "1px solid rgba(156,114,255,0.26)",
      shadow: "0 20px 48px rgba(156,114,255,0.18)",
      text: "#ede9fe",
    },
    {
      title: "Amber Smoke",
      bg: "linear-gradient(150deg, rgba(255,198,140,0.18), rgba(18,14,10,0.9))",
      stroke: "1px solid rgba(255,198,140,0.22)",
      shadow: "0 18px 40px rgba(255,198,140,0.14)",
      text: "#fef3c7",
    },
    {
      title: "Mint Echo",
      bg: "linear-gradient(150deg, rgba(122,255,214,0.18), rgba(12,20,18,0.9))",
      stroke: "1px solid rgba(122,255,214,0.2)",
      shadow: "0 18px 42px rgba(122,255,214,0.15)",
      text: "#d1fae5",
    },
  ];

  const uiButtons = [
    {
      label: "Primário (Glass)",
      bg: `linear-gradient(145deg, ${accent}, rgba(255,255,255,0.08))`,
      color: "#0b1020",
      border: "1px solid transparent",
      shadow: accentGlow,
    },
    {
      label: "Secundário",
      bg: "rgba(255,255,255,0.06)",
      color: "#e5e7eb",
      border: "1px solid rgba(255,255,255,0.12)",
      shadow: "0 0 0 1px rgba(255,255,255,0.08)",
    },
    {
      label: "Outline Neon",
      bg: "transparent",
      color: accent,
      border: `1px solid ${accent}66`,
      shadow: `0 0 16px ${accent}33`,
    },
    {
      label: "Roxo Suave",
      bg: "linear-gradient(145deg, rgba(156,114,255,0.22), rgba(12,16,32,0.9))",
      color: "#ede9fe",
      border: "1px solid rgba(156,114,255,0.32)",
      shadow: "0 0 20px rgba(156,114,255,0.2)",
    },
  ];

  const premiumBadges = [
    { label: "Nova", bg: "rgba(107,255,255,0.16)", border: "1px solid rgba(107,255,255,0.35)", color: "#e0f2fe" },
    { label: "Prime", bg: "rgba(156,114,255,0.16)", border: "1px solid rgba(156,114,255,0.35)", color: "#ede9fe" },
    { label: "VIP", bg: "rgba(255,198,140,0.16)", border: "1px solid rgba(255,198,140,0.32)", color: "#ffedd5" },
    { label: "Mint", bg: "rgba(122,255,214,0.16)", border: "1px solid rgba(122,255,214,0.32)", color: "#d1fae5" },
  ];

  return (
    <div
      className={`min-h-screen ${theme === "light" ? "bg-[#f4f6fb] text-slate-900" : palette.text}`}
      style={{
        backgroundImage,
        backgroundColor: theme === "dark" ? "#0b1020" : "#f7f8fb",
      }}
    >
      <div className={`min-h-screen ${innerBgClass}`}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-10 space-y-8">
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${
                  isLight ? "border-black/5 bg-black/[0.03] text-slate-600" : "border-white/12 bg-white/5 text-white/70"
                }`}
              >
                Laboratório de Identidade
              </div>
              <h1
                className={`text-3xl font-semibold leading-tight sm:text-4xl ${titleGradientClass}`}
                style={{ fontFamily: "'Space Grotesk', 'Sora', system-ui, sans-serif", textShadow: titleGlow }}
              >
                ORYA – Playground de rebranding
              </h1>
              <p className={`${textMuted} max-w-2xl text-sm sm:text-base`}>
                Testa cores, mood e voz antes de fechar o novo look & feel. Nada aqui é definitivo — é um moodboard vivo para validar decisões rápidas.
              </p>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <Badge key={t} label={t} active={t === "Eventos"} accent={palette.accent} light={isLight} />
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3 md:min-w-[240px] justify-end">
              <span
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                  isLight ? "border-black/5 bg-black/[0.03] text-slate-700" : "border-white/15 bg-white/5 text-white/80"
                }`}
              >
                {palette.name}
              </span>
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1">
                {(["dark", "light"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                      theme === t ? "bg-white text-black" : isLight ? "text-slate-600" : "text-white/70"
                    }`}
                  >
                    {t === "dark" ? "Dark" : "Light"}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
              <div className="space-y-6">
                <div
                  className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
                  style={{
                    background: blendedBg,
                    color: isLight ? "#0f172a" : undefined,
                    borderColor: neonFrame.borderColor,
                    boxShadow: neonFrame.boxShadow,
                  }}
                >
                  <div className="absolute inset-0 opacity-70" style={{ background: blendedSoft }} />
                  <div className="relative p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className="h-16 w-16 rounded-2xl border border-white/20"
                          style={{ background: `linear-gradient(145deg, ${accent}, rgba(255,255,255,0.08))`, boxShadow: accentGlow }}
                        />
                        <div className="space-y-1">
                          <p className={`text-[11px] uppercase tracking-[0.2em] ${isLight ? "text-slate-600" : "text-white/60"}`}>Perfil</p>
                          <h2 className={`text-2xl font-semibold ${titleGradientClass}`} style={{ textShadow: titleGlow }}>
                            {profile.name}
                          </h2>
                          <p className={`${textMuted} text-sm`}>{profile.role}</p>
                          <p className={`${textMuted} text-sm`}>{profile.handle} · {profile.location}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full px-4 py-2 text-sm font-semibold"
                          style={{ background: accent, color: "#0b1020", boxShadow: accentGlow, border: "1px solid transparent" }}
                        >
                          Seguir
                        </button>
                        <button
                          className="rounded-full px-4 py-2 text-sm font-semibold"
                          style={{
                            background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.08)",
                            color: isLight ? "#0f172a" : "#e5e7eb",
                            border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          Partilhar
                        </button>
                        <button
                          className="rounded-full px-4 py-2 text-sm font-semibold"
                          style={{
                            background: "transparent",
                            color: isLight ? "#0f172a" : "#e5e7eb",
                            border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.25)",
                          }}
                        >
                          Mensagem
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {highlights.slice(0, 2).map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-white/15 p-3"
                          style={{
                            background: glassBgDeep,
                            borderColor: `${accent}33`,
                            boxShadow: isLight ? `${cardShadow}, 0 0 0 1px ${accent}22` : `0 0 0 1px ${accent}44, ${accentGlow}`,
                          }}
                        >
                          <p className={`${textMuted} text-xs uppercase tracking-[0.18em]`}>{item.label}</p>
                          <div className="mt-1 flex items-baseline justify-between">
                            <p className="text-xl font-semibold">{item.value}</p>
                            <span className="text-[11px] text-emerald-300/80">{item.delta}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-white/15 p-4 space-y-3" style={{ background: glassBgDeep }}>
                      <div className="flex items-center justify-between">
                        <p className={`${textMuted} text-xs uppercase tracking-[0.18em]`}>Voz / Bio de teste</p>
                        <span className={`text-[11px] ${isLight ? "text-slate-600" : "text-white/60"}`}>Preview dinâmica</span>
                      </div>
                      <input
                        type="text"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                          isLight
                            ? "border-black/10 bg-white text-slate-900 placeholder:text-slate-400 focus:border-black/30"
                            : "border-white/20 bg-white/5 text-white placeholder:text-white/50 focus:border-white/50"
                        }`}
                        placeholder="Escreve uma frase que resuma a tua vibe"
                      />
                      <p className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', 'Sora', system-ui, sans-serif" }}>
                        {tagline || "Uma linha forte define o ritmo."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {["Eventos imersivos", "Comunidade", "Brand lovers", "Rapidez de venda"].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full px-3 py-1 text-[11px] font-semibold"
                            style={{
                              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.08)",
                              border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.12)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-white/10 p-6 shadow-xl"
                  style={{
                    background: glassBg,
                    color: isLight ? "#0f172a" : undefined,
                    borderColor: neonFrame.borderColor,
                    boxShadow: neonFrame.boxShadow,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-[11px] uppercase tracking-[0.2em] ${isLight ? "text-slate-500" : "text-white/55"}`}>Linha temporal</p>
                      <h3 className="text-xl font-semibold">Atividade recente</h3>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        isLight ? "border-black/10 text-slate-600" : "border-white/15 text-white/70"
                      }`}
                    >
                      Mock feed
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {timeline.map((item) => (
                      <div
                        key={item.title}
                        className="group rounded-xl border border-white/10 p-4 transition hover:-translate-y-0.5 hover:border-white/25"
                        style={{
                          background: blendedDeep,
                          borderColor: `${accent}33`,
                          boxShadow: isLight ? `${cardShadow}, 0 0 0 1px ${accent}22` : `0 0 0 1px ${accent}44, ${accentGlow}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className={`${textMuted} text-sm`}>{item.detail}</p>
                            <p className={`${textMuted} text-xs`}>{item.time}</p>
                          </div>
                          <span
                            className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              background:
                                item.tone === "accent"
                                  ? accent
                                  : item.tone === "muted"
                                    ? "rgba(255,255,255,0.08)"
                                    : item.tone === "glow"
                                      ? "rgba(255,255,255,0.12)"
                                      : "rgba(255,255,255,0.05)",
                              color: item.tone === "accent" ? "#0b1020" : isLight ? "#0f172a" : "#e5e7eb",
                              border: "1px solid transparent",
                              boxShadow: item.tone === "glow" ? accentGlow : undefined,
                            }}
                          >
                            {item.tag}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className="rounded-2xl border border-white/10 p-6 shadow-xl"
                  style={{
                    background: blendedSoft,
                    color: isLight ? "#0f172a" : undefined,
                    borderColor: neonFrame.borderColor,
                    boxShadow: neonFrame.boxShadow,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-[11px] uppercase tracking-[0.2em] ${isLight ? "text-slate-500" : "text-white/60"}`}>Painel rápido</p>
                    <span className={`${isLight ? "text-slate-500" : "text-white/60"} text-xs`}>Live view</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {highlights.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-white/10 p-4"
                        style={{
                          background: glassBgDeep,
                          borderColor: `${accent}33`,
                          boxShadow: isLight ? `${cardShadow}, 0 0 0 1px ${accent}22` : `0 0 0 1px ${accent}44, ${accentGlow}`,
                        }}
                      >
                        <p className={`${textMuted} text-xs uppercase tracking-[0.18em]`}>{item.label}</p>
                        <div className="mt-1 flex items-baseline justify-between">
                          <p className="text-xl font-semibold">{item.value}</p>
                          <span className="text-[11px] text-emerald-300/80">{item.delta}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-white/10 p-5 shadow-xl"
                  style={{
                    background: glassBg,
                    color: isLight ? "#0f172a" : undefined,
                    borderColor: neonFrame.borderColor,
                    boxShadow: neonFrame.boxShadow,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className={`${textMuted} text-xs uppercase tracking-[0.18em]`}>Passes & memberships</p>
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] ${
                        isLight ? "border-black/10 text-slate-600" : "border-white/15 text-white/70"
                      }`}
                    >
                      Mock
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {passes.map((p) => (
                      <div
                        key={p.name}
                        className="rounded-xl border border-white/10 p-3 flex items-start justify-between"
                        style={{
                          background: glassBgDeep,
                          borderColor: `${accent}33`,
                          boxShadow: isLight ? `${cardShadow}, 0 0 0 1px ${accent}22` : `0 0 0 1px ${accent}44, ${accentGlow}`,
                        }}
                      >
                        <div>
                          <p className="text-sm font-semibold">{p.name}</p>
                          <p className={`${textMuted} text-xs`}>{p.level}</p>
                          <p className={`${textMuted} text-xs`}>{p.perk}</p>
                        </div>
                        <span className="rounded-full px-3 py-1 text-[11px]" style={{ background: accent, color: "#0b1020" }}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-white/10 p-5 shadow-xl"
                  style={{
                    background: blendedSoft,
                    color: isLight ? "#0f172a" : undefined,
                    borderColor: neonFrame.borderColor,
                    boxShadow: neonFrame.boxShadow,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className={`${textMuted} text-xs uppercase tracking-[0.18em]`}>Badges</p>
                    <span className={`${isLight ? "text-slate-500" : "text-white/60"} text-xs`}>Reconhecimento</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {badges.map((b) => (
                      <div
                        key={b.title}
                        className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.14)",
                          color: isLight ? "#0f172a" : "#e5e7eb",
                          boxShadow: `0 0 24px ${b.color}33`,
                        }}
                      >
                        {b.title}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-white/10 p-5 shadow-xl"
                  style={{
                    background: blendedBg,
                    color: isLight ? "#0f172a" : undefined,
                    borderColor: neonFrame.borderColor,
                    boxShadow: neonFrame.boxShadow,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className={`${textMuted} text-xs uppercase tracking-[0.18em]`}>Eventos & ingressos</p>
                    <span className={`${isLight ? "text-slate-500" : "text-white/60"} text-xs`}>Preview</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {tickets.map((tk) => (
                      <div
                        key={tk.title}
                        className="rounded-xl border border-white/10 p-3"
                        style={{
                          background: glassBgDeep,
                          borderColor: `${accent}33`,
                          boxShadow: isLight ? `${cardShadow}, 0 0 0 1px ${accent}22` : `0 0 0 1px ${accent}44, ${accentGlow}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{tk.title}</p>
                            <p className={`${textMuted} text-sm`}>{tk.date} · {tk.city}</p>
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-[11px]"
                            style={{ background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.08)", border: "1px solid transparent" }}
                          >
                            {tk.status}
                          </span>
                        </div>
                        <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${tk.fill}%`, background: accent, boxShadow: accentGlow }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <section
              className="rounded-2xl border border-white/10 p-6 shadow-2xl"
              style={{
                background: blendedBg,
                color: isLight ? "#0f172a" : undefined,
                borderColor: neonFrame.borderColor,
                boxShadow: neonFrame.boxShadow,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`${textMuted} text-[11px] uppercase tracking-[0.18em]`}>Glass Lab</p>
                  <h3 className="text-xl font-semibold">Tinted glass + UI kit</h3>
                  <p className={`${textMuted} text-sm`}>Variações premium de vidro colorido, botões e badges.</p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  Curado
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {glassVariants.map((v) => (
                  <div
                    key={v.title}
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: v.bg, border: v.stroke, boxShadow: v.shadow, color: v.text }}
                  >
                    <p className="text-sm font-semibold">{v.title}</p>
                    <p className="text-[12px] text-white/70">Vidro com pigmento sutil e brilho suave.</p>
                    <div className="h-1.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.25)" }} />
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {uiButtons.map((btn) => (
                  <button
                    key={btn.label}
                    className="w-full rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-[1px]"
                    style={{
                      background: btn.bg,
                      color: btn.color,
                      border: btn.border,
                      boxShadow: btn.shadow,
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {premiumBadges.map((b) => (
                  <span
                    key={b.label}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ background: b.bg, border: b.border, color: b.color, boxShadow: "0 0 16px rgba(0,0,0,0.22)" }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
