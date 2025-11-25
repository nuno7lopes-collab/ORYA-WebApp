"use client";

import Link from "next/link";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

export default function OrganizadorPage() {
  const { user, profile, isLoading: userLoading, mutate: mutateUser } = useUser();
  const { openModal } = useAuthModal();

  const { data: organizerData, isLoading: organizerLoading, mutate: mutateOrganizer } = useSWR(
    user ? "/api/organizador/me" : null,
    (url: string) => fetch(url).then((res) => res.json())
  );

  const organizer = organizerData?.organizer ?? null;
  const loading = userLoading || organizerLoading;

  async function handleBecomeOrganizer() {
    try {
      const res = await fetch("/api/organizador/become", {
        method: "POST",
      });

      if (!res.ok) {
        console.error("Erro ao tornar organizador");
        return;
      }

      await mutateOrganizer();
      await mutateUser();
    } catch (err) {
      console.error("Erro inesperado ao tornar organizador", err);
    }
  }

  function renderPrimaryCta() {
    if (loading) {
      return (
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-sm font-semibold text-black/60 shadow-[0_20px_70px_rgba(15,23,42,0.95)] shadow-[#6bffff80] opacity-70"
        >
          A carregar a tua conta...
        </button>
      );
    }

    if (!user) {
      return (
        <button
          type="button"
          onClick={() =>
            openModal({
              mode: "login",
              redirectTo: "/organizador",
            })
          }
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(15,23,42,0.95)] shadow-[#6bffff80] transition-transform hover:translate-y-[1px] hover:brightness-110"
        >
          Entrar para criar o meu primeiro evento
          <span className="text-[15px]">↗</span>
        </button>
      );
    }

    if (!organizer) {
      return (
        <button
          type="button"
          onClick={handleBecomeOrganizer}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(15,23,42,0.95)] shadow-[#6bffff80] transition-transform hover:translate-y-[1px] hover:brightness-110"
        >
          Quero ser organizador ORYA
          <span className="text-[15px]">↗</span>
        </button>
      );
    }

    return (
      <Link
        href="/organizador/eventos/novo"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_20px_70px_rgba(15,23,42,0.95)] shadow-[#6bffff80] transition-transform hover:translate-y-[1px] hover:brightness-110"
      >
        Criar o meu próximo evento
        <span className="text-[15px]">↗</span>
      </Link>
    );
  }

  const statusText = (() => {
    if (loading) {
      return "A carregar o estado da tua conta de organizador...";
    }
    if (!user) {
      return "Entra ou cria conta para começares a vender bilhetes com a ORYA.";
    }
    if (!organizer) {
      return "Ainda não és organizador ORYA. Clica em “Quero ser organizador ORYA” para começares a criar eventos.";
    }
    return "Já és organizador ORYA — agora é só criares o próximo evento e acompanhar as vendas aqui.";
  })();

  return (
    <main className="orya-body-bg min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-14 md:px-6 lg:px-8">
        {/* HERO – PARA ORGANIZADORES */}
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)] md:items-center">
          <div className="space-y-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-400">
              ORYA · PARA ORGANIZADORES
            </p>

            <h1 className="text-[2.1rem] font-extrabold leading-tight md:text-[2.6rem] md:leading-[1.05]">
              A forma moderna de{" "}
              <span className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
                gerir bilhetes, waves e entradas
              </span>{" "}
              — sem excels, links partidos ou filas sem controlo.
            </h1>

            <p className="max-w-xl text-sm text-zinc-200 md:text-[15px]">
              A ORYA foi pensada para quem cria festas, sunsets, eventos
              desportivos, jantares, festivais ou experiencias diferentes. Numa
              só plataforma tens bilhética, controlo de stock, pagamentos e
              check-in digital ligados ao teu evento.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {renderPrimaryCta()}
              <Link
                href="/explorar"
                className="inline-flex items-center justify-center rounded-full border border-zinc-600/70 bg-black/40 px-5 py-2 text-xs font-medium text-zinc-100 hover:border-zinc-300 hover:bg-black/70"
              >
                Ver exemplos de eventos na ORYA
              </Link>
            </div>

            <p className="text-[11px] text-zinc-400">
              {statusText}
            </p>
          </div>

          {/* CARD RESUMO – BENEFÍCIOS RÁPIDOS */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#FF00C8]/45 via-[#6BFFFF]/25 to-[#1646F5]/45 opacity-90 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/18 bg-gradient-to-br from-[#FF8AD906] via-[#9BE7FF12] to-[#020617f2] backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.9)] p-6 md:p-7 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-200">
                    O que ganhas com a ORYA
                  </p>
                  <p className="mt-1 text-xs text-zinc-300">
                    Tudo o que precisas para vender e controlar entradas como
                    uma marca grande.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[11px] font-medium text-emerald-100">
                  Versão beta
                </span>
              </div>

              <div className="grid gap-3 text-[11px] text-zinc-100">
                <div className="rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5">
                  <p className="font-semibold text-xs">
                    Waves &amp; stock em tempo real
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-300">
                    Cria Early Bird, Regular e Last Call, define quantidades e
                    deixa a plataforma tratar do &quot;esgotado&quot;.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5">
                  <p className="font-semibold text-xs">
                    Pagamentos integrados (Stripe)
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-300">
                    Pagamentos online com recibo imediato e registo automático
                    de compra. No futuro: MB Way, Apple Pay e mais.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5">
                  <p className="font-semibold text-xs">
                    Check-in digital &amp; lista à porta
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-300">
                    Cada bilhete fica ligado ao utilizador. Podes validar à
                    entrada com base na conta / QR code (próxima fase).
                  </p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5">
                  <p className="font-semibold text-xs">
                    Dados sobre o teu evento
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-300">
                    Sabe quantos bilhetes vendeste por wave, quem está a
                    comprar e qual o ritmo de vendas ao longo do tempo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECÇÃO 2 – EM 3 PASSOS */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-black/25 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.85)] backdrop-blur-xl md:p-8">
          <h2 className="text-base font-semibold md:text-lg">
            Como começar a usar a ORYA como organizador
          </h2>
          <p className="mt-1 text-xs text-zinc-300 md:text-sm">
            Em poucos minutos consegues ter o teu primeiro evento pronto a
            vender bilhetes.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF00C8] to-[#6BFFFF] text-xs font-bold text-black shadow-lg shadow-[#ff00c866]">
                1
              </div>
              <h3 className="text-sm font-semibold">
                Cria o evento na plataforma
              </h3>
              <p className="text-xs text-zinc-300">
                Define título, descrição, capa, local, datas e fuso horário. É
                o que vai aparecer na página pública.
              </p>
              <Link
                href="/organizador/eventos/novo"
                className="mt-1 inline-flex text-[11px] font-medium text-[#6BFFFF] underline underline-offset-4"
              >
                Criar evento →
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6BFFFF] to-[#1646F5] text-xs font-bold text-black shadow-lg shadow-[#6bffff66]">
                2
              </div>
              <h3 className="text-sm font-semibold">
                Configura waves e bilhetes
              </h3>
              <p className="text-xs text-zinc-300">
                Escolhe quantas waves queres, preços, limites e se queres
                eventos pagos ou gratuitos. O preço mais baixo aparece como
                &quot;desde&quot;.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF00C8] to-[#1646F5] text-xs font-bold text-black shadow-lg shadow-[#ff00c866]">
                3
              </div>
              <h3 className="text-sm font-semibold">
                Partilha e acompanha vendas
              </h3>
              <p className="text-xs text-zinc-300">
                Partilha o link do evento, acompanha em tempo real as vendas e
                chega ao dia com tudo organizado e registado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECÇÃO 3 – PEQUENO FAQ RÁPIDO */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <h2 className="text-base font-semibold md:text-lg">
              Perguntas rápidas que um organizador faz
            </h2>
            <div className="space-y-3 text-xs text-zinc-200">
              <div>
                <p className="font-semibold text-zinc-50">
                  Posso começar com um único evento?
                </p>
                <p className="text-zinc-300">
                  Sim. Não precisas de contrato gigante nem integrar logo tudo.
                  Começa com um evento piloto, vê como corre e só depois decides
                  se queres trazer o resto.
                </p>
              </div>

              <div>
                <p className="font-semibold text-zinc-50">
                  Como é que os bilhetes são entregues?
                </p>
                <p className="text-zinc-300">
                  Nesta fase beta, o foco é garantir que a compra fica
                  registada e associada ao utilizador. A próxima etapa é ter
                  bilhetes com QR code dentro da app / conta de cada pessoa.
                </p>
              </div>

              <div>
                <p className="font-semibold text-zinc-50">
                  E se eu já vender bilhetes noutro lado?
                </p>
                <p className="text-zinc-300">
                  Podes usar a ORYA apenas para uma parte de lotação, uma wave
                  específica ou eventos paralelos (sunsets, afters, torneios,
                  etc.). A ideia é somar, não complicar.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.85)] backdrop-blur-xl text-xs text-zinc-200">
            <p className="text-[11px] uppercase tracking-[0.26em] text-zinc-400">
              FALAR COM A ORYA
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-50">
              Queres usar a ORYA num projeto maior?
            </p>
            <p className="mt-2 text-xs text-zinc-300">
              Se tens em mente um festival, circuito de eventos, torneios
              desportivos, noites fixas ou algo mais ambicioso, podes falar
              diretamente connosco para desenhar a melhor forma de integrar a
              plataforma.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <a
                href="mailto:hello@orya.app"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-[#6bffff80] hover:brightness-110"
              >
                Enviar e-mail para a equipa ORYA
              </a>
              <Link
                href="/organizador/eventos/novo"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-transparent px-4 py-2 text-[11px] font-medium text-zinc-100 hover:bg-white/5"
              >
                Criar evento agora e testar a plataforma
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}