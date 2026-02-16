import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  BookingChargeKind,
  BookingChargePayerKind,
  BookingChargeStatus,
  BookingParticipantStatus,
  BookingStatus,
  ChatConversationContextType,
  ChatConversationMemberRole,
  ChatConversationMessageKind,
  ChatConversationType,
  ChatMemberDisplayAs,
  CrmContactType,
  CrmInteractionSource,
  CrmInteractionType,
  OrganizationMemberRole,
  OrganizationModule,
  OrganizationPermissionLevel,
  PadelPairingJoinMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelPaymentMode,
  PromoType,
  ReservationAssignmentMode,
  ServiceKind,
  StoreInventoryMovementType,
  StoreOrderStatus,
  StoreShipmentStatus,
  TournamentEntryRole,
  TournamentEntryStatus,
  PrismaClient,
  padel_match_status,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const loadEnvFile = (file: string) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL ou DIRECT_URL.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const now = new Date();
const requestedUsername = (process.env.TOP_PADEL_FULL_ORG_USERNAME ?? "top_padel").trim().toLowerCase();
const candidateUsernames = Array.from(new Set([requestedUsername, "top_padel", "top-padel", "toppadel"]));
const seedTag = (process.env.TOP_PADEL_FULL_SEED_TAG ?? "top_padel_full_v1")
  .toLowerCase()
  .replace(/[^a-z0-9_]+/g, "_")
  .replace(/^_+|_+$/g, "");

const seedPrefix = `[SEED_TOP_PADEL_${seedTag}]`;
const servicePrefix = `${seedPrefix} SERVICE`;
const professionalPrefix = `${seedPrefix} PRO`;
const resourcePrefix = `${seedPrefix} RESOURCE`;
const bookingIntentPrefix = `${seedTag}_booking_pi_`;
const bookingChargeTokenPrefix = `${seedTag}_booking_charge_`;
const orderNumberPrefix = `TPFULL-${seedTag.toUpperCase()}-`;
const storePurchasePrefix = `${seedTag}_store_purchase_`;
const tournamentPurchasePrefix = `${seedTag}_tournament_purchase_`;
const pairTokenPrefix = `${seedTag}_pair_`;
const promoCodePrefix = `TPFULL${seedTag.replace(/_/g, "").slice(-6).toUpperCase()}`;
const conversationPrefix = `${seedPrefix} CHAT`;
const messageClientPrefix = `${seedTag}:msg:`;
const crmSourceType = "SEED_TOP_PADEL_FULL";
const crmInteractionPrefix = `${seedTag}:crm:`;
const matchRoundPrefix = `${seedPrefix} ROUND`;
const clubSlug = `${requestedUsername}-${seedTag}-club`;

type BasicProfile = { id: string; username: string | null; fullName: string | null; createdAt: Date };

function daysAgo(days: number, hour = 12) {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function daysFromNow(days: number, hour = 12) {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function ensureOrganization() {
  const whereOr = candidateUsernames.map((username) => ({
    username: { equals: username, mode: "insensitive" as const },
  }));
  const organization = await prisma.organization.findFirst({
    where: { OR: whereOr },
    select: {
      id: true,
      groupId: true,
      username: true,
      publicName: true,
      addressId: true,
    },
  });
  if (!organization) {
    throw new Error("Organizacao top_padel nao encontrada. Corre primeiro os seeds base.");
  }
  return organization;
}

async function ensureModules(organizationId: number) {
  const modules: OrganizationModule[] = [
    OrganizationModule.EVENTOS,
    OrganizationModule.RESERVAS,
    OrganizationModule.TORNEIOS,
    OrganizationModule.STAFF,
    OrganizationModule.FINANCEIRO,
    OrganizationModule.MENSAGENS,
    OrganizationModule.CRM,
    OrganizationModule.MARKETING,
    OrganizationModule.LOJA,
    OrganizationModule.ANALYTICS,
    OrganizationModule.PERFIL_PUBLICO,
    OrganizationModule.DEFINICOES,
  ];
  for (const moduleKey of modules) {
    await prisma.organizationModuleEntry.upsert({
      where: { organizationId_moduleKey: { organizationId, moduleKey } },
      update: { enabled: true },
      create: { organizationId, moduleKey, enabled: true },
    });
  }
  return modules;
}

async function ensureOrganizationAddress(organizationId: number, currentAddressId: string | null) {
  if (currentAddressId) return currentAddressId;

  const existing = await prisma.address.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing?.id) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { addressId: existing.id },
    });
    return existing.id;
  }

  const fallbackFormatted = "Rua do Padel 10, Lisboa, Portugal";
  const fallbackAddress = await prisma.address.create({
    data: {
      formattedAddress: fallbackFormatted,
      canonical: {
        line1: "Rua do Padel 10",
        city: "Lisboa",
        country: "PT",
        postalCode: "1000-100",
      },
      latitude: 38.736946,
      longitude: -9.142685,
      sourceProvider: "APPLE_MAPS",
      sourceProviderPlaceId: `${seedTag}-fallback-place`,
      confidenceScore: 95,
      validationStatus: "NORMALIZED",
      addressHash: createHash("sha256").update(`${seedTag}:${fallbackFormatted}`).digest("hex"),
    },
    select: { id: true },
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { addressId: fallbackAddress.id },
  });
  return fallbackAddress.id;
}

async function resolveProfiles(groupId: number) {
  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: { ownerUserId: true },
  });
  if (!group) throw new Error("OrganizationGroup nao encontrado.");

  const allProfiles = await prisma.profile.findMany({
    where: { isDeleted: false },
    orderBy: [{ createdAt: "asc" }],
    take: 200,
    select: { id: true, username: true, fullName: true, createdAt: true },
  });
  if (!allProfiles.length) {
    throw new Error("Nao existem perfis para seed.");
  }

  const owner =
    allProfiles.find((p) => p.id === group.ownerUserId) ??
    (await prisma.profile.findUnique({
      where: { id: group.ownerUserId },
      select: { id: true, username: true, fullName: true, createdAt: true },
    }));
  if (!owner) throw new Error("Owner profile nao encontrado.");

  const unique = new Map<string, BasicProfile>();
  unique.set(owner.id, owner);
  for (const profile of allProfiles) unique.set(profile.id, profile);
  const ordered = Array.from(unique.values());

  const staff = ordered.slice(0, Math.min(6, ordered.length));
  let customers = ordered.slice(staff.length, staff.length + 24);
  if (customers.length < 12) {
    const fallback = ordered.filter((p) => !staff.some((s) => s.id === p.id));
    customers = Array.from(new Map([...customers, ...fallback].map((p) => [p.id, p])).values()).slice(0, 24);
  }
  if (customers.length < 4) {
    throw new Error("Perfis insuficientes para criar dados de clientes.");
  }

  return { owner, staff, customers };
}

