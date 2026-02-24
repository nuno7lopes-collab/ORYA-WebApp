export const runtime = "nodejs";

import Link from "next/link";
import BecomeOrganizationForm from "@/components/organization/BecomeOrganizationForm";
import BackLink from "@/components/BackLink";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import OrgHubTopNav from "@/app/org/_internal/core/organizations/OrgHubTopNav";

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function pickParamValue(raw: string | string[] | undefined): string | null {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : null;
  return null;
}

function parsePositiveInt(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export default async function OrgHubCreatePage({
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
  const groupModeParam = pickParamValue(resolvedSearchParams.groupMode)?.toUpperCase();
  const groupIdParam = parsePositiveInt(pickParamValue(resolvedSearchParams.groupId));

  const ownedGroupsRows = await prisma.organizationGroup.findMany({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      _count: { select: { organizations: true } },
      organizations: {
        select: { id: true, publicName: true, businessName: true },
        orderBy: { id: "asc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });

  const existingGroups = ownedGroupsRows.map((group) => ({
    id: group.id,
    organizationCount: group._count.organizations,
    sampleOrganizations: group.organizations.map(
      (organization) =>
        organization.publicName?.trim() ||
        organization.businessName?.trim() ||
        `Organização #${organization.id}`,
    ),
  }));

  const hasRequestedExistingGroup =
    groupModeParam === "EXISTING_GROUP" && typeof groupIdParam === "number";
  const hasOwnedRequestedGroup =
    hasRequestedExistingGroup && existingGroups.some((group) => group.id === groupIdParam);
  const initialGroupMode =
    hasOwnedRequestedGroup || (groupModeParam === "EXISTING_GROUP" && existingGroups.length > 0)
      ? "EXISTING_GROUP"
      : "NEW_GROUP";
  const initialGroupId =
    hasOwnedRequestedGroup
      ? groupIdParam
      : initialGroupMode === "EXISTING_GROUP"
        ? existingGroups[0]?.id ?? null
        : null;

  return (
    <div className="min-h-screen px-4 pb-12 pt-16 text-white">
      <div className="mx-auto max-w-[1160px] space-y-10">
        <div className="flex items-center justify-start">
          <BackLink hrefFallback="/descobrir" label="Voltar" />
        </div>

        <div className="flex justify-center">
          <OrgHubTopNav />
        </div>

        <header className="space-y-2.5 text-center md:space-y-3">
          <h1 className="text-3xl font-semibold md:text-[32px]">Cria o teu painel de organização</h1>
          <p className="mx-auto max-w-2xl text-[15px] text-white/75 md:text-base">
            Configuração simples e rápida para entrares no teu painel.
          </p>
        </header>

        <BecomeOrganizationForm
          existingGroups={existingGroups}
          initialGroupMode={initialGroupMode}
          initialGroupId={initialGroupId}
        />

        <footer className="pt-4 text-center text-[12px] text-white/60">
          Ao continuar, confirmas que representas esta entidade e aceitas os{" "}
          <Link href="/legal/organizacao" className="underline underline-offset-2 hover:text-white">
            Termos da Organização da ORYA
          </Link>
          .
        </footer>
      </div>
    </div>
  );
}
