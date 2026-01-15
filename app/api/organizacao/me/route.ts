

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getOrgTransferEnabled, getPlatformFees } from "@/lib/platformSettings";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { isValidWebsite } from "@/lib/validation/organization";
import { normalizeOrganizationAvatarUrl, normalizeOrganizationCoverUrl } from "@/lib/profileMedia";
import { Resend } from "resend";
import { cookies } from "next/headers";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import {
  DEFAULT_PRIMARY_MODULE,
  parsePrimaryModule,
  parseOrganizationModules,
} from "@/lib/organizationCategories";
import { OrganizationStatus } from "@prisma/client";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Não autenticado.",
          profile: null,
          organization: null,
        },
        { status: 401 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error: "Perfil não encontrado.",
          profile: null,
          organization: null,
        },
        { status: 404 }
      );
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get("orya_organization")?.value;
    const urlOrg = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
    const forcedOrgId = urlOrg ?? (cookieOrgId ? Number(cookieOrgId) : undefined);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: Number.isFinite(forcedOrgId) ? forcedOrgId : undefined,
      allowFallback: !urlOrg,
      allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
    });
    const [platformFees, orgTransferEnabled, organizationModules] = await Promise.all([
      getPlatformFees(),
      getOrgTransferEnabled(),
      organization
        ? prisma.organizationModuleEntry.findMany({
            where: { organizationId: organization.id, enabled: true },
            select: { moduleKey: true },
            orderBy: { moduleKey: "asc" },
          })
        : Promise.resolve([]),
    ]);

    const profilePayload = {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      city: profile.city,
      favouriteCategories: profile.favouriteCategories,
      onboardingDone: profile.onboardingDone,
      roles: profile.roles,
    };
    const profileRoles = (profile.roles || []) as string[];
    const isAdmin = profileRoles.some((r) => r?.toLowerCase() === "admin");

    const organizationPayload = organization
      ? {
          id: organization.id,
          username: organization.username,
          stripeAccountId: organization.stripeAccountId,
          status: organization.status,
          stripeChargesEnabled: organization.stripeChargesEnabled,
          stripePayoutsEnabled: organization.stripePayoutsEnabled,
          feeMode: organization.feeMode,
          platformFeeBps: organization.platformFeeBps,
          platformFeeFixedCents: organization.platformFeeFixedCents,
          businessName: organization.businessName,
          entityType: organization.entityType,
          city: organization.city,
          payoutIban: organization.payoutIban,
          language: (organization as { language?: string | null }).language ?? "pt",
          timezone: (organization as { timezone?: string | null }).timezone ?? "Europe/Lisbon",
          alertsEmail: (organization as { alertsEmail?: string | null }).alertsEmail ?? null,
          alertsSalesEnabled: (organization as { alertsSalesEnabled?: boolean | null }).alertsSalesEnabled ?? true,
          alertsPayoutEnabled: (organization as { alertsPayoutEnabled?: boolean | null }).alertsPayoutEnabled ?? false,
          officialEmail: (organization as { officialEmail?: string | null }).officialEmail ?? null,
          officialEmailVerifiedAt: (organization as { officialEmailVerifiedAt?: Date | null }).officialEmailVerifiedAt ?? null,
          brandingAvatarUrl: (organization as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
          brandingCoverUrl: (organization as { brandingCoverUrl?: string | null }).brandingCoverUrl ?? null,
          brandingPrimaryColor: (organization as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
          brandingSecondaryColor: (organization as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
          organizationKind: (organization as any).organizationKind ?? "PESSOA_SINGULAR",
          primaryModule:
            (organization as { primaryModule?: string | null }).primaryModule ??
            DEFAULT_PRIMARY_MODULE,
          reservationAssignmentMode:
            (organization as { reservationAssignmentMode?: string | null }).reservationAssignmentMode ?? "PROFESSIONAL",
          modules: organizationModules.map((module) => module.moduleKey),
          publicName: organization.publicName,
          address: (organization as { address?: string | null }).address ?? null,
          showAddressPublicly: (organization as { showAddressPublicly?: boolean | null }).showAddressPublicly ?? false,
          publicWebsite: (organization as { publicWebsite?: string | null }).publicWebsite ?? null,
          publicInstagram: (organization as { publicInstagram?: string | null }).publicInstagram ?? null,
          publicYoutube: (organization as { publicYoutube?: string | null }).publicYoutube ?? null,
          publicDescription: (organization as { publicDescription?: string | null }).publicDescription ?? null,
          publicHours: (organization as { publicHours?: string | null }).publicHours ?? null,
          infoRules: (organization as { infoRules?: string | null }).infoRules ?? null,
          infoFaq: (organization as { infoFaq?: string | null }).infoFaq ?? null,
          infoRequirements: (organization as { infoRequirements?: string | null }).infoRequirements ?? null,
          infoPolicies: (organization as { infoPolicies?: string | null }).infoPolicies ?? null,
          infoLocationNotes: (organization as { infoLocationNotes?: string | null }).infoLocationNotes ?? null,
          padelDefaults: {
            shortName: (organization as any).padelDefaultShortName ?? null,
            city: (organization as any).padelDefaultCity ?? null,
            address: (organization as any).padelDefaultAddress ?? null,
            courts: (organization as any).padelDefaultCourts ?? 0,
            hours: (organization as any).padelDefaultHours ?? null,
            ruleSetId: (organization as any).padelDefaultRuleSetId ?? null,
            favoriteCategories: (organization as any).padelFavoriteCategories ?? [],
          },
        }
      : null;

    const profileStatus =
      organization &&
      organization.businessName &&
      organization.city &&
      user.email
        ? "OK"
        : "MISSING_CONTACT";

    const isPlatformAccount = organization?.orgType === "PLATFORM";
    const paymentsStatus = organization
      ? isPlatformAccount
        ? "READY"
        : organization.stripeAccountId
          ? organization.stripeChargesEnabled && organization.stripePayoutsEnabled
            ? "READY"
            : "PENDING"
          : "NO_STRIPE"
      : "NO_STRIPE";

    return NextResponse.json(
      {
        ok: true,
        profile: profilePayload,
        organization: organizationPayload,
        platformFees,
        orgTransferEnabled,
        contactEmail: user.email,
        profileStatus,
        paymentsStatus,
        paymentsMode: isPlatformAccount ? "PLATFORM" : "CONNECT",
        membershipRole: membership?.role ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/organizacao/me error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno.",
        profile: null,
        organization: null,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user || error) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const {
      businessName,
      entityType,
      city,
      payoutIban,
      fullName,
      contactPhone,
      language,
      timezone,
      alertsEmail,
      alertsSalesEnabled,
      alertsPayoutEnabled,
      brandingAvatarUrl,
      brandingCoverUrl,
      brandingPrimaryColor,
      brandingSecondaryColor,
      organizationKind,
      publicName,
      publicWebsite,
      publicInstagram,
      publicYoutube,
      publicDescription,
      publicHours,
      infoRules,
      infoFaq,
      infoRequirements,
      infoPolicies,
      infoLocationNotes,
      address,
      showAddressPublicly,
      padelDefaultShortName,
      padelDefaultCity,
      padelDefaultAddress,
      padelDefaultCourts,
      padelDefaultHours,
      padelDefaultRuleSetId,
      padelFavoriteCategories,
    } = body as Record<string, unknown>;
    const primaryModuleRaw = (body as Record<string, unknown>).primaryModule;
    const reservationAssignmentModeRaw = (body as Record<string, unknown>).reservationAssignmentMode;
    const modulesRaw = (body as Record<string, unknown>).modules;

    const primaryModuleProvided = Object.prototype.hasOwnProperty.call(body, "primaryModule");
    const reservationAssignmentModeProvided = Object.prototype.hasOwnProperty.call(body, "reservationAssignmentMode");
    const modulesProvided = Object.prototype.hasOwnProperty.call(body, "modules");
    const alertsSalesProvided = Object.prototype.hasOwnProperty.call(body, "alertsSalesEnabled");

    const primaryModule = primaryModuleProvided
      ? parsePrimaryModule(primaryModuleRaw)
      : null;
    if (primaryModuleProvided && !primaryModule) {
      return NextResponse.json(
        { ok: false, error: "primaryModule inválido. Usa EVENTOS, RESERVAS ou TORNEIOS." },
        { status: 400 },
      );
    }

    const reservationAssignmentMode = reservationAssignmentModeProvided
      ? typeof reservationAssignmentModeRaw === "string"
        ? reservationAssignmentModeRaw.trim().toUpperCase()
        : null
      : null;
    if (
      reservationAssignmentModeProvided &&
      reservationAssignmentMode &&
      !["PROFESSIONAL", "RESOURCE"].includes(reservationAssignmentMode)
    ) {
      return NextResponse.json(
        { ok: false, error: "reservationAssignmentMode inválido. Usa PROFESSIONAL ou RESOURCE." },
        { status: 400 },
      );
    }

    const parsedModules = modulesProvided ? parseOrganizationModules(modulesRaw) : null;
    if (modulesProvided && parsedModules === null) {
      return NextResponse.json(
        { ok: false, error: "modules inválido. Usa uma lista de módulos válidos." },
        { status: 400 },
      );
    }

    // Validação de telefone (opcional, mas consistente com checkout)
    if (typeof contactPhone === "string" && contactPhone.trim()) {
      const phoneRaw = contactPhone.trim();
      if (!isValidPhone(phoneRaw)) {
        return NextResponse.json(
          { ok: false, error: "Telefone inválido. Usa um número real (podes incluir indicativo, ex.: +351...)." },
          { status: 400 },
        );
      }
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get("orya_organization")?.value;
    const urlOrg = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
    const forcedOrgId = urlOrg ?? (cookieOrgId ? Number(cookieOrgId) : undefined);

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: Number.isFinite(forcedOrgId) ? forcedOrgId : undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
      allowFallback: !urlOrg,
    });

    if (!organization) {
      return NextResponse.json({ ok: false, error: "Ainda não és organização." }, { status: 403 });
    }
    if (!membership || !["OWNER", "CO_OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { ok: false, error: "Apenas Owner ou Admin podem alterar estas definições." },
        { status: 403 },
      );
    }

    const isOwner = membership.role === "OWNER";
    const isCoOwner = membership.role === "CO_OWNER";
    const isAdmin = membership.role === "ADMIN";

    if (isAdmin) {
      const adminAllowed = new Set([
        "contactPhone",
        "address",
        "showAddressPublicly",
        "publicWebsite",
        "publicInstagram",
        "publicYoutube",
        "publicDescription",
        "publicHours",
        "infoRules",
        "infoFaq",
        "infoRequirements",
        "infoPolicies",
        "infoLocationNotes",
        "timezone",
        "reservationAssignmentMode",
      ]);
      const disallowed = Object.keys(body).filter((key) => !adminAllowed.has(key));
      if (disallowed.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Admins apenas podem alterar dados operacionais." },
          { status: 403 },
        );
      }
    }

    const profileUpdates: Record<string, unknown> = {};
    if (typeof fullName === "string") profileUpdates.fullName = fullName.trim() || null;
    if (typeof city === "string") profileUpdates.city = city.trim() || null;
    if (typeof contactPhone === "string") profileUpdates.contactPhone = normalizePhone(contactPhone.trim()) || null;
    if (typeof alertsEmail === "string" && alertsEmail.trim()) {
      const email = alertsEmail.trim();
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ ok: false, error: "Email de alertas inválido." }, { status: 400 });
      }
    }

    const organizationUpdates: Record<string, unknown> = {};
    const businessNameClean = typeof businessName === "string" ? businessName.trim() : undefined;
    const publicNameInput = typeof publicName === "string" ? publicName.trim() : undefined;
    const addressInput = typeof address === "string" ? address.trim() : undefined;
    const showAddressPubliclyInput = typeof showAddressPublicly === "boolean" ? showAddressPublicly : undefined;
    const normalizeSocialLink = (value: string, kind: "instagram" | "youtube") => {
      const trimmed = value.trim();
      if (!trimmed) return { value: null as string | null };
      let normalized = trimmed;
      if (trimmed.startsWith("@")) {
        normalized =
          kind === "instagram"
            ? `https://instagram.com/${trimmed.slice(1)}`
            : `https://youtube.com/@${trimmed.slice(1)}`;
      } else if (!/^https?:\/\//i.test(trimmed)) {
        normalized = `https://${trimmed}`;
      }
      if (!isValidWebsite(normalized)) {
        return {
          error: `${kind === "instagram" ? "Instagram" : "YouTube"} inválido. Usa um URL válido.`,
        };
      }
      return { value: normalized };
    };

    if (businessNameClean !== undefined) organizationUpdates.businessName = businessNameClean || null;
    if (publicNameInput !== undefined) {
      const fallbackPublic =
        businessNameClean ??
        organization.businessName ??
        organization.publicName ??
        null;
      organizationUpdates.publicName = publicNameInput || fallbackPublic || null;
    }
    if (addressInput !== undefined) organizationUpdates.address = addressInput || null;
    if (showAddressPubliclyInput !== undefined) organizationUpdates.showAddressPublicly = showAddressPubliclyInput;
    if (typeof publicWebsite === "string") {
      const trimmed = publicWebsite.trim();
      if (!trimmed) {
        organizationUpdates.publicWebsite = null;
      } else {
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        if (!isValidWebsite(normalized)) {
          return NextResponse.json(
            { ok: false, error: "Website inválido. Usa um URL válido (ex: https://orya.pt)." },
            { status: 400 },
          );
        }
        organizationUpdates.publicWebsite = normalized;
      }
    }

    if (typeof publicInstagram === "string") {
      const normalized = normalizeSocialLink(publicInstagram, "instagram");
      if (normalized.error) {
        return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
      }
      organizationUpdates.publicInstagram = normalized.value;
    }
    if (typeof publicYoutube === "string") {
      const normalized = normalizeSocialLink(publicYoutube, "youtube");
      if (normalized.error) {
        return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
      }
      organizationUpdates.publicYoutube = normalized.value;
    }
    if (typeof publicDescription === "string") {
      organizationUpdates.publicDescription = publicDescription.trim() || null;
    }
    if (typeof publicHours === "string") {
      organizationUpdates.publicHours = publicHours.trim() || null;
    }
    if (typeof infoRules === "string") {
      organizationUpdates.infoRules = infoRules.trim() || null;
    }
    if (typeof infoFaq === "string") {
      organizationUpdates.infoFaq = infoFaq.trim() || null;
    }
    if (typeof infoRequirements === "string") {
      organizationUpdates.infoRequirements = infoRequirements.trim() || null;
    }
    if (typeof infoPolicies === "string") {
      organizationUpdates.infoPolicies = infoPolicies.trim() || null;
    }
    if (typeof infoLocationNotes === "string") {
      organizationUpdates.infoLocationNotes = infoLocationNotes.trim() || null;
    }
    if (typeof entityType === "string") organizationUpdates.entityType = entityType.trim() || null;
    if (typeof city === "string") organizationUpdates.city = city.trim() || null;
    if (typeof payoutIban === "string") organizationUpdates.payoutIban = payoutIban.trim() || null;
    if (typeof language === "string") {
      const lang = language.toLowerCase();
      organizationUpdates.language = lang === "en" ? "en" : "pt";
    }
    if (typeof alertsEmail === "string") organizationUpdates.alertsEmail = alertsEmail.trim() || null;
    if (typeof alertsSalesEnabled === "boolean") organizationUpdates.alertsSalesEnabled = alertsSalesEnabled;
    if (typeof alertsPayoutEnabled === "boolean") organizationUpdates.alertsPayoutEnabled = alertsPayoutEnabled;
    if (typeof timezone === "string") organizationUpdates.timezone = timezone.trim() || "Europe/Lisbon";
    if (brandingAvatarUrl === null) organizationUpdates.brandingAvatarUrl = null;
    if (typeof brandingAvatarUrl === "string") {
      organizationUpdates.brandingAvatarUrl = normalizeOrganizationAvatarUrl(brandingAvatarUrl);
    }
    if (brandingCoverUrl === null) organizationUpdates.brandingCoverUrl = null;
    if (typeof brandingCoverUrl === "string") {
      organizationUpdates.brandingCoverUrl = normalizeOrganizationCoverUrl(brandingCoverUrl);
    }
    if (typeof brandingPrimaryColor === "string") organizationUpdates.brandingPrimaryColor = brandingPrimaryColor.trim() || null;
    if (typeof brandingSecondaryColor === "string")
      organizationUpdates.brandingSecondaryColor = brandingSecondaryColor.trim() || null;
    if (primaryModuleProvided && primaryModule) {
      organizationUpdates.primaryModule = primaryModule;
    }
    if (reservationAssignmentModeProvided && reservationAssignmentMode) {
      organizationUpdates.reservationAssignmentMode = reservationAssignmentMode;
    }
    if (typeof organizationKind === "string") {
      const kind = organizationKind.toUpperCase();
      const allowed = ["CLUBE_PADEL", "RESTAURANTE", "EMPRESA_EVENTOS", "ASSOCIACAO", "PESSOA_SINGULAR"];
      if (!allowed.includes(kind)) {
        return NextResponse.json(
          { ok: false, error: "organizationKind inválido. Usa CLUBE_PADEL, RESTAURANTE, EMPRESA_EVENTOS, ASSOCIACAO ou PESSOA_SINGULAR." },
          { status: 400 },
        );
      }
      organizationUpdates.organizationKind = kind;
    }
    if (typeof padelDefaultShortName === "string") {
      organizationUpdates.padelDefaultShortName = padelDefaultShortName.trim() || null;
    }
    if (typeof padelDefaultCity === "string") {
      organizationUpdates.padelDefaultCity = padelDefaultCity.trim() || null;
    }
    if (typeof padelDefaultAddress === "string") {
      organizationUpdates.padelDefaultAddress = padelDefaultAddress.trim() || null;
    }
    if (typeof padelDefaultHours === "string") {
      organizationUpdates.padelDefaultHours = padelDefaultHours.trim() || null;
    }
    if (typeof padelDefaultCourts === "number") {
      organizationUpdates.padelDefaultCourts = Math.max(0, Math.floor(padelDefaultCourts));
    }
    if (typeof padelDefaultRuleSetId === "number" && Number.isFinite(padelDefaultRuleSetId)) {
      organizationUpdates.padelDefaultRuleSetId = padelDefaultRuleSetId;
    }
    if (Array.isArray(padelFavoriteCategories)) {
      const nums = padelFavoriteCategories
        .map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null))
        .filter((v): v is number => v !== null);
      organizationUpdates.padelFavoriteCategories = nums;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.profile.update({
        where: { id: user.id },
        data: profileUpdates,
      });
    }

    if (Object.keys(organizationUpdates).length > 0) {
      await prisma.organization.update({
        where: { id: organization.id },
        data: organizationUpdates,
      });
    }

    if (modulesProvided) {
      await prisma.organizationModuleEntry.deleteMany({
        where: { organizationId: organization.id },
      });
      if (parsedModules && parsedModules.length > 0) {
        await prisma.organizationModuleEntry.createMany({
          data: parsedModules.map((moduleKey) => ({
            organizationId: organization.id,
            moduleKey,
            enabled: true,
          })),
        });
      }
    }

    const nextModulesRaw = modulesProvided
      ? parsedModules ?? []
      : (
          await prisma.organizationModuleEntry.findMany({
            where: { organizationId: organization.id, enabled: true },
            select: { moduleKey: true },
            orderBy: { moduleKey: "asc" },
          })
        ).map((module) => module.moduleKey);
    const nextModules = Array.from(
      new Set(
        nextModulesRaw
          .map((module) => (module === "ANALYTICS" ? "FINANCEIRO" : module))
          .filter((module): module is string => typeof module === "string" && module.length > 0),
      ),
    );

    const verifiedOfficialEmail =
      organization && (organization as { officialEmailVerifiedAt?: Date | null })?.officialEmailVerifiedAt
        ? (organization as { officialEmail?: string | null }).officialEmail ?? null
        : null;
    const alertsTarget =
      verifiedOfficialEmail ??
      (typeof alertsEmail === "string" && alertsEmail.trim().length > 0 ? alertsEmail.trim() : organization.alertsEmail);
    const alertsSales = typeof alertsSalesEnabled === "boolean" ? alertsSalesEnabled : organization.alertsSalesEnabled;
    const shouldNotifyAlertsEnabled =
      alertsSalesProvided && alertsSalesEnabled === true && organization.alertsSalesEnabled !== true;
    if (alertsTarget && alertsSales && shouldNotifyAlertsEnabled && resendClient && resendFromEmail) {
      try {
        await resendClient.emails.send({
          from: resendFromEmail,
          to: alertsTarget,
          subject: "Alertas de vendas ORYA ativados",
          text: "Passaste a receber alertas de vendas nesta caixa de email. Se não foste tu, desativa nas definições do organização.",
        });
      } catch (emailErr) {
        console.warn("[alerts] falha ao enviar email de alerta", emailErr);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        organization: {
          primaryModule:
            primaryModule ??
            (organization as { primaryModule?: string | null }).primaryModule ??
            DEFAULT_PRIMARY_MODULE,
          modules: nextModules,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("PATCH /api/organizacao/me error:", err);
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