function permissionForRole(role: OrganizationMemberRole, moduleKey: OrganizationModule): OrganizationPermissionLevel {
  const fullEditModules = new Set<OrganizationModule>([
    OrganizationModule.EVENTOS,
    OrganizationModule.RESERVAS,
    OrganizationModule.TORNEIOS,
    OrganizationModule.STAFF,
    OrganizationModule.FINANCEIRO,
    OrganizationModule.MENSAGENS,
    OrganizationModule.CRM,
    OrganizationModule.MARKETING,
    OrganizationModule.LOJA,
    OrganizationModule.ANALYTICS,
    OrganizationModule.DEFINICOES,
    OrganizationModule.PERFIL_PUBLICO,
  ]);

  if (role === OrganizationMemberRole.OWNER || role === OrganizationMemberRole.CO_OWNER) {
    return OrganizationPermissionLevel.EDIT;
  }

  if (role === OrganizationMemberRole.ADMIN) {
    return fullEditModules.has(moduleKey) ? OrganizationPermissionLevel.EDIT : OrganizationPermissionLevel.VIEW;
  }

  if (role === OrganizationMemberRole.PROMOTER) {
    if (
      moduleKey === OrganizationModule.EVENTOS ||
      moduleKey === OrganizationModule.MARKETING ||
      moduleKey === OrganizationModule.CRM ||
      moduleKey === OrganizationModule.MENSAGENS ||
      moduleKey === OrganizationModule.PERFIL_PUBLICO
    ) {
      return OrganizationPermissionLevel.EDIT;
    }
    if (moduleKey === OrganizationModule.FINANCEIRO || moduleKey === OrganizationModule.ANALYTICS) {
      return OrganizationPermissionLevel.NONE;
    }
    return OrganizationPermissionLevel.VIEW;
  }

  if (
    moduleKey === OrganizationModule.RESERVAS ||
    moduleKey === OrganizationModule.STAFF ||
    moduleKey === OrganizationModule.MENSAGENS
  ) {
    return OrganizationPermissionLevel.EDIT;
  }
  if (moduleKey === OrganizationModule.FINANCEIRO || moduleKey === OrganizationModule.ANALYTICS) {
    return OrganizationPermissionLevel.VIEW;
  }
  return OrganizationPermissionLevel.VIEW;
}

async function ensureStaffMembershipAndPermissions(params: {
  organizationId: number;
  groupId: number;
  staff: BasicProfile[];
  modules: OrganizationModule[];
}) {
  const { organizationId, groupId, staff, modules } = params;
  const roleByIndex: OrganizationMemberRole[] = [
    OrganizationMemberRole.OWNER,
    OrganizationMemberRole.CO_OWNER,
    OrganizationMemberRole.ADMIN,
    OrganizationMemberRole.STAFF,
    OrganizationMemberRole.STAFF,
    OrganizationMemberRole.PROMOTER,
  ];

  for (let i = 0; i < staff.length; i += 1) {
    const profile = staff[i]!;
    const role = roleByIndex[i] ?? OrganizationMemberRole.STAFF;
    await prisma.organizationGroupMember.upsert({
      where: { groupId_userId: { groupId, userId: profile.id } },
      update: {
        role,
        scopeAllOrgs: role === OrganizationMemberRole.OWNER,
        scopeOrgIds: role === OrganizationMemberRole.OWNER ? [] : [organizationId],
      },
      create: {
        groupId,
        userId: profile.id,
        role,
        scopeAllOrgs: role === OrganizationMemberRole.OWNER,
        scopeOrgIds: [organizationId],
      },
    });

    await prisma.organizationMemberPermission.deleteMany({
      where: {
        organizationId,
        userId: profile.id,
        moduleKey: { in: modules },
        scopeType: null,
        scopeId: null,
      },
    });

    await prisma.organizationMemberPermission.createMany({
      data: modules.map((moduleKey) => ({
        organizationId,
        userId: profile.id,
        moduleKey,
        accessLevel: permissionForRole(role, moduleKey),
        scopeType: null,
        scopeId: null,
      })),
    });
  }
}

async function cleanupSeedArtifacts(organizationId: number) {
  await prisma.chatConversation.deleteMany({
    where: {
      organizationId,
      title: { startsWith: conversationPrefix },
    },
  });

  await prisma.crmInteraction.deleteMany({
    where: {
      organizationId,
      externalId: { startsWith: crmInteractionPrefix },
    },
  });

  await prisma.promoCode.deleteMany({
    where: {
      organizationId,
      code: { startsWith: promoCodePrefix },
    },
  });

  await prisma.storeOrder.deleteMany({
    where: {
      store: { ownerOrganizationId: organizationId },
      orderNumber: { startsWith: orderNumberPrefix },
    },
  });

  await prisma.storeInventoryMovement.deleteMany({
    where: { reason: { startsWith: `${seedTag}:order:` } },
  });

  await prisma.tournamentEntry.deleteMany({
    where: { purchaseId: { startsWith: tournamentPurchasePrefix } },
  });

  const pairings = await prisma.padelPairing.findMany({
    where: {
      organizationId,
      partnerLinkToken: { startsWith: pairTokenPrefix },
    },
    select: { id: true },
  });
  const pairingIds = pairings.map((p) => p.id);
  if (pairingIds.length) {
    await prisma.eventMatchSlot.deleteMany({
      where: {
        OR: [{ pairingAId: { in: pairingIds } }, { pairingBId: { in: pairingIds } }, { winnerPairingId: { in: pairingIds } }],
      },
    });
  }

  await prisma.eventMatchSlot.deleteMany({
    where: {
      event: { organizationId },
      roundLabel: { startsWith: matchRoundPrefix },
    },
  });

  await prisma.padelPairing.deleteMany({
    where: {
      organizationId,
      partnerLinkToken: { startsWith: pairTokenPrefix },
    },
  });

  await prisma.booking.deleteMany({
    where: {
      organizationId,
      paymentIntentId: { startsWith: bookingIntentPrefix },
    },
  });

  await prisma.agendaItem.deleteMany({
    where: {
      organizationId,
      sourceType: "BOOKING",
      sourceId: { startsWith: `${seedTag}:booking:` },
    },
  });

  await prisma.service.deleteMany({
    where: {
      organizationId,
      title: { startsWith: servicePrefix },
    },
  });

  await prisma.reservationProfessional.deleteMany({
    where: {
      organizationId,
      name: { startsWith: professionalPrefix },
    },
  });

  await prisma.reservationResource.deleteMany({
    where: {
      organizationId,
      label: { startsWith: resourcePrefix },
    },
  });
}

async function ensureClubAndCourts(params: { organizationId: number; addressId: string; staff: BasicProfile[] }) {
  const { organizationId, addressId, staff } = params;
  const club = await prisma.padelClub.upsert({
    where: { slug: clubSlug },
    update: {
      organizationId,
      name: "Top Padel Club Central",
      shortName: "TPC",
      addressId,
      courtsCount: 4,
      hours: "07:00-23:00",
      isActive: true,
      isDefault: true,
    },
    create: {
      organizationId,
      slug: clubSlug,
      name: "Top Padel Club Central",
      shortName: "TPC",
      addressId,
      courtsCount: 4,
      hours: "07:00-23:00",
      isActive: true,
      isDefault: true,
    },
    select: { id: true },
  });

  const courtNames = ["Campo 1 Indoor", "Campo 2 Indoor", "Campo 3 Outdoor", "Campo 4 Outdoor"];
  const courts: Array<{ id: number; name: string }> = [];
  for (let i = 0; i < courtNames.length; i += 1) {
    const name = courtNames[i]!;
    const existing = await prisma.padelClubCourt.findFirst({
      where: { padelClubId: club.id, name },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const court = existing
      ? await prisma.padelClubCourt.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            description: `${seedPrefix} court`,
            displayOrder: i,
            surface: i < 2 ? "Mondo" : "Relva sintetica",
            indoor: i < 2,
          },
          select: { id: true, name: true },
        })
      : await prisma.padelClubCourt.create({
          data: {
            padelClubId: club.id,
            name,
            description: `${seedPrefix} court`,
            displayOrder: i,
            surface: i < 2 ? "Mondo" : "Relva sintetica",
            indoor: i < 2,
            isActive: true,
          },
          select: { id: true, name: true },
        });
    courts.push(court);
  }

  for (const user of staff.slice(0, 4)) {
    const existing = await prisma.padelClubStaff.findFirst({
      where: { padelClubId: club.id, userId: user.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.padelClubStaff.update({
        where: { id: existing.id },
        data: { role: "STAFF", isActive: true, inheritToEvents: true },
      });
    } else {
      await prisma.padelClubStaff.create({
        data: {
          padelClubId: club.id,
          userId: user.id,
          role: "STAFF",
          isActive: true,
          inheritToEvents: true,
        },
      });
    }
  }

  return { clubId: club.id, courts };
}

async function ensureProfessionalsResourcesServices(params: {
  organizationId: number;
  addressId: string;
  staff: BasicProfile[];
}) {
  const { organizationId, addressId, staff } = params;

  const professionalDefs = [
    { name: `${professionalPrefix} Ricardo Coach`, roleTitle: "Head Coach", userId: staff[1]?.id ?? null },
    { name: `${professionalPrefix} Marta Trainer`, roleTitle: "Trainer", userId: staff[2]?.id ?? null },
    { name: `${professionalPrefix} Ines Pro`, roleTitle: "Padel Pro", userId: staff[3]?.id ?? null },
  ];
  const professionals: Array<{ id: number; name: string }> = [];
  for (const def of professionalDefs) {
    const existing = await prisma.reservationProfessional.findFirst({
      where: { organizationId, name: def.name },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const professional = existing
      ? await prisma.reservationProfessional.update({
          where: { id: existing.id },
          data: {
            userId: def.userId,
            roleTitle: def.roleTitle,
            isActive: true,
          },
          select: { id: true, name: true },
        })
      : await prisma.reservationProfessional.create({
          data: {
            organizationId,
            userId: def.userId,
            name: def.name,
            roleTitle: def.roleTitle,
            isActive: true,
          },
          select: { id: true, name: true },
        });
    professionals.push(professional);

    if (def.userId) {
      await prisma.trainerProfile.upsert({
        where: {
          organizationId_userId: {
            organizationId,
            userId: def.userId,
          },
        },
        update: {
          title: def.roleTitle,
          bio: `${seedPrefix} trainer profile`,
          isPublished: true,
          reviewStatus: "APPROVED",
          coverImageUrl: "/covers/library/padel/01-padel-court.jpg",
        },
        create: {
          organizationId,
          userId: def.userId,
          title: def.roleTitle,
          bio: `${seedPrefix} trainer profile`,
          specialties: ["padel", "tecnica", "competicao"],
          isPublished: true,
          reviewStatus: "APPROVED",
          reviewedAt: now,
          coverImageUrl: "/covers/library/padel/01-padel-court.jpg",
        },
      });
    }
  }

  const resourceDefs = [
    { label: `${resourcePrefix} Court-1`, capacity: 4, priority: 1 },
    { label: `${resourcePrefix} Court-2`, capacity: 4, priority: 2 },
    { label: `${resourcePrefix} Video-Room`, capacity: 2, priority: 3 },
  ];
  const resources: Array<{ id: number; label: string }> = [];
  for (const def of resourceDefs) {
    const existing = await prisma.reservationResource.findFirst({
      where: { organizationId, label: def.label },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const resource = existing
      ? await prisma.reservationResource.update({
          where: { id: existing.id },
          data: { isActive: true, capacity: def.capacity, priority: def.priority },
          select: { id: true, label: true },
        })
      : await prisma.reservationResource.create({
          data: {
            organizationId,
            label: def.label,
            capacity: def.capacity,
            priority: def.priority,
            isActive: true,
          },
          select: { id: true, label: true },
        });
    resources.push(resource);
  }

  const serviceDefs = [
    {
      key: "court_90",
      title: `${servicePrefix} Aluguer Court 90`,
      description: "Reserva de campo com apoio tecnico.",
      kind: ServiceKind.COURT,
      durationMinutes: 90,
      unitPriceCents: 2800,
      categoryTag: "court",
    },
    {
      key: "class_60",
      title: `${servicePrefix} Aula Particular 60`,
      description: "Aula individual para melhoria de tecnica.",
      kind: ServiceKind.CLASS,
      durationMinutes: 60,
      unitPriceCents: 4200,
      categoryTag: "class",
    },
    {
      key: "analysis_45",
      title: `${servicePrefix} Match Analysis 45`,
      description: "Analise de jogo em video com plano de treino.",
      kind: ServiceKind.GENERAL,
      durationMinutes: 45,
      unitPriceCents: 3500,
      categoryTag: "analysis",
    },
  ];

  const services: Array<{ id: number; title: string; durationMinutes: number; unitPriceCents: number; kind: ServiceKind }> = [];
  for (const def of serviceDefs) {
    const existing = await prisma.service.findFirst({
      where: { organizationId, title: def.title },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const service = existing
      ? await prisma.service.update({
          where: { id: existing.id },
          data: {
            kind: def.kind,
            title: def.title,
            description: def.description,
            durationMinutes: def.durationMinutes,
            unitPriceCents: def.unitPriceCents,
            currency: "EUR",
            isActive: true,
            categoryTag: def.categoryTag,
            locationMode: "FIXED",
            addressId,
          },
          select: { id: true, title: true, durationMinutes: true, unitPriceCents: true, kind: true },
        })
      : await prisma.service.create({
          data: {
            organizationId,
            kind: def.kind,
            title: def.title,
            description: def.description,
            durationMinutes: def.durationMinutes,
            unitPriceCents: def.unitPriceCents,
            currency: "EUR",
            isActive: true,
            categoryTag: def.categoryTag,
            locationMode: "FIXED",
            addressId,
            instructorId: professionals[0]?.id && professionalDefs[0]?.userId ? professionalDefs[0]!.userId : null,
          },
          select: { id: true, title: true, durationMinutes: true, unitPriceCents: true, kind: true },
        });
    services.push(service);

    await prisma.serviceProfessionalLink.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceResourceLink.deleteMany({ where: { serviceId: service.id } });
    await prisma.servicePack.deleteMany({ where: { serviceId: service.id } });
    await prisma.servicePackage.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceAddon.deleteMany({ where: { serviceId: service.id } });

    const professionalIds = professionals.map((p) => p.id);
    const resourceIds = resources.map((r) => r.id);

    await prisma.serviceProfessionalLink.createMany({
      data: professionalIds.map((professionalId) => ({ serviceId: service.id, professionalId })),
      skipDuplicates: true,
    });
    await prisma.serviceResourceLink.createMany({
      data: resourceIds.map((resourceId) => ({ serviceId: service.id, resourceId })),
      skipDuplicates: true,
    });

    await prisma.servicePack.createMany({
      data: [
        { serviceId: service.id, quantity: 5, packPriceCents: Math.max(1000, service.unitPriceCents * 4), label: "Pack 5", recommended: true },
        { serviceId: service.id, quantity: 10, packPriceCents: Math.max(2000, service.unitPriceCents * 7), label: "Pack 10", recommended: false },
      ],
    });

    await prisma.servicePackage.createMany({
      data: [
        {
          serviceId: service.id,
          label: "Standard",
          durationMinutes: service.durationMinutes,
          priceCents: service.unitPriceCents,
          recommended: true,
          sortOrder: 1,
        },
        {
          serviceId: service.id,
          label: "Extended",
          durationMinutes: service.durationMinutes + 30,
          priceCents: service.unitPriceCents + 900,
          recommended: false,
          sortOrder: 2,
        },
      ],
    });

    await prisma.serviceAddon.createMany({
      data: [
        {
          serviceId: service.id,
          label: "Bolas Premium",
          deltaMinutes: 0,
          deltaPriceCents: 300,
          category: "equipment",
          sortOrder: 1,
        },
        {
          serviceId: service.id,
          label: "Video Highlights",
          deltaMinutes: 15,
          deltaPriceCents: 800,
          category: "analysis",
          sortOrder: 2,
        },
      ],
    });
  }

  return { professionals, resources, services };
}

async function seedBookings(params: {
  organizationId: number;
  ownerUserId: string;
  customers: BasicProfile[];
  professionals: Array<{ id: number }>;
  resources: Array<{ id: number }>;
  services: Array<{ id: number; title: string; durationMinutes: number; unitPriceCents: number; kind: ServiceKind }>;
  courts: Array<{ id: number; name: string }>;
  clubId: number;
}) {
  const { organizationId, ownerUserId, customers, professionals, resources, services, courts, clubId } = params;
  const statusCycle: BookingStatus[] = [
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED_BY_CLIENT,
    BookingStatus.NO_SHOW,
    BookingStatus.PENDING_CONFIRMATION,
    BookingStatus.CONFIRMED,
    BookingStatus.DISPUTED,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED_BY_ORG,
    BookingStatus.CONFIRMED,
    BookingStatus.PENDING,
  ];

  const bookings: Array<{ id: number; userId: string | null; status: BookingStatus; price: number; startsAt: Date }> = [];

  for (let i = 0; i < statusCycle.length; i += 1) {
    const status = statusCycle[i]!;
    const customer = customers[i % customers.length]!;
    const service = services[i % services.length]!;
    const professional = professionals[i % professionals.length];
    const resource = resources[i % resources.length];
    const court = courts[i % courts.length];

    const startsAt = i < 8 ? daysAgo(26 - i * 2, 18 + (i % 2)) : daysFromNow(2 + (i - 8) * 2, 18 + (i % 2));
    const durationMinutes = service.durationMinutes;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    const bookingPrice = service.unitPriceCents + (i % 3) * 200;
    const paymentIntentId = `${bookingIntentPrefix}${String(i + 1).padStart(3, "0")}`;

    const booking = await prisma.booking.create({
      data: {
        organizationId,
        serviceId: service.id,
        userId: customer.id,
        assignmentMode: ReservationAssignmentMode.PROFESSIONAL,
        professionalId: professional?.id ?? null,
        resourceId: resource?.id ?? null,
        courtId: court?.id ?? null,
        partySize: service.kind === ServiceKind.COURT ? 4 : 1,
        startsAt,
        durationMinutes,
        price: bookingPrice,
        currency: "EUR",
        status,
        paymentIntentId,
        pendingExpiresAt:
          status === BookingStatus.PENDING_CONFIRMATION || status === BookingStatus.PENDING
            ? new Date(startsAt.getTime() - 2 * 60 * 60 * 1000)
            : null,
        snapshotTimezone: "Europe/Lisbon",
        locationMode: "FIXED",
      },
      select: { id: true, userId: true, status: true, price: true, startsAt: true },
    });
    bookings.push(booking);

    const partner = customers[(i + 5) % customers.length];
    await prisma.bookingParticipant.createMany({
      data: [
          {
            bookingId: booking.id,
            userId: customer.id,
            name: customer.fullName ?? customer.username ?? "Cliente",
            status: BookingParticipantStatus.CONFIRMED,
          },
        ...(partner
          ? [
              {
                bookingId: booking.id,
                userId: partner.id,
                name: partner.fullName ?? partner.username ?? "Parceiro",
                status:
                  status === BookingStatus.CANCELLED_BY_CLIENT
                    ? BookingParticipantStatus.CANCELLED
                    : BookingParticipantStatus.CONFIRMED,
              },
            ]
          : []),
      ],
    });

    const chargeStatus =
      status === BookingStatus.CANCELLED_BY_CLIENT || status === BookingStatus.CANCELLED_BY_ORG
        ? BookingChargeStatus.CANCELLED
        : status === BookingStatus.PENDING || status === BookingStatus.PENDING_CONFIRMATION
          ? BookingChargeStatus.OPEN
          : BookingChargeStatus.PAID;
    await prisma.bookingCharge.create({
      data: {
        bookingId: booking.id,
        organizationId,
        createdByUserId: ownerUserId,
        token: `${bookingChargeTokenPrefix}${String(i + 1).padStart(3, "0")}`,
        kind: BookingChargeKind.BASE,
        payerKind: BookingChargePayerKind.ORGANIZER,
        status: chargeStatus,
        label: `${seedPrefix} booking charge`,
        amountCents: bookingPrice,
        currency: "EUR",
        paymentIntentId,
        paymentId: `${seedTag}_booking_payment_${String(i + 1).padStart(3, "0")}`,
        paidAt: chargeStatus === BookingChargeStatus.PAID ? new Date(startsAt.getTime() - 30 * 60 * 1000) : null,
      },
    });

    await prisma.agendaItem.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId,
          sourceType: "BOOKING",
          sourceId: `${seedTag}:booking:${booking.id}`,
        },
      },
      update: {
        padelClubId: clubId,
        courtId: court?.id ?? null,
        resourceId: resource?.id ?? null,
        professionalId: professional?.id ?? null,
        title: `${seedPrefix} Booking ${service.title}`,
        startsAt,
        endsAt,
        status: status === BookingStatus.CANCELLED_BY_CLIENT || status === BookingStatus.CANCELLED_BY_ORG ? "CANCELLED" : "ACTIVE",
        updatedAt: new Date(),
        lastEventId: randomUUID(),
      },
      create: {
        organizationId,
        sourceType: "BOOKING",
        sourceId: `${seedTag}:booking:${booking.id}`,
        padelClubId: clubId,
        courtId: court?.id ?? null,
        resourceId: resource?.id ?? null,
        professionalId: professional?.id ?? null,
        title: `${seedPrefix} Booking ${service.title}`,
        startsAt,
        endsAt,
        status: status === BookingStatus.CANCELLED_BY_CLIENT || status === BookingStatus.CANCELLED_BY_ORG ? "CANCELLED" : "ACTIVE",
        updatedAt: new Date(),
        lastEventId: randomUUID(),
      },
    });
  }

  return bookings;
}

async function seedStoreOrders(params: {
  organizationId: number;
  customers: BasicProfile[];
}) {
  const { organizationId, customers } = params;
  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organizationId },
    select: { id: true },
  });
  if (!store) {
    throw new Error("Loja top_padel nao encontrada. Corre seed:store:top-padel.");
  }

  const products = await prisma.storeProduct.findMany({
    where: { storeId: store.id },
    orderBy: [{ id: "asc" }],
    select: { id: true, name: true, sku: true, priceCents: true, requiresShipping: true },
  });
  if (!products.length) {
    throw new Error("Loja sem produtos. Corre seed:store:top-padel.");
  }

  const statusCycle: StoreOrderStatus[] = [
    StoreOrderStatus.PAID,
    StoreOrderStatus.FULFILLED,
    StoreOrderStatus.PENDING,
    StoreOrderStatus.PAID,
    StoreOrderStatus.FULFILLED,
    StoreOrderStatus.CANCELLED,
    StoreOrderStatus.REFUNDED,
    StoreOrderStatus.PAID,
    StoreOrderStatus.FULFILLED,
    StoreOrderStatus.PAID,
    StoreOrderStatus.PARTIAL_REFUND,
    StoreOrderStatus.PENDING,
  ];

  const orders: Array<{ id: number; userId: string | null; status: StoreOrderStatus; totalCents: number; purchaseId: string | null }> = [];

  for (let i = 0; i < statusCycle.length; i += 1) {
    const status = statusCycle[i]!;
    const customer = customers[i % customers.length]!;
    const orderNumber = `${orderNumberPrefix}${String(i + 1).padStart(4, "0")}`;
    const purchaseId = `${storePurchasePrefix}${String(i + 1).padStart(4, "0")}`;
    const paymentIntentId = `${purchaseId}_pi`;
    const productA = products[i % products.length]!;
    const productB = products[(i + 1) % products.length]!;
    const qtyA = 1 + (i % 2);
    const qtyB = i % 3 === 0 ? 2 : 1;
    const lineA = productA.priceCents * qtyA;
    const lineB = productB.priceCents * qtyB;
    const subtotalCents = lineA + lineB;
    const discountCents = i % 4 === 0 ? 300 : 0;
    const shippingCents = i % 5 === 0 ? 0 : 490;
    const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

    const order = await prisma.storeOrder.create({
      data: {
        storeId: store.id,
        userId: customer.id,
        orderNumber,
        status,
        paymentIntentId,
        purchaseId,
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        currency: "EUR",
        customerEmail: `${customer.username ?? "cliente"}@seed-top-padel.test`,
        customerName: customer.fullName ?? customer.username ?? "Cliente Top Padel",
        customerPhone: "+351910000000",
        notes: `${seedPrefix} order`,
      },
      select: { id: true, userId: true, status: true, totalCents: true, purchaseId: true },
    });
    orders.push(order);

    await prisma.storeOrderLine.createMany({
      data: [
        {
          orderId: order.id,
          productId: productA.id,
          nameSnapshot: productA.name,
          skuSnapshot: productA.sku,
          quantity: qtyA,
          unitPriceCents: productA.priceCents,
          discountCents: i % 4 === 0 ? 200 : 0,
          totalCents: lineA - (i % 4 === 0 ? 200 : 0),
          requiresShipping: productA.requiresShipping,
          personalization: {},
        },
        {
          orderId: order.id,
          productId: productB.id,
          nameSnapshot: productB.name,
          skuSnapshot: productB.sku,
          quantity: qtyB,
          unitPriceCents: productB.priceCents,
          discountCents: i % 4 === 0 ? 100 : 0,
          totalCents: lineB - (i % 4 === 0 ? 100 : 0),
          requiresShipping: productB.requiresShipping,
          personalization: {},
        },
      ],
    });

    if (status === StoreOrderStatus.FULFILLED) {
      await prisma.storeShipment.create({
        data: {
          orderId: order.id,
          carrier: "CTT Expresso",
          trackingNumber: `${seedTag.toUpperCase()}-${String(i + 1).padStart(8, "0")}`,
          trackingUrl: "https://tracking.ctt.pt/demo",
          status: StoreShipmentStatus.DELIVERED,
          shippedAt: daysAgo(7 - (i % 3), 10),
          deliveredAt: daysAgo(4 - (i % 2), 14),
        },
      });
    } else if (status === StoreOrderStatus.PAID) {
      await prisma.storeShipment.create({
        data: {
          orderId: order.id,
          carrier: "CTT Expresso",
          trackingNumber: `${seedTag.toUpperCase()}-P-${String(i + 1).padStart(8, "0")}`,
          trackingUrl: "https://tracking.ctt.pt/demo",
          status: StoreShipmentStatus.SHIPPED,
          shippedAt: daysAgo(2, 10),
        },
      });
    }

    if (status === StoreOrderStatus.PAID || status === StoreOrderStatus.FULFILLED || status === StoreOrderStatus.PARTIAL_REFUND) {
      await prisma.storeInventoryMovement.createMany({
        data: [
          {
            productId: productA.id,
            movementType: StoreInventoryMovementType.SALE,
            quantity: -qtyA,
            reason: `${seedTag}:order:${orderNumber}`,
          },
          {
            productId: productB.id,
            movementType: StoreInventoryMovementType.SALE,
            quantity: -qtyB,
            reason: `${seedTag}:order:${orderNumber}`,
          },
        ],
      });
    }
  }

  return orders;
}

async function seedPadelPairingsAndMatches(params: {
  organizationId: number;
  ownerUserId: string;
  customers: BasicProfile[];
  courts: Array<{ id: number; name: string }>;
}) {
  const { organizationId, ownerUserId, customers, courts } = params;

  const targetEvent = await prisma.event.findFirst({
    where: {
      organizationId,
      OR: [{ tournament: { isNot: null } }, { templateType: "PADEL" }],
    },
    orderBy: [{ startsAt: "asc" }],
    select: { id: true, title: true },
  });
  if (!targetEvent) {
    return { pairings: [] as Array<{ id: number }>, matches: 0, eventId: null as number | null };
  }

  const maxPairings = Math.min(8, Math.floor(customers.length / 2));
  const pairings: Array<{ id: number; player1: string; player2: string }> = [];
  for (let i = 0; i < maxPairings; i += 1) {
    const a = customers[i * 2]!;
    const b = customers[i * 2 + 1]!;
    const pairing = await prisma.padelPairing.create({
      data: {
        eventId: targetEvent.id,
        organizationId,
        player1UserId: a.id,
        player2UserId: b.id,
        payment_mode: PadelPaymentMode.FULL,
        pairingStatus: PadelPairingStatus.COMPLETE,
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        createdByUserId: ownerUserId,
        partnerLinkToken: `${pairTokenPrefix}${String(i + 1).padStart(3, "0")}`,
        partnerLinkExpiresAt: daysFromNow(30, 23),
        partnerAcceptedAt: daysAgo(12 - i, 18),
        partnerPaidAt: daysAgo(11 - i, 18),
        slots: {
          create: [
            {
              profileId: a.id,
              slot_role: PadelPairingSlotRole.CAPTAIN,
              slotStatus: PadelPairingSlotStatus.FILLED,
              paymentStatus: PadelPairingPaymentStatus.PAID,
            },
            {
              profileId: b.id,
              slot_role: PadelPairingSlotRole.PARTNER,
              slotStatus: PadelPairingSlotStatus.FILLED,
              paymentStatus: PadelPairingPaymentStatus.PAID,
            },
          ],
        },
      },
      select: { id: true, player1UserId: true, player2UserId: true },
    });
    pairings.push({ id: pairing.id, player1: pairing.player1UserId!, player2: pairing.player2UserId! });

    await prisma.tournamentEntry.createMany({
      data: [
        {
          eventId: targetEvent.id,
          userId: a.id,
          pairingId: pairing.id,
          role: TournamentEntryRole.CAPTAIN,
          status: TournamentEntryStatus.CONFIRMED,
          ownerUserId: a.id,
          purchaseId: `${tournamentPurchasePrefix}${String(i + 1).padStart(3, "0")}_c`,
          emissionIndex: 0,
        },
        {
          eventId: targetEvent.id,
          userId: b.id,
          pairingId: pairing.id,
          role: TournamentEntryRole.PARTNER,
          status: TournamentEntryStatus.CONFIRMED,
          ownerUserId: b.id,
          purchaseId: `${tournamentPurchasePrefix}${String(i + 1).padStart(3, "0")}_p`,
          emissionIndex: 0,
        },
      ],
    });
  }

  let matches = 0;
  for (let i = 0; i + 1 < pairings.length; i += 2) {
    const pairingA = pairings[i]!;
    const pairingB = pairings[i + 1]!;
    const court = courts[(i / 2) % Math.max(1, courts.length)];
    const start = daysFromNow(5 + i, 18);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await prisma.eventMatchSlot.create({
      data: {
        eventId: targetEvent.id,
        courtId: court?.id ?? null,
        courtName: court?.name ?? null,
        pairingAId: pairingA.id,
        pairingBId: pairingB.id,
        roundLabel: `${matchRoundPrefix} ${Math.floor(i / 2) + 1}`,
        roundType: "GROUPS",
        groupLabel: `Grupo ${String.fromCharCode(65 + (i / 2))}`,
        startTime: start,
        plannedStartAt: start,
        plannedEndAt: end,
        plannedDurationMinutes: 60,
        status: i === 0 ? padel_match_status.OFFICIAL : padel_match_status.PENDING,
        score:
          i === 0
            ? {
                sets: [
                  { a: 6, b: 4 },
                  { a: 6, b: 3 },
                ],
              }
            : {},
        winnerPairingId: i === 0 ? pairingA.id : null,
      },
    });
    matches += 1;
  }

  return { pairings, matches, eventId: targetEvent.id };
}

async function seedPromotions(params: {
  organizationId: number;
  ownerUserId: string;
  storeOrders: Array<{ purchaseId: string | null; userId: string | null }>;
  tournamentEventId: number | null;
}) {
  const { organizationId, ownerUserId, storeOrders, tournamentEventId } = params;
  const eventForPromo =
    tournamentEventId ??
    (await prisma.event.findFirst({
      where: { organizationId },
      orderBy: [{ startsAt: "asc" }],
      select: { id: true },
    }))?.id ??
    null;

  const promoDefs = [
    {
      code: `${promoCodePrefix}10`,
      type: PromoType.PERCENTAGE,
      value: 10,
      maxUses: 120,
      perUserLimit: 3,
      eventId: eventForPromo,
      minTotalCents: 2500,
    },
    {
      code: `${promoCodePrefix}15`,
      type: PromoType.PERCENTAGE,
      value: 15,
      maxUses: 60,
      perUserLimit: 2,
      eventId: eventForPromo,
      minTotalCents: 4000,
    },
    {
      code: `${promoCodePrefix}500`,
      type: PromoType.FIXED,
      value: 500,
      maxUses: 80,
      perUserLimit: 2,
      eventId: eventForPromo,
      minTotalCents: 3000,
    },
  ];

  const promos: Array<{ id: number; code: string }> = [];
  for (const def of promoDefs) {
    const promo = await prisma.promoCode.create({
      data: {
        code: def.code,
        type: def.type,
        value: def.value,
        organizationId,
        promoterUserId: ownerUserId,
        maxUses: def.maxUses,
        perUserLimit: def.perUserLimit,
        validFrom: daysAgo(20, 0),
        validUntil: daysFromNow(90, 23),
        active: true,
        eventId: def.eventId,
        autoApply: false,
        minQuantity: 1,
        minTotalCents: def.minTotalCents,
      },
      select: { id: true, code: true },
    });
    promos.push(promo);
  }

  const redemptions = storeOrders
    .filter((order) => order.purchaseId && order.userId)
    .slice(0, 8)
    .map((order, index) => ({
      promoCodeId: promos[index % promos.length]!.id,
      userId: order.userId!,
      purchaseId: order.purchaseId!,
      usedAt: daysAgo(4 + index, 14),
    }));

  if (redemptions.length) {
    await prisma.promoRedemption.createMany({
      data: redemptions,
      skipDuplicates: true,
    });
  }

  return promos;
}

