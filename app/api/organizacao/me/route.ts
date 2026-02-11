

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getOrgTransferEnabled, getPlatformFees, getPlatformOfficialEmail } from "@/lib/platformSettings";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { isValidWebsite } from "@/lib/validation/organization";
import { normalizeOrganizationAvatarUrl, normalizeOrganizationCoverUrl } from "@/lib/profileMedia";
import { sendEmail } from "@/lib/emailClient";
import { requireOrganizationIdFromRequest } from "@/lib/organizationId";
import { mergeLayoutWithDefaults, sanitizePublicProfileLayout } from "@/lib/publicProfileLayout";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import {
  DEFAULT_PRIMARY_MODULE,
  parsePrimaryModule,
  parseOrganizationModules,
  type OrganizationModule,
} from "@/lib/organizationCategories";
import { AddressSourceProvider, OrganizationStatus } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";


function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) {
      return respondError(
        ctx,
        {
          errorCode: "UNAUTHENTICATED",
          message: "Não autenticado.",
          retryable: false,
          details: { profile: null, organization: null },
        },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) {
      return respondError(
        ctx,
        {
          errorCode: "NOT_FOUND",
          message: "Perfil não encontrado.",
          retryable: false,
          details: { profile: null, organization: null },
        },
        { status: 404 },
      );
    }

    const orgResult = requireOrganizationIdFromRequest({ req, actorId: user.id });
    if (!orgResult.ok) {
      return orgResult.response;
    }
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: orgResult.organizationId,
      allowFallback: false,
      allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
      includeOrganizationFields: "settings",
    });
    const memberPermissionsModel = (prisma as {
      organizationMemberPermission?: { findMany?: (args: unknown) => Promise<unknown[]> };
    }).organizationMemberPermission;
    const [platformFees, orgTransferEnabled, platformOfficialEmail, organizationAddressRef, organizationModules, memberPermissions] =
      await Promise.all([
        getPlatformFees(),
        getOrgTransferEnabled(),
        getPlatformOfficialEmail(),
        organization?.addressId
          ? prisma.address.findUnique({
              where: { id: organization.addressId },
              select: { formattedAddress: true, canonical: true },
            })
          : Promise.resolve(null),
        organization
          ? prisma.organizationModuleEntry.findMany({
              where: { organizationId: organization.id, enabled: true },
              select: { moduleKey: true },
              orderBy: { moduleKey: "asc" },
            })
          : Promise.resolve([]),
        organization && membership
          ? memberPermissionsModel?.findMany
            ? memberPermissionsModel.findMany({
                where: { organizationId: organization.id, userId: membership.userId },
                select: {
                  moduleKey: true,
                  accessLevel: true,
                  scopeType: true,
                  scopeId: true,
                },
              })
            : Promise.resolve([])
          : Promise.resolve([]),
      ]);

    const profilePayload = {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
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
          addressId: (organization as { addressId?: string | null }).addressId ?? null,
          addressRef: organizationAddressRef,
          showAddressPublicly: (organization as { showAddressPublicly?: boolean | null }).showAddressPublicly ?? false,
          publicWebsite: (organization as { publicWebsite?: string | null }).publicWebsite ?? null,
          publicInstagram: (organization as { publicInstagram?: string | null }).publicInstagram ?? null,
          publicYoutube: (organization as { publicYoutube?: string | null }).publicYoutube ?? null,
          publicDescription: (organization as { publicDescription?: string | null }).publicDescription ?? null,
          publicHours: (organization as { publicHours?: string | null }).publicHours ?? null,
          publicProfileLayout: (organization as { publicProfileLayout?: unknown }).publicProfileLayout ?? null,
          infoRules: (organization as { infoRules?: string | null }).infoRules ?? null,
          infoFaq: (organization as { infoFaq?: string | null }).infoFaq ?? null,
          infoRequirements: (organization as { infoRequirements?: string | null }).infoRequirements ?? null,
          infoPolicies: (organization as { infoPolicies?: string | null }).infoPolicies ?? null,
          infoLocationNotes: (organization as { infoLocationNotes?: string | null }).infoLocationNotes ?? null,
          padelDefaults: {
            shortName: (organization as any).padelDefaultShortName ?? null,
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
      organization.addressId &&
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

    return respondOk(
      ctx,
      {
        profile: profilePayload,
        organization: organizationPayload,
        platformFees,
        orgTransferEnabled,
        platformOfficialEmail,
        contactEmail: user.email,
        profileStatus,
        paymentsStatus,
        paymentsMode: isPlatformAccount ? "PLATFORM" : "CONNECT",
        membershipRole: membership?.role ?? null,
        membershipRolePack: membership?.rolePack ?? null,
        modulePermissions: memberPermissions,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/organizacao/me error:", err);
    return respondError(
      ctx,
      {
        errorCode: "INTERNAL_ERROR",
        message: "Erro interno.",
        retryable: true,
        details: { profile: null, organization: null },
      },
      { status: 500 },
    );
  }
}

async function _PATCH(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user || error) {
      return fail(401, "Não autenticado.");
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return fail(400, "Payload inválido.");
    }

    const {
      businessName,
      entityType,
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
      publicProfileLayout,
      infoRules,
      infoFaq,
      infoRequirements,
      infoPolicies,
      infoLocationNotes,
      addressId,
      showAddressPublicly,
      padelDefaultShortName,
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
    const publicProfileLayoutProvided = Object.prototype.hasOwnProperty.call(body, "publicProfileLayout");
    const alertsSalesProvided = Object.prototype.hasOwnProperty.call(body, "alertsSalesEnabled");

    const primaryModule = primaryModuleProvided
      ? parsePrimaryModule(primaryModuleRaw)
      : null;
    if (primaryModuleProvided && !primaryModule) {
      return fail(400, "primaryModule inválido. Usa EVENTOS, RESERVAS ou TORNEIOS.");
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
      return fail(400, "reservationAssignmentMode inválido. Usa PROFESSIONAL ou RESOURCE.");
    }

    const parsedModules = modulesProvided ? parseOrganizationModules(modulesRaw) : null;
    if (modulesProvided && parsedModules === null) {
      return fail(400, "modules inválido. Usa uma lista de módulos válidos.");
    }

    // Validação de telefone (opcional, mas consistente com checkout)
    if (typeof contactPhone === "string" && contactPhone.trim()) {
      const phoneRaw = contactPhone.trim();
      if (!isValidPhone(phoneRaw)) {
        return fail(400, "Telefone inválido. Usa um número real (podes incluir indicativo, ex.: +351...).");
      }
    }

    const orgResult = requireOrganizationIdFromRequest({ req, actorId: user.id });
    if (!orgResult.ok) {
      return orgResult.response;
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: orgResult.organizationId,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
      allowFallback: false,
      includeOrganizationFields: "settings",
    });

    if (!organization) {
      return fail(403, "Ainda não és organização.");
    }
    if (!membership || !["OWNER", "CO_OWNER", "ADMIN"].includes(membership.role)) {
      return fail(403, "Apenas Owner ou Admin podem alterar estas definições.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "ORG_SETTINGS" });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.errorCode ?? "FORBIDDEN", message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const isOwner = membership.role === "OWNER";
    const isCoOwner = membership.role === "CO_OWNER";
    const isAdmin = membership.role === "ADMIN";

    if (isAdmin) {
      const adminAllowed = new Set([
        "contactPhone",
        "addressId",
        "showAddressPublicly",
        "publicWebsite",
        "publicInstagram",
        "publicYoutube",
        "publicDescription",
        "publicHours",
        "publicProfileLayout",
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
        return fail(403, "Admins apenas podem alterar dados operacionais.");
      }
    }

    const profileUpdates: Record<string, unknown> = {};
    if (typeof fullName === "string") profileUpdates.fullName = fullName.trim() || null;
    if (typeof contactPhone === "string") profileUpdates.contactPhone = normalizePhone(contactPhone.trim()) || null;
    if (typeof alertsEmail === "string" && alertsEmail.trim()) {
      const email = alertsEmail.trim();
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(email)) {
        return fail(400, "Email de alertas inválido.");
      }
    }

    const organizationUpdates: Record<string, unknown> = {};
    const businessNameClean = typeof businessName === "string" ? businessName.trim() : undefined;
    const publicNameInput = typeof publicName === "string" ? publicName.trim() : undefined;
    const addressIdInput = typeof addressId === "string" ? addressId.trim() : undefined;
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
    if (addressIdInput !== undefined) {
      if (!addressIdInput) {
        organizationUpdates.addressId = null;
      } else {
        const resolved = await prisma.address.findUnique({
          where: { id: addressIdInput },
          select: { sourceProvider: true },
        });
        if (!resolved) {
          return fail(400, "Morada inválida.");
        }
        if (resolved.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
          return fail(400, "Morada deve ser Apple Maps.");
        }
        organizationUpdates.addressId = addressIdInput;
      }
    }
    if (showAddressPubliclyInput !== undefined) organizationUpdates.showAddressPublicly = showAddressPubliclyInput;
    if (typeof publicWebsite === "string") {
      const trimmed = publicWebsite.trim();
      if (!trimmed) {
        organizationUpdates.publicWebsite = null;
      } else {
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        if (!isValidWebsite(normalized)) {
          return fail(400, "Website inválido. Usa um URL válido (ex: https://orya.pt).");
        }
        organizationUpdates.publicWebsite = normalized;
      }
    }

    if (typeof publicInstagram === "string") {
      const normalized = normalizeSocialLink(publicInstagram, "instagram");
      if (normalized.error) {
        return fail(400, normalized.error);
      }
      organizationUpdates.publicInstagram = normalized.value;
    }
    if (typeof publicYoutube === "string") {
      const normalized = normalizeSocialLink(publicYoutube, "youtube");
      if (normalized.error) {
        return fail(400, normalized.error);
      }
      organizationUpdates.publicYoutube = normalized.value;
    }
    if (typeof publicDescription === "string") {
      organizationUpdates.publicDescription = publicDescription.trim() || null;
    }
    if (typeof publicHours === "string") {
      organizationUpdates.publicHours = publicHours.trim() || null;
    }
    if (publicProfileLayoutProvided) {
      if (publicProfileLayout === null) {
        organizationUpdates.publicProfileLayout = null;
      } else {
        const sanitizedLayout = sanitizePublicProfileLayout(publicProfileLayout);
        if (!sanitizedLayout) {
          return fail(400, "Layout do perfil inválido.");
        }
        organizationUpdates.publicProfileLayout = mergeLayoutWithDefaults(sanitizedLayout);
      }
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
        return fail(
          400,
          "organizationKind inválido. Usa CLUBE_PADEL, RESTAURANTE, EMPRESA_EVENTOS, ASSOCIACAO ou PESSOA_SINGULAR.",
        );
      }
      organizationUpdates.organizationKind = kind;
    }
    if (typeof padelDefaultShortName === "string") {
      organizationUpdates.padelDefaultShortName = padelDefaultShortName.trim() || null;
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

    let previousModules: string[] | null = null;
    if (modulesProvided) {
      previousModules = (
        await prisma.organizationModuleEntry.findMany({
          where: { organizationId: organization.id, enabled: true },
          select: { moduleKey: true },
          orderBy: { moduleKey: "asc" },
        })
      ).map((module) => module.moduleKey);
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
    type AllowedModule = Exclude<OrganizationModule, "ANALYTICS">;
    const nextModules = Array.from(
      new Set(
        nextModulesRaw
          .map((module) => (module === "ANALYTICS" ? "FINANCEIRO" : module))
          .filter(
            (module): module is AllowedModule =>
              typeof module === "string" && module.length > 0,
          ),
      ),
    );

    if (modulesProvided) {
      await recordOrganizationAuditSafe({
        organizationId: organization.id,
        actorUserId: user.id,
        action: "MODULES_UPDATED",
        metadata: { previousModules, nextModules },
      });
    }

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
    if (alertsTarget && alertsSales && shouldNotifyAlertsEnabled) {
      try {
        await sendEmail({
          to: alertsTarget,
          subject: "Alertas de vendas ORYA ativados",
          text: "Passaste a receber alertas de vendas nesta caixa de email. Se não foste tu, desativa nas definições do organização.",
        });
      } catch (emailErr) {
        console.warn("[alerts] falha ao enviar email de alerta", emailErr);
      }
    }

    return respondOk(ctx, { organization: {
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
    return fail(500, "Erro interno.");
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
