"use client";

import { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";

type EntitlementDetail = {
  entitlementId: string;
  type: string;
  status: string;
  scope: { eventId?: number | null; tournamentId?: number | null; seasonId?: number | null };
  snapshot: {
    title: string;
    coverUrl?: string | null;
    venueName?: string | null;
    startAt?: string | null;
    timezone?: string | null;
  };
  actions: { canShowQr?: boolean; canCheckIn?: boolean; canClaim?: boolean };
  qrToken?: string | null;
  audit?: { createdAt?: string; updatedAt?: string };
};

export default function WalletDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    // Redireciona para a carteira unificada mantendo compatibilidade
    if (params?.id) {
      router.replace(`/me/carteira?entitlementId=${params.id}`);
    } else {
      router.replace("/me/carteira");
    }
  }, [params?.id, router]);

  // Manter o conteúdo legacy como fallback enquanto o redirect ocorre
  const [item, setItem] = useState<EntitlementDetail | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/me/wallet/${params.id}`, { cache: "no-store" });
        if (res.status === 404) {
          notFound();
          return;
        }
        if (res.status === 401) {
          router.push("/login?redirectTo=/me/wallet/" + params.id);
          return;
        }
        if (!res.ok) {
          const text = await res.text();
          setError(text || "Erro ao carregar o entitlement.");
          return;
        }
        const data = (await res.json()) as EntitlementDetail;
        setItem(data);
        if (data.actions?.canShowQr && data.qrToken) {
          try {
            const qr = await QRCode.toDataURL(data.qrToken, { width: 480, margin: 1 });
            setQrDataUrl(qr);
          } catch {
            setQrDataUrl(null);
          }
        }
      } catch (err) {
        console.error("[wallet detail] error", err);
        setError("Erro inesperado ao carregar.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params?.id, router]);

  if (loading) {
    return (
      <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 space-y-4">
          <div className="h-12 w-48 rounded-full bg-white/5 border border-white/15 animate-pulse shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl" />
          <div className="h-[320px] rounded-3xl bg-white/5 border border-white/15 animate-pulse shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl" />
          <div className="h-[180px] rounded-3xl bg-white/5 border border-white/15 animate-pulse shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-10 space-y-4">
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm shadow-[0_16px_40px_rgba(127,29,29,0.35)] backdrop-blur-xl">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-10">
          <p className="text-sm text-white/70">Entitlement não encontrado.</p>
        </div>
      </main>
    );
  }

  const badgeColor =
    item.status === "ACTIVE"
      ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-50 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
      : item.status === "USED"
        ? "bg-blue-500/15 border-blue-400/35 text-blue-50 shadow-[0_0_20px_rgba(59,130,246,0.35)]"
        : "bg-red-500/15 border-red-400/35 text-red-50 shadow-[0_0_20px_rgba(248,113,113,0.35)]";

  const startDate = item.snapshot.startAt ? new Date(item.snapshot.startAt) : null;

  const startLabel =
    item.snapshot.startAt && item.snapshot.timezone
      ? new Intl.DateTimeFormat("pt-PT", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: item.snapshot.timezone,
        }).format(startDate!)
      : startDate
        ? startDate.toLocaleString("pt-PT")
        : "Data a anunciar";

  const updatedLabel = item.audit?.updatedAt
    ? new Date(item.audit.updatedAt).toLocaleString("pt-PT")
    : "—";

  const createdLabel = item.audit?.createdAt
    ? new Date(item.audit.createdAt).toLocaleString("pt-PT")
    : "—";

  const shortId = `#${item.entitlementId.slice(-6)}`;
  const hasQr = Boolean(item.actions?.canShowQr && qrDataUrl);

  const formatICSDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const escapeICSLine = (value: string) => value.replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

  const handleCopyId = async () => {
    if (!item?.entitlementId) return;
    try {
      await navigator.clipboard.writeText(item.entitlementId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1200);
    } catch {
      setCopiedId(false);
    }
  };

  const handleAddToCalendar = () => {
    if (!startDate) return;
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const title = item.snapshot.title || "Evento ORYA";
    const location = item.snapshot.venueName ?? "Local a anunciar";
    const description = `Passe ${shortId} — Estado: ${item.status}`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ORYA//Wallet//PT",
      "BEGIN:VEVENT",
      `UID:${item.entitlementId}@orya`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${escapeICSLine(title)}`,
      `DESCRIPTION:${escapeICSLine(description)}`,
      `LOCATION:${escapeICSLine(location)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const slug = title ? title.toLowerCase().replace(/\s+/g, "-") : "evento";
    link.download = `${slug || "evento"}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_55%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-12">

      <div className="flex items-center justify-between gap-3 pb-6">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Passe digital</p>
          <h1 className="text-2xl font-semibold leading-tight drop-shadow">Carteira • Detalhe</h1>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/70">Seguro e encriptado</span>
      </div>

      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0c1224]/90 via-[#0a101f]/92 to-[#070c18]/92 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.0)_28%,rgba(255,255,255,0.04)_52%,rgba(255,255,255,0.0)_75%)] opacity-70" />
          <div className="grid gap-6 lg:grid-cols-[1.12fr_0.95fr]">
            <div className="relative min-h-[260px] overflow-hidden rounded-[28px] border border-white/5 bg-white/[0.03]">
              {item.snapshot.coverUrl ? (
                <Image
                  src={item.snapshot.coverUrl}
                  alt={item.snapshot.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 520px"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-fuchsia-500/20 via-purple-500/10 to-indigo-500/10 text-6xl font-semibold text-white/60">
                  {item.snapshot.title.slice(0, 1)}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${badgeColor}`}>
                    <span className="h-2 w-2 rounded-full bg-current mix-blend-screen" />
                    {item.status}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/85 backdrop-blur">
                    {item.type.replace("_", " ")}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/75 backdrop-blur">
                    {shortId}
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold leading-snug drop-shadow">{item.snapshot.title}</h2>
                  <p className="text-sm text-white/75">{item.snapshot.venueName ?? "Local a anunciar"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {startLabel}
                  </span>
                  {item.snapshot.timezone ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      {item.snapshot.timezone}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Resumo do acesso</p>
                    <p className="text-lg font-semibold text-white">Pronto a usar</p>
                    <p className="text-sm text-white/70">
                      Mantém este passe à mão para check-in rápido e acompanhamento do evento.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/70">{shortId}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] text-white/80">
                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-white/50">Local</p>
                    <p>{item.snapshot.venueName ?? "A anunciar"}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-white/50">Data e hora</p>
                    <p>{startLabel}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-white/50">Estado</p>
                    <p>{item.status}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-white/50">Tipo</p>
                    <p>{item.type}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-white/65">
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:border-white/30 hover:bg-white/10 active:scale-[0.99]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {copiedId ? "Copiado!" : "Copiar ID do passe"}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToCalendar}
                    disabled={!startDate}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-r from-indigo-500/30 to-fuchsia-500/30 px-3 py-1.5 text-white transition hover:border-white/30 hover:from-indigo-500/40 hover:to-fuchsia-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                    Adicionar ao calendário
                  </button>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    Atualizado: {updatedLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    Criado: {createdLabel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1326]/80 via-[#0b0f1f]/85 to-[#0c0f1c]/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white/90">QR / Acesso</h2>
                  {item.actions?.canCheckIn ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] text-emerald-50">
                      <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                      Pronto para check-in
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">Consulta</span>
                  )}
                </div>
                {hasQr ? (
                  <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
                    <div className="overflow-hidden rounded-xl border border-white/20 bg-white/5 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                      <Image src={qrDataUrl!} alt="QR" width={240} height={240} className="rounded-lg" />
                    </div>
                    <p className="text-[12px] text-white/70">Apresenta este QR no check-in.</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                    QR indisponível no momento (estado ou políticas).
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_16px_38px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/90">Detalhes do entitlement</h3>
              <span className="text-[11px] text-white/60">ID completo</span>
            </div>
            <dl className="mt-3 space-y-3 text-[13px] text-white/80">
              <div className="flex flex-col">
                <dt className="text-white/60">Entitlement ID</dt>
                <dd className="font-mono text-[12px] text-white break-all">{item.entitlementId}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-white/60">Tipo</dt>
                <dd>{item.type}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-white/60">Estado</dt>
                <dd>{item.status}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-white/60">Atualizado</dt>
                <dd>{updatedLabel}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-white/60">Criado</dt>
                <dd>{createdLabel}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f152c]/85 to-[#0c111f]/85 p-4 shadow-[0_16px_38px_rgba(0,0,0,0.5)] backdrop-blur">
            <h3 className="text-sm font-semibold text-white/90">Como usar</h3>
            <ul className="mt-3 space-y-2 text-[13px] text-white/80">
              <li className="flex gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Faz login com a mesma conta usada na compra para validar o passe.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                Apresenta o QR no check-in; mantém o ecrã com brilho alto.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-purple-300" />
                Confere hora/local e chega com antecedência.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                Guarda o passe offline para evitar falhas de rede.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_16px_38px_rgba(0,0,0,0.5)] backdrop-blur">
            <h3 className="text-sm font-semibold text-white/90">Atividade</h3>
            <div className="mt-3 space-y-2 text-[13px] text-white/75">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Emitido</span>
                </div>
                <span className="text-white/60">{createdLabel}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span>Última atualização</span>
                </div>
                <span className="text-white/60">{updatedLabel}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
                  <span>Estado atual</span>
                </div>
                <span className="text-white/60">{item.status}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