async function seedCrmContactsAndInteractions(params: {
  organizationId: number;
  customers: BasicProfile[];
  bookings: Array<{ userId: string | null; status: BookingStatus; price: number; startsAt: Date }>;
  orders: Array<{ userId: string | null; status: StoreOrderStatus; totalCents: number }>;
}) {
  const { organizationId, customers, bookings, orders } = params;

  const bookedByUser = new Map<string, Array<{ status: BookingStatus; price: number; startsAt: Date }>>();
  for (const booking of bookings) {
    if (!booking.userId) continue;
    const list = bookedByUser.get(booking.userId) ?? [];
    list.push({ status: booking.status, price: booking.price, startsAt: booking.startsAt });
    bookedByUser.set(booking.userId, list);
  }

  const ordersByUser = new Map<string, Array<{ status: StoreOrderStatus; totalCents: number }>>();
  for (const order of orders) {
    if (!order.userId) continue;
    const list = ordersByUser.get(order.userId) ?? [];
    list.push({ status: order.status, totalCents: order.totalCents });
    ordersByUser.set(order.userId, list);
  }

  const crmContacts: Array<{ id: string; userId: string }> = [];
  for (let i = 0; i < Math.min(customers.length, 16); i += 1) {
    const customer = customers[i]!;
    const customerBookings = bookedByUser.get(customer.id) ?? [];
    const customerOrders = ordersByUser.get(customer.id) ?? [];
    const paidBookings = customerBookings.filter((b) =>
      b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED || b.status === BookingStatus.NO_SHOW,
    );
    const paidOrders = customerOrders.filter((o) =>
      o.status === StoreOrderStatus.PAID || o.status === StoreOrderStatus.FULFILLED || o.status === StoreOrderStatus.PARTIAL_REFUND,
    );
    const totalBookings = customerBookings.length;
    const totalOrders = paidOrders.length;
    const totalSpentCents =
      paidBookings.reduce((acc, item) => acc + item.price, 0) + paidOrders.reduce((acc, item) => acc + item.totalCents, 0);
    const contactType = totalBookings + totalOrders > 0 ? CrmContactType.CUSTOMER : CrmContactType.LEAD;
    const lastBookingAt = paidBookings.length ? paidBookings.map((b) => b.startsAt).sort((a, b) => b.getTime() - a.getTime())[0] : null;

    const contact = await prisma.crmContact.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: customer.id,
        },
      },
      update: {
        status: "ACTIVE",
        contactType,
        displayName: customer.fullName ?? customer.username ?? "Cliente",
        contactEmail: `${customer.username ?? `cliente_${i + 1}`}@seed-top-padel.test`,
        contactPhone: `+35191${String(100000 + i).slice(-6)}`,
        legalBasis: "CONTRACT",
        marketingEmailOptIn: i % 5 !== 0,
        marketingPushOptIn: i % 4 !== 0,
        totalSpentCents,
        totalBookings,
        totalOrders,
        totalStoreOrders: totalOrders,
        totalTournaments: i % 3,
        lastActivityAt: lastBookingAt ?? daysAgo(2 + i, 15),
        lastPurchaseAt: paidOrders.length || paidBookings.length ? lastBookingAt ?? daysAgo(3, 16) : null,
        tags: Array.from(new Set(["seed_top_padel_full", i < 4 ? "vip" : "regular", i >= 12 ? "new_user" : ""])).filter(Boolean),
        sourceType: crmSourceType,
        sourceId: `user:${customer.id}`,
        customFields: {
          seedTag,
          username: customer.username,
          createdAt: customer.createdAt.toISOString(),
        },
      },
      create: {
        organizationId,
        userId: customer.id,
        status: "ACTIVE",
        contactType,
        displayName: customer.fullName ?? customer.username ?? "Cliente",
        contactEmail: `${customer.username ?? `cliente_${i + 1}`}@seed-top-padel.test`,
        contactPhone: `+35191${String(100000 + i).slice(-6)}`,
        legalBasis: "CONTRACT",
        marketingEmailOptIn: i % 5 !== 0,
        marketingPushOptIn: i % 4 !== 0,
        totalSpentCents,
        totalBookings,
        totalOrders,
        totalStoreOrders: totalOrders,
        totalTournaments: i % 3,
        firstInteractionAt: daysAgo(45 - i, 10),
        lastActivityAt: lastBookingAt ?? daysAgo(2 + i, 15),
        lastPurchaseAt: paidOrders.length || paidBookings.length ? lastBookingAt ?? daysAgo(3, 16) : null,
        tags: Array.from(new Set(["seed_top_padel_full", i < 4 ? "vip" : "regular", i >= 12 ? "new_user" : ""])).filter(Boolean),
        sourceType: crmSourceType,
        sourceId: `user:${customer.id}`,
        customFields: {
          seedTag,
          username: customer.username,
          createdAt: customer.createdAt.toISOString(),
        },
      },
      select: { id: true, userId: true },
    });
    crmContacts.push({ id: contact.id, userId: contact.userId! });
  }

  await prisma.crmInteraction.deleteMany({
    where: {
      organizationId,
      externalId: { startsWith: crmInteractionPrefix },
    },
  });

  let interactionIndex = 0;
  for (const contact of crmContacts) {
    const contactOrders = ordersByUser.get(contact.userId) ?? [];
    const contactBookings = bookedByUser.get(contact.userId) ?? [];

    for (const booking of contactBookings.slice(0, 3)) {
      await prisma.crmInteraction.create({
        data: {
          organizationId,
          contactId: contact.id,
          userId: contact.userId,
          externalId: `${crmInteractionPrefix}${contact.userId}:booking:${interactionIndex}`,
          type: booking.status === BookingStatus.CANCELLED_BY_CLIENT || booking.status === BookingStatus.CANCELLED_BY_ORG
            ? CrmInteractionType.BOOKING_CANCELLED
            : CrmInteractionType.BOOKING_CONFIRMED,
          sourceType: CrmInteractionSource.BOOKING,
          sourceId: `${seedTag}:booking:${interactionIndex}`,
          occurredAt: booking.startsAt,
          amountCents: booking.price,
          currency: "EUR",
          metadata: { seedTag, status: booking.status },
        },
      });
      interactionIndex += 1;
    }

    for (const order of contactOrders.slice(0, 2)) {
      await prisma.crmInteraction.create({
        data: {
          organizationId,
          contactId: contact.id,
          userId: contact.userId,
          externalId: `${crmInteractionPrefix}${contact.userId}:store:${interactionIndex}`,
          type:
            order.status === StoreOrderStatus.REFUNDED
              ? CrmInteractionType.STORE_ORDER_REFUNDED
              : CrmInteractionType.STORE_ORDER_PAID,
          sourceType: CrmInteractionSource.STORE_ORDER,
          sourceId: `${seedTag}:store:${interactionIndex}`,
          occurredAt: daysAgo(1 + (interactionIndex % 10), 14),
          amountCents: order.totalCents,
          currency: "EUR",
          metadata: { seedTag, status: order.status },
        },
      });
      interactionIndex += 1;
    }

    await prisma.crmInteraction.create({
      data: {
        organizationId,
        contactId: contact.id,
        userId: contact.userId,
        externalId: `${crmInteractionPrefix}${contact.userId}:profile:${interactionIndex}`,
        type: CrmInteractionType.PROFILE_VIEWED,
        sourceType: CrmInteractionSource.PROFILE,
        sourceId: `${seedTag}:profile:${interactionIndex}`,
        occurredAt: daysAgo(2 + (interactionIndex % 7), 11),
        amountCents: null,
        currency: "EUR",
        metadata: { seedTag },
      },
    });
    interactionIndex += 1;
  }

  return crmContacts;
}

