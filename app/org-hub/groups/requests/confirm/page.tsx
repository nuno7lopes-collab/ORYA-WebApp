import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import RequestEmailConfirmClient from "@/app/org/_internal/core/organizations/RequestEmailConfirmClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function pickParamValue(raw: string | string[] | undefined): string | null {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : null;
  return null;
}

function normalizeBase(raw: string | null): "join-requests" | "exit-requests" | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === "join-requests") return "join-requests";
  if (value === "exit-requests") return "exit-requests";
  return null;
}

export default async function RequestEmailConfirmPage({
  searchParams,
}: {
  searchParams?: SearchParamsInput;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const base = normalizeBase(pickParamValue(resolvedSearchParams.base));
  const id = (pickParamValue(resolvedSearchParams.id) ?? "").trim();
  const token = (pickParamValue(resolvedSearchParams.token) ?? "").trim();

  if (!base || !id || !token) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-white md:px-6">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <h1 className="text-2xl font-semibold">Link inválido</h1>
          <p className="mt-2 text-sm text-white/75">
            O link de confirmação está incompleto. Abre novamente o email ou cola o link completo.
          </p>
          <Link
            href="/org-hub/groups"
            className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
          >
            Voltar ao hub de grupos
          </Link>
        </section>
      </div>
    );
  }

  return <RequestEmailConfirmClient base={base} requestId={id} token={token} />;
}
