import Link from "next/link";

const CARD_CLASS =
  "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050810]/90 p-6 shadow-[0_24px_65px_rgba(0,0,0,0.55)] backdrop-blur-2xl transition hover:-translate-y-[2px] hover:border-white/25";

export default function PadelHubPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <section className="orya-page-width px-6 pb-8 pt-12 md:px-10">
        <div className="space-y-4 rounded-3xl border border-white/12 bg-gradient-to-br from-[#173b32]/40 via-[#0d1628]/80 to-[#050810]/90 p-7 shadow-[0_28px_75px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Padel Hub</p>
          <h1 className="text-3xl font-semibold md:text-4xl">ORYA é agora padel-first</h1>
          <p className="max-w-3xl text-sm text-white/70 md:text-base">
            Descobre torneios, encontra parceiro, explora clubes e reserva aulas ou campos num só fluxo.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
            <Link
              href="/descobrir"
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
            >
              Abrir discovery padel
            </Link>
            <Link
              href="/onboarding/padel"
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 hover:bg-white/10"
            >
              Completar perfil competitivo
            </Link>
          </div>
        </div>
      </section>

      <section className="orya-page-width grid gap-4 px-6 pb-16 md:grid-cols-2 md:px-10 xl:grid-cols-3">
        <Link href="/descobrir" className={CARD_CLASS}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Torneios</p>
          <h2 className="mt-2 text-xl font-semibold">Competições e inscrições</h2>
          <p className="mt-2 text-sm text-white/70">
            Filtra por formato, nível e elegibilidade para encontrares o torneio certo.
          </p>
        </Link>

        <Link href="/padel/duplas" className={CARD_CLASS}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Duplas</p>
          <h2 className="mt-2 text-xl font-semibold">Jogos comunitários</h2>
          <p className="mt-2 text-sm text-white/70">
            Junta-te a duplas abertas e fecha a tua inscrição com menos fricção.
          </p>
        </Link>

        <Link href="/padel/rankings" className={CARD_CLASS}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Rankings</p>
          <h2 className="mt-2 text-xl font-semibold">Top jogadores</h2>
          <p className="mt-2 text-sm text-white/70">
            Acompanha o ranking global e a tua evolução competitiva no ecossistema ORYA.
          </p>
        </Link>

        <Link href="/padel/clubes" className={CARD_CLASS}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Clubes</p>
          <h2 className="mt-2 text-xl font-semibold">Oferta ativa em Portugal</h2>
          <p className="mt-2 text-sm text-white/70">
            Vê clubes públicos, localização e courts disponíveis para jogar mais vezes.
          </p>
        </Link>

        <Link href="/padel/aulas" className={CARD_CLASS}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Aulas</p>
          <h2 className="mt-2 text-xl font-semibold">Treino com treinador</h2>
          <p className="mt-2 text-sm text-white/70">
            Explora aulas e sessões técnicas com contexto competitivo e disponibilidade próxima.
          </p>
        </Link>

        <Link href="/padel/campos" className={CARD_CLASS}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Campos</p>
          <h2 className="mt-2 text-xl font-semibold">Reserva de courts</h2>
          <p className="mt-2 text-sm text-white/70">
            Reserva campos com preço claro e disponibilidade real por cidade.
          </p>
        </Link>
      </section>
    </main>
  );
}