async function seedConversations(params: {
  organizationId: number;
  staff: BasicProfile[];
  customers: BasicProfile[];
  ownerUserId: string;
}) {
  const { organizationId, staff, customers, ownerUserId } = params;
  const staffUserIds = staff.map((u) => u.id);
  const customerUserIds = customers.slice(0, 8).map((u) => u.id);

  const channelOps = await prisma.chatConversation.create({
    data: {
      organizationId,
      type: ChatConversationType.CHANNEL,
      contextType: ChatConversationContextType.ORG_CHANNEL,
      contextId: `${seedTag}:channel:ops`,
      title: `${conversationPrefix} Staff Ops`,
      description: "Canal interno da equipa.",
      createdByUserId: ownerUserId,
      openAt: daysAgo(30, 9),
    },
    select: { id: true },
  });

  await prisma.chatConversationMember.createMany({
    data: staffUserIds.map((userId, index) => ({
      conversationId: channelOps.id,
      organizationId,
      userId,
      role: index === 0 ? ChatConversationMemberRole.ADMIN : ChatConversationMemberRole.MEMBER,
      displayAs: ChatMemberDisplayAs.ORGANIZATION,
    })),
    skipDuplicates: true,
  });

  const channelSupport = await prisma.chatConversation.create({
    data: {
      organizationId,
      type: ChatConversationType.CHANNEL,
      contextType: ChatConversationContextType.ORG_CHANNEL,
      contextId: `${seedTag}:channel:support`,
      title: `${conversationPrefix} Staff + Clientes`,
      description: "Canal de comunicacao entre staff e clientes.",
      createdByUserId: ownerUserId,
      openAt: daysAgo(20, 9),
    },
    select: { id: true },
  });

  await prisma.chatConversationMember.createMany({
    data: [
      ...staffUserIds.slice(0, 3).map((userId, index) => ({
        conversationId: channelSupport.id,
        organizationId,
        userId,
        role: index === 0 ? ChatConversationMemberRole.ADMIN : ChatConversationMemberRole.MEMBER,
        displayAs: ChatMemberDisplayAs.ORGANIZATION,
      })),
      ...customerUserIds.slice(0, 5).map((userId) => ({
        conversationId: channelSupport.id,
        organizationId,
        userId,
        role: ChatConversationMemberRole.MEMBER,
        displayAs: ChatMemberDisplayAs.ORGANIZATION,
      })),
    ],
    skipDuplicates: true,
  });

  const directSupport = await prisma.chatConversation.create({
    data: {
      organizationId,
      type: ChatConversationType.DIRECT,
      contextType: ChatConversationContextType.ORG_CONTACT,
      contextId: `${seedTag}:direct:support`,
      customerId: customerUserIds[0] ?? null,
      professionalId: staffUserIds[1] ?? null,
      title: `${conversationPrefix} Apoio Cliente`,
      description: "Canal direto entre cliente e treinador.",
      createdByUserId: ownerUserId,
      openAt: daysAgo(7, 10),
    },
    select: { id: true },
  });

  await prisma.chatConversationMember.createMany({
    data: [staffUserIds[1], customerUserIds[0]]
      .filter((id): id is string => Boolean(id))
      .map((userId, index) => ({
        conversationId: directSupport.id,
        organizationId,
        userId,
        role: index === 0 ? ChatConversationMemberRole.ADMIN : ChatConversationMemberRole.MEMBER,
        displayAs: index === 0 ? ChatMemberDisplayAs.PROFESSIONAL : ChatMemberDisplayAs.ORGANIZATION,
      })),
    skipDuplicates: true,
  });

  const convoSpecs = [
    {
      id: channelOps.id,
      messageBodies: [
        "Briefing semanal: ocupacao dos campos e torneios.",
        "Confirmado: reforco de staff para sexta-feira.",
        "Financeiro e analytics com dados de teste atualizados.",
      ],
      senders: staffUserIds,
    },
    {
      id: channelSupport.id,
      messageBodies: [
        "Bem-vindos ao canal de apoio da Top Padel.",
        "Lembrem-se: torneio open spring abre inscricoes hoje.",
        "Promocao ativa para reservas e loja esta semana.",
      ],
      senders: [staffUserIds[0], customerUserIds[0], staffUserIds[1]].filter((id): id is string => Boolean(id)),
    },
    {
      id: directSupport.id,
      messageBodies: [
        "Ola! Queria reservar um slot para treino tecnico.",
        "Temos disponibilidade amanha as 19h no Campo 2.",
        "Perfeito, confirmado. Obrigado!",
      ],
      senders: [customerUserIds[0], staffUserIds[1], customerUserIds[0]].filter((id): id is string => Boolean(id)),
    },
  ];

  let messageCount = 0;
  for (let convoIndex = 0; convoIndex < convoSpecs.length; convoIndex += 1) {
    const convo = convoSpecs[convoIndex]!;
    let lastMessageId: string | null = null;
    let lastMessageAt: Date | null = null;
    for (let i = 0; i < convo.messageBodies.length; i += 1) {
      const sender = convo.senders[i % convo.senders.length];
      if (!sender) continue;
      const createdAt = daysAgo(6 - convoIndex, 10 + i);
      const msg = await prisma.chatConversationMessage.create({
        data: {
          conversationId: convo.id,
          organizationId,
          senderId: sender,
          body: convo.messageBodies[i],
          clientMessageId: `${messageClientPrefix}${convoIndex}:${i}`,
          kind: i === 0 ? ChatConversationMessageKind.ANNOUNCEMENT : ChatConversationMessageKind.TEXT,
          metadata: { seedTag, convoIndex, msgIndex: i },
          createdAt,
        },
        select: { id: true, createdAt: true },
      });
      messageCount += 1;
      lastMessageId = msg.id;
      lastMessageAt = msg.createdAt;
    }

    if (lastMessageId && lastMessageAt) {
      await prisma.chatConversation.update({
        where: { id: convo.id },
        data: {
          lastMessageId,
          lastMessageAt,
        },
      });

      await prisma.chatConversationMember.updateMany({
        where: { conversationId: convo.id },
        data: { lastReadMessageId: lastMessageId, lastReadAt: lastMessageAt },
      });
    }
  }

  return messageCount;
}

