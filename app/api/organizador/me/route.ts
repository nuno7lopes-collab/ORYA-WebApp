

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getOrgTransferEnabled, getPlatformFees } from "@/lib/platformSettings";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isValidWebsite } from "@/lib/validation/organization";
import { Resend } from "resend";
import { cookies } from "next/headers";
import {
  DEFAULT_ORGANIZATION_CATEGORY,
  parseOrganizationCategory,
  parseOrganizationModules,
} from "@/lib/organizationCategories";

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
          organizer: null,
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
          organizer: null,
        },
        { status: 404 }
      );
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get("orya_org")?.value;
    const urlOrg = req.nextUrl.searchParams.get("org");
    const forcedOrgId = urlOrg ? Number(urlOrg) : cookieOrgId ? Number(cookieOrgId) : undefined;
    const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
      organizerId: Number.isFinite(forcedOrgId) ? forcedOrgId : undefined,
    });
    const [platformFees, orgTransferEnabled, organizerModules] = await Promise.all([
      getPlatformFees(),
      getOrgTransferEnabled(),
      organizer
        ? prisma.organizationModuleEntry.findMany({
            where: { organizerId: organizer.id, enabled: true },
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

    const organizerPayload = organizer
      ? {
          id: organizer.id,
          username: organizer.username,
          stripeAccountId: organizer.stripeAccountId,
          status: organizer.status,
          stripeChargesEnabled: organizer.stripeChargesEnabled,
          stripePayoutsEnabled: organizer.stripePayoutsEnabled,
          feeMode: organizer.feeMode,
          platformFeeBps: organizer.platformFeeBps,
          platformFeeFixedCents: organizer.platformFeeFixedCents,
          businessName: organizer.businessName,
          entityType: organizer.entityType,
          city: organizer.city,
          payoutIban: organizer.payoutIban,
          language: (organizer as { language?: string | null }).language ?? "pt",
          publicListingEnabled: (organizer as { publicListingEnabled?: boolean | null }).publicListingEnabled ?? true,
          alertsEmail: (organizer as { alertsEmail?: string | null }).alertsEmail ?? null,
          alertsSalesEnabled: (organizer as { alertsSalesEnabled?: boolean | null }).alertsSalesEnabled ?? true,
          alertsPayoutEnabled: (organizer as { alertsPayoutEnabled?: boolean | null }).alertsPayoutEnabled ?? false,
          officialEmail: (organizer as { officialEmail?: string | null }).officialEmail ?? null,
          officialEmailVerifiedAt: (organizer as { officialEmailVerifiedAt?: Date | null }).officialEmailVerifiedAt ?? null,
          brandingAvatarUrl: (organizer as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
          brandingCoverUrl: (organizer as { brandingCoverUrl?: string | null }).brandingCoverUrl ?? null,
          brandingPrimaryColor: (organizer as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
          brandingSecondaryColor: (organizer as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
          organizationKind: (organizer as any).organizationKind ?? "PESSOA_SINGULAR",
          organizationCategory:
            (organizer as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          modules: organizerModules.map((module) => module.moduleKey),
          liveHubPremiumEnabled: organizer.liveHubPremiumEnabled,
          publicName: organizer.publicName,
          address: (organizer as { address?: string | null }).address ?? null,
          showAddressPublicly: (organizer as { showAddressPublicly?: boolean | null }).showAddressPublicly ?? false,
          publicWebsite: (organizer as { publicWebsite?: string | null }).publicWebsite ?? null,
          publicInstagram: (organizer as { publicInstagram?: string | null }).publicInstagram ?? null,
          publicYoutube: (organizer as { publicYoutube?: string | null }).publicYoutube ?? null,
          publicDescription: (organizer as { publicDescription?: string | null }).publicDescription ?? null,
          publicHours: (organizer as { publicHours?: string | null }).publicHours ?? null,
          infoRules: (organizer as { infoRules?: string | null }).infoRules ?? null,
          infoFaq: (organizer as { infoFaq?: string | null }).infoFaq ?? null,
          infoRequirements: (organizer as { infoRequirements?: string | null }).infoRequirements ?? null,
          infoPolicies: (organizer as { infoPolicies?: string | null }).infoPolicies ?? null,
          infoLocationNotes: (organizer as { infoLocationNotes?: string | null }).infoLocationNotes ?? null,
          padelDefaults: {
            shortName: (organizer as any).padelDefaultShortName ?? null,
            city: (organizer as any).padelDefaultCity ?? null,
            address: (organizer as any).padelDefaultAddress ?? null,
            courts: (organizer as any).padelDefaultCourts ?? 0,
            hours: (organizer as any).padelDefaultHours ?? null,
            ruleSetId: (organizer as any).padelDefaultRuleSetId ?? null,
            favoriteCategories: (organizer as any).padelFavoriteCategories ?? [],
          },
        }
      : null;

    const profileStatus =
      organizer &&
      organizer.businessName &&
      organizer.entityType &&
      organizer.city &&
      user.email
        ? "OK"
        : "MISSING_CONTACT";

    const lowerName = (organizer?.publicName ?? organizer?.username ?? "").toLowerCase();
    const isPlatformAccount =
      isAdmin ||
      (organizer as { payoutMode?: string | null })?.payoutMode === "PLATFORM" ||
      organizer?.organizationKind === "EMPRESA_MARCA" ||
      lowerName === "orya" ||
      lowerName.startsWith("orya ");
    const paymentsStatus = organizer
      ? isPlatformAccount
        ? "READY"
        : organizer.stripeAccountId
          ? organizer.stripeChargesEnabled && organizer.stripePayoutsEnabled
            ? "READY"
            : "PENDING"
          : "NO_STRIPE"
      : "NO_STRIPE";

    return NextResponse.json(
      {
        ok: true,
        profile: profilePayload,
        organizer: organizerPayload,
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
    console.error("GET /api/organizador/me error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno.",
        profile: null,
        organizer: null,
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
      publicListingEnabled,
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
    const organizationCategoryRaw = (body as Record<string, unknown>).organizationCategory;
    const modulesRaw = (body as Record<string, unknown>).modules;

    const organizationCategoryProvided = Object.prototype.hasOwnProperty.call(body, "organizationCategory");
    const modulesProvided = Object.prototype.hasOwnProperty.call(body, "modules");
    const premiumProvided = Object.prototype.hasOwnProperty.call(body, "liveHubPremiumEnabled");

    const organizationCategory = organizationCategoryProvided
      ? parseOrganizationCategory(organizationCategoryRaw)
      : null;
    if (organizationCategoryProvided && !organizationCategory) {
      return NextResponse.json(
        { ok: false, error: "organizationCategory inválido. Usa EVENTOS, PADEL ou VOLUNTARIADO." },
        { status: 400 },
      );
    }

    const parsedModules = modulesProvided ? parseOrganizationModules(modulesRaw) : null;
    if (modulesProvided && parsedModules === null) {
      return NextResponse.json(
        { ok: false, error: "modules inválido. Usa uma lista de módulos válidos (ex.: INSCRICOES)." },
        { status: 400 },
      );
    }
    if (premiumProvided) {
      return NextResponse.json(
        { ok: false, error: "O premium é gerido automaticamente pela subscrição." },
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

    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Ainda não és organizador." }, { status: 403 });
    }
    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ ok: false, error: "Apenas o Owner pode alterar estas definições." }, { status: 403 });
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

    const organizerUpdates: Record<string, unknown> = {};
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

    if (businessNameClean !== undefined) organizerUpdates.businessName = businessNameClean || null;
    if (publicNameInput !== undefined) {
      const fallbackPublic =
        businessNameClean ??
        organizer.businessName ??
        organizer.publicName ??
        null;
      organizerUpdates.publicName = publicNameInput || fallbackPublic || null;
    }
    if (addressInput !== undefined) organizerUpdates.address = addressInput || null;
    if (showAddressPubliclyInput !== undefined) organizerUpdates.showAddressPublicly = showAddressPubliclyInput;
    if (typeof publicWebsite === "string") {
      const trimmed = publicWebsite.trim();
      if (!trimmed) {
        organizerUpdates.publicWebsite = null;
      } else {
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        if (!isValidWebsite(normalized)) {
          return NextResponse.json(
            { ok: false, error: "Website inválido. Usa um URL válido (ex: https://orya.pt)." },
            { status: 400 },
          );
        }
        organizerUpdates.publicWebsite = normalized;
      }
    }

    if (typeof publicInstagram === "string") {
      const normalized = normalizeSocialLink(publicInstagram, "instagram");
      if (normalized.error) {
        return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
      }
      organizerUpdates.publicInstagram = normalized.value;
    }
    if (typeof publicYoutube === "string") {
      const normalized = normalizeSocialLink(publicYoutube, "youtube");
      if (normalized.error) {
        return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
      }
      organizerUpdates.publicYoutube = normalized.value;
    }
    if (typeof publicDescription === "string") {
      organizerUpdates.publicDescription = publicDescription.trim() || null;
    }
    if (typeof publicHours === "string") {
      organizerUpdates.publicHours = publicHours.trim() || null;
    }
    if (typeof infoRules === "string") {
      organizerUpdates.infoRules = infoRules.trim() || null;
    }
    if (typeof infoFaq === "string") {
      organizerUpdates.infoFaq = infoFaq.trim() || null;
    }
    if (typeof infoRequirements === "string") {
      organizerUpdates.infoRequirements = infoRequirements.trim() || null;
    }
    if (typeof infoPolicies === "string") {
      organizerUpdates.infoPolicies = infoPolicies.trim() || null;
    }
    if (typeof infoLocationNotes === "string") {
      organizerUpdates.infoLocationNotes = infoLocationNotes.trim() || null;
    }
    if (typeof entityType === "string") organizerUpdates.entityType = entityType.trim() || null;
    if (typeof city === "string") organizerUpdates.city = city.trim() || null;
    if (typeof payoutIban === "string") organizerUpdates.payoutIban = payoutIban.trim() || null;
    if (typeof language === "string") {
      const lang = language.toLowerCase();
      organizerUpdates.language = lang === "en" ? "en" : "pt";
    }
    if (typeof publicListingEnabled === "boolean") organizerUpdates.publicListingEnabled = publicListingEnabled;
    if (typeof alertsEmail === "string") organizerUpdates.alertsEmail = alertsEmail.trim() || null;
    if (typeof alertsSalesEnabled === "boolean") organizerUpdates.alertsSalesEnabled = alertsSalesEnabled;
    if (typeof alertsPayoutEnabled === "boolean") organizerUpdates.alertsPayoutEnabled = alertsPayoutEnabled;
    if (brandingAvatarUrl === null) organizerUpdates.brandingAvatarUrl = null;
    if (typeof brandingAvatarUrl === "string") organizerUpdates.brandingAvatarUrl = brandingAvatarUrl.trim() || null;
    if (brandingCoverUrl === null) organizerUpdates.brandingCoverUrl = null;
    if (typeof brandingCoverUrl === "string") organizerUpdates.brandingCoverUrl = brandingCoverUrl.trim() || null;
    if (typeof brandingPrimaryColor === "string") organizerUpdates.brandingPrimaryColor = brandingPrimaryColor.trim() || null;
    if (typeof brandingSecondaryColor === "string")
      organizerUpdates.brandingSecondaryColor = brandingSecondaryColor.trim() || null;
    if (organizationCategoryProvided && organizationCategory) {
      organizerUpdates.organizationCategory = organizationCategory;
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
      organizerUpdates.organizationKind = kind;
    }
    if (typeof padelDefaultShortName === "string") {
      organizerUpdates.padelDefaultShortName = padelDefaultShortName.trim() || null;
    }
    if (typeof padelDefaultCity === "string") {
      organizerUpdates.padelDefaultCity = padelDefaultCity.trim() || null;
    }
    if (typeof padelDefaultAddress === "string") {
      organizerUpdates.padelDefaultAddress = padelDefaultAddress.trim() || null;
    }
    if (typeof padelDefaultHours === "string") {
      organizerUpdates.padelDefaultHours = padelDefaultHours.trim() || null;
    }
    if (typeof padelDefaultCourts === "number") {
      organizerUpdates.padelDefaultCourts = Math.max(0, Math.floor(padelDefaultCourts));
    }
    if (typeof padelDefaultRuleSetId === "number" && Number.isFinite(padelDefaultRuleSetId)) {
      organizerUpdates.padelDefaultRuleSetId = padelDefaultRuleSetId;
    }
    if (Array.isArray(padelFavoriteCategories)) {
      const nums = padelFavoriteCategories
        .map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null))
        .filter((v): v is number => v !== null);
      organizerUpdates.padelFavoriteCategories = nums;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.profile.update({
        where: { id: user.id },
        data: profileUpdates,
      });
    }

    if (Object.keys(organizerUpdates).length > 0) {
      await prisma.organizer.update({
        where: { id: organizer.id },
        data: organizerUpdates,
      });
    }

    if (modulesProvided) {
      await prisma.organizationModuleEntry.deleteMany({
        where: { organizerId: organizer.id },
      });
      if (parsedModules && parsedModules.length > 0) {
        await prisma.organizationModuleEntry.createMany({
          data: parsedModules.map((moduleKey) => ({
            organizerId: organizer.id,
            moduleKey,
            enabled: true,
          })),
        });
      }
    }

    const nextModules = modulesProvided
      ? parsedModules ?? []
      : (
          await prisma.organizationModuleEntry.findMany({
            where: { organizerId: organizer.id, enabled: true },
            select: { moduleKey: true },
            orderBy: { moduleKey: "asc" },
          })
        ).map((module) => module.moduleKey);

    const verifiedOfficialEmail =
      organizer && (organizer as { officialEmailVerifiedAt?: Date | null })?.officialEmailVerifiedAt
        ? (organizer as { officialEmail?: string | null }).officialEmail ?? null
        : null;
    const alertsTarget =
      verifiedOfficialEmail ??
      (typeof alertsEmail === "string" && alertsEmail.trim().length > 0 ? alertsEmail.trim() : organizer.alertsEmail);
    const alertsSales = typeof alertsSalesEnabled === "boolean" ? alertsSalesEnabled : organizer.alertsSalesEnabled;
    if (alertsTarget && alertsSales && resendClient && resendFromEmail) {
      try {
        await resendClient.emails.send({
          from: resendFromEmail,
          to: alertsTarget,
          subject: "Alertas de vendas ORYA ativados",
          text: "Passaste a receber alertas de vendas nesta caixa de email. Se não foste tu, desativa nas definições do organizador.",
        });
      } catch (emailErr) {
        console.warn("[alerts] falha ao enviar email de alerta", emailErr);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          organizationCategory:
            organizationCategory ??
            (organizer as { organizationCategory?: string | null }).organizationCategory ??
            DEFAULT_ORGANIZATION_CATEGORY,
          modules: nextModules,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("PATCH /api/organizador/me error:", err);
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
