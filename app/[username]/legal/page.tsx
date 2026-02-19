import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { resolveStorePolicy } from "@/lib/store/policySettings";
import { ensureDefaultPoliciesSafe } from "@/lib/organizationPolicies";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

function formatWindow(minutes: number | null) {
  if (minutes === null) return "nao permitido";
  if (minutes === 0) return "ate ao momento de inicio";
  if (minutes % 1440 === 0) return `ate ${minutes / 1440} dia(s) antes do inicio`;
  if (minutes % 60 === 0) return `ate ${minutes / 60} hora(s) antes do inicio`;
  return `ate ${minutes} minuto(s) antes do inicio`;
}

export default async function OrganizationLegalPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawUsername = resolvedParams?.username ?? "";
  const username = normalizeUsernameInput(rawUsername);

  if (!username) notFound();
  if (username === "me") redirect("/me");
  if (isReservedUsername(username)) notFound();
  if (rawUsername !== username) redirect(`/${username}/legal`);

  const organization = await prisma.organization.findFirst({
    where: { username, status: "ACTIVE" },
    select: {
      id: true,
      username: true,
      publicName: true,
      businessName: true,
      officialEmail: true,
    },
  });

  if (!organization) notFound();

  await ensureDefaultPoliciesSafe(organization.id);

  const [settings, policies] = await Promise.all([
    prisma.organizationSettings.findUnique({
      where: { organizationId: organization.id },
      select: {
        supportEmail: true,
        supportPhone: true,
        storeReturnPolicyMode: true,
        storeReturnWindowDays: true,
      },
    }),
    prisma.organizationPolicy.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "asc" }],
      select: {
        policyType: true,
        allowCancellation: true,
        cancellationWindowMinutes: true,
        allowReschedule: true,
        rescheduleWindowMinutes: true,
      },
    }),
  ]);

  const storePolicy = resolveStorePolicy({
    settings,
    fallbackSupportEmail: organization.officialEmail ?? null,
    organizationUsername: organization.username ?? null,
  });

  const bookingPolicy = policies.find((policy) => policy.policyType === "MODERATE") ?? policies[0] ?? null;
  const displayName =
    organization.publicName?.trim() ||
    organization.businessName?.trim() ||
    organization.username ||
    "Organizacao";

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
        <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Legal</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{displayName}</h1>
          <p className="mt-2 text-sm text-white/70">
            Pagina canonica de termos, privacidade e politicas operacionais desta organizacao na ORYA.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <a href="#termos" className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">Termos</a>
            <a href="#privacidade" className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">Privacidade</a>
            <a href="#reservas" className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">Reservas</a>
            <a href="#loja-devolucoes" className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">Loja</a>
          </div>
        </section>

        <section id="termos" className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white">Termos de utilizacao</h2>
          <p className="mt-2 text-sm text-white/75">
            Os servicos desta organizacao sao disponibilizados na ORYA e seguem os termos da plataforma, acrescidos das
            regras operacionais configuradas abaixo. Ao concluir compras ou reservas, o utilizador aceita estes termos.
          </p>
        </section>

        <section id="privacidade" className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white">Privacidade</h2>
          <p className="mt-2 text-sm text-white/75">{storePolicy.privacyPolicy}</p>
          <p className="mt-3 text-sm text-white/70">
            Contacto de suporte: {storePolicy.supportEmail ?? "nao definido"}{storePolicy.supportPhone ? ` | ${storePolicy.supportPhone}` : ""}
          </p>
        </section>

        <section id="reservas" className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white">Politica de reservas e cancelamentos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
            <li>
              Cancelamento por cliente: {bookingPolicy?.allowCancellation ? formatWindow(bookingPolicy.cancellationWindowMinutes) : "nao permitido"}.
            </li>
            <li>
              Reembolso elegivel por cliente: valor pago menos apenas a taxa real de processamento do pagamento.
            </li>
            <li>Nao existe penalizacao percentual configuravel de cancelamento nesta versao.</li>
            <li>Cancelamento iniciado pela organizacao: reembolso total.</li>
            <li>
              Reagendamento: {bookingPolicy?.allowReschedule ? formatWindow(bookingPolicy.rescheduleWindowMinutes ?? bookingPolicy.cancellationWindowMinutes ?? null) : "nao permitido"}.
            </li>
          </ul>
        </section>

        <section id="loja-devolucoes" className="rounded-3xl border border-white/12 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white">Politica da loja</h2>
          <p className="mt-2 text-sm text-white/75">{storePolicy.returnPolicy}</p>
          <p className="mt-3 text-sm text-white/70">
            Esta politica e gerada automaticamente por template ORYA a partir dos campos estruturados da organizacao.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${username}`}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white/80 hover:border-white/40"
          >
            Voltar ao perfil
          </Link>
          <Link
            href={`/${username}/loja`}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white/80 hover:border-white/40"
          >
            Ir para a loja
          </Link>
        </div>
      </div>
    </main>
  );
}