async function main() {
  const organization = await ensureOrganization();
  const modules = await ensureModules(organization.id);
  const addressId = await ensureOrganizationAddress(organization.id, organization.addressId);
  const profiles = await resolveProfiles(organization.groupId);

  await cleanupSeedArtifacts(organization.id);
  await ensureStaffMembershipAndPermissions({
    organizationId: organization.id,
    groupId: organization.groupId,
    staff: profiles.staff,
    modules,
  });

  const { clubId, courts } = await ensureClubAndCourts({
    organizationId: organization.id,
    addressId,
    staff: profiles.staff,
  });

  const { professionals, resources, services } = await ensureProfessionalsResourcesServices({
    organizationId: organization.id,
    addressId,
    staff: profiles.staff,
  });

  const bookings = await seedBookings({
    organizationId: organization.id,
    ownerUserId: profiles.owner.id,
    customers: profiles.customers,
    professionals,
    resources,
    services,
    courts,
    clubId,
  });

  const storeOrders = await seedStoreOrders({
    organizationId: organization.id,
    customers: profiles.customers,
  });

  const pairingResult = await seedPadelPairingsAndMatches({
    organizationId: organization.id,
    ownerUserId: profiles.owner.id,
    customers: profiles.customers,
    courts,
  });

  const promos = await seedPromotions({
    organizationId: organization.id,
    ownerUserId: profiles.owner.id,
    storeOrders: storeOrders.map((order) => ({ purchaseId: order.purchaseId, userId: order.userId })),
    tournamentEventId: pairingResult.eventId,
  });

  const crmContacts = await seedCrmContactsAndInteractions({
    organizationId: organization.id,
    customers: profiles.customers,
    bookings,
    orders: storeOrders.map((order) => ({ userId: order.userId, status: order.status, totalCents: order.totalCents })),
  });

  const messageCount = await seedConversations({
    organizationId: organization.id,
    staff: profiles.staff,
    customers: profiles.customers,
    ownerUserId: profiles.owner.id,
  });

  const summary = {
    organization: {
      id: organization.id,
      username: organization.username,
      publicName: organization.publicName,
    },
    seedTag,
    seeded: {
      staffProfiles: profiles.staff.length,
      customerProfilesUsed: profiles.customers.length,
      professionals: professionals.length,
      resources: resources.length,
      services: services.length,
      bookings: bookings.length,
      storeOrders: storeOrders.length,
      promoCodes: promos.length,
      crmContactsLinkedToUsers: crmContacts.length,
      pairings: pairingResult.pairings.length,
      matches: pairingResult.matches,
      chatMessages: messageCount,
    },
    quickLinks: {
      staff: `/org/${organization.id}/staff`,
      bookings: `/org/${organization.id}/bookings`,
      tournaments: `/org/${organization.id}/padel/tournaments`,
      loja: `/org/${organization.id}/store`,
      mensagens: `/org/${organization.id}/messages`,
      crm: `/org/${organization.id}/crm/customers`,
    },
  };

  console.log("[seed-top-padel-ops-suite] OK");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error("[seed-top-padel-ops-suite] error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
