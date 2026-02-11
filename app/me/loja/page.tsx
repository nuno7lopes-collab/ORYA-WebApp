import Link from "next/link";

export default function LegacyMyStorePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <h1 className="text-2xl font-semibold">Loja pessoal removida</h1>
      <p className="text-sm text-white/70">
        A gestão de Loja agora é exclusiva de organizações e está disponível em <code>/org/:orgId/loja</code>.
      </p>
      <Link
        href="/organizacao/organizations"
        className="rounded-full border border-white/20 bg-white/85 px-5 py-2 text-xs font-semibold text-black"
      >
        Ir para organizações
      </Link>
    </main>
  );
}
