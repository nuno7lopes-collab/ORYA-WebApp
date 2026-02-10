import { getCurrentUser } from "@/lib/supabaseServer";
import ForbiddenClient from "./ForbiddenClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminForbiddenPage() {
  const { user } = await getCurrentUser();

  return (
    <main className="min-h-screen flex items-center justify-center px-4 text-white bg-[radial-gradient(circle_at_top,#1a2133,#0a0b12_55%,#05060a_100%)]">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-white/20 bg-white/10 grid place-items-center text-lg font-semibold">
          !
        </div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Acesso restrito</p>
        <h1 className="mt-2 text-xl font-semibold">Não tens permissões de admin</h1>
        <p className="mt-3 text-sm text-white/65">
          Esta consola é restrita a contas administrativas. Se precisas de acesso,
          pede a um administrador para adicionar o teu utilizador como <span className="text-white/90">admin</span>.
        </p>
        <ForbiddenClient email={user?.email ?? null} />
      </div>
    </main>
  );
}
