/**
 * Seed de mensagens para validar a UX da aba "Mensagens" na app mobile.
 *
 * Uso:
 *   node scripts/run-ts.cjs scripts/seed_messages_nunolopess.ts
 *
 * Opcional:
 *   SEED_ENV=prod|test
 *   SEED_TARGET_USERNAME=nunolopess
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  ChatConversationContextType,
  ChatConversationMemberRole,
  ChatConversationMessageKind,
  ChatConversationType,
  ChatMemberDisplayAs,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type SeedProfile = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

type SeedOrganization = {
  id: number;
  groupId: number;
  publicName: string;
  businessName: string | null;
  username: string | null;
};

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
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

function resolveDbUrl() {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("options");
    return parsed.toString();
  } catch {
    return raw;
  }
}

const dbUrl = resolveDbUrl();
if (!dbUrl) throw new Error("Falta DATABASE_URL (ou DIRECT_URL).");

const seedEnvRaw = (process.env.SEED_ENV || process.env.APP_ENV || "prod").toLowerCase();
const seedEnv = seedEnvRaw === "test" ? "test" : "prod";
const targetUsername = (process.env.SEED_TARGET_USERNAME || "nunolopess").trim().toLowerCase();
const seedTag = "messages_nunolopess_v1";
const sourceTable = "seed_messages_nunolopess";

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [seedEnv]).catch(() => {});
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

function dmContextId(userA: string, userB: string) {
  return [userA, userB].sort().join(":");
}

function deterministicUuid(input: string) {
  const bytes = crypto.createHash("sha256").update(input).digest("hex").slice(0, 32).split("");
  bytes[12] = "4";
  const variant = parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const hex = bytes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function minutesAgo(value: number) {
  return new Date(Date.now() - value * 60_000);
}

function profileLabel(profile: SeedProfile) {
  return profile.fullName?.trim() || (profile.username ? `@${profile.username}` : profile.id);
}

async function ensureConversationMember(params: {
  conversationId: string;
  userId: string;
  role: ChatConversationMemberRole;
  organizationId?: number | null;
  displayAs?: ChatMemberDisplayAs;
  hiddenFromCustomer?: boolean;
}) {
  return prisma.chatConversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.userId,
      },
    },
    update: {
      role: params.role,
      organizationId: params.organizationId ?? null,
      displayAs: params.displayAs ?? ChatMemberDisplayAs.ORGANIZATION,
      hiddenFromCustomer: params.hiddenFromCustomer ?? false,
      leftAt: null,
      accessRevokedAt: null,
      bannedAt: null,
    },
    create: {
      conversationId: params.conversationId,
      userId: params.userId,
      role: params.role,
      organizationId: params.organizationId ?? null,
      displayAs: params.displayAs ?? ChatMemberDisplayAs.ORGANIZATION,
      hiddenFromCustomer: params.hiddenFromCustomer ?? false,
    },
  });
}

async function ensureDmConversation(params: {
  target: SeedProfile;
  peer: SeedProfile;
}) {
  const contextId = dmContextId(params.target.id, params.peer.id);

  let conversation = await prisma.chatConversation.findFirst({
    where: {
      organizationId: null,
      contextType: ChatConversationContextType.USER_DM,
      contextId,
    },
    select: { id: true },
  });

  if (!conversation) {
    conversation = await prisma.chatConversation.create({
      data: {
        organizationId: null,
        type: ChatConversationType.DIRECT,
        contextType: ChatConversationContextType.USER_DM,
        contextId,
        createdByUserId: params.target.id,
        title: null,
      },
      select: { id: true },
    });
  }

  await ensureConversationMember({
    conversationId: conversation.id,
    userId: params.target.id,
    role: ChatConversationMemberRole.MEMBER,
    organizationId: null,
    displayAs: ChatMemberDisplayAs.ORGANIZATION,
  });
  await ensureConversationMember({
    conversationId: conversation.id,
    userId: params.peer.id,
    role: ChatConversationMemberRole.MEMBER,
    organizationId: null,
    displayAs: ChatMemberDisplayAs.ORGANIZATION,
  });

  return conversation.id;
}

async function ensureOrgConversation(params: {
  target: SeedProfile;
  organization: SeedOrganization;
  professional: SeedProfile;
  orgAdmin: SeedProfile;
}) {
  let conversation = await prisma.chatConversation.findFirst({
    where: {
      organizationId: params.organization.id,
      contextType: ChatConversationContextType.ORG_CONTACT,
      customerId: params.target.id,
    },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true },
  });

  if (!conversation) {
    conversation = await prisma.chatConversation.create({
      data: {
        organizationId: params.organization.id,
        type: ChatConversationType.CHANNEL,
        contextType: ChatConversationContextType.ORG_CONTACT,
        contextId: `seed:${seedTag}:org:${params.organization.id}:customer:${params.target.id}`,
        customerId: params.target.id,
        professionalId: params.professional.id,
        title: profileLabel(params.target),
        createdByUserId: params.orgAdmin.id,
      },
      select: { id: true },
    });
  }

  await ensureConversationMember({
    conversationId: conversation.id,
    userId: params.target.id,
    role: ChatConversationMemberRole.MEMBER,
    organizationId: null,
    displayAs: ChatMemberDisplayAs.ORGANIZATION,
    hiddenFromCustomer: false,
  });
  await ensureConversationMember({
    conversationId: conversation.id,
    userId: params.professional.id,
    role: ChatConversationMemberRole.MEMBER,
    organizationId: params.organization.id,
    displayAs: ChatMemberDisplayAs.PROFESSIONAL,
    hiddenFromCustomer: false,
  });
  await ensureConversationMember({
    conversationId: conversation.id,
    userId: params.orgAdmin.id,
    role: ChatConversationMemberRole.ADMIN,
    organizationId: params.organization.id,
    displayAs: ChatMemberDisplayAs.ORGANIZATION,
    hiddenFromCustomer: true,
  });

  return conversation.id;
}

async function upsertMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
  clientMessageId: string;
  createdAt: Date;
  organizationId?: number | null;
}) {
  const existing = await prisma.chatConversationMessage.findFirst({
    where: {
      conversationId: params.conversationId,
      senderId: params.senderId,
      clientMessageId: params.clientMessageId,
    },
    select: { id: true, createdAt: true },
  });

  if (existing) {
    return prisma.chatConversationMessage.update({
      where: { id: existing.id },
      data: {
        body: params.body,
        deletedAt: null,
        metadata: { seedTag } as Prisma.InputJsonValue,
      },
      select: { id: true, createdAt: true },
    });
  }

  return prisma.chatConversationMessage.create({
    data: {
      conversationId: params.conversationId,
      organizationId: params.organizationId ?? null,
      senderId: params.senderId,
      body: params.body,
      clientMessageId: params.clientMessageId,
      kind: ChatConversationMessageKind.TEXT,
      metadata: { seedTag } as Prisma.InputJsonValue,
      createdAt: params.createdAt,
    },
    select: { id: true, createdAt: true },
  });
}

async function syncConversationTail(conversationId: string) {
  const latest = await prisma.chatConversationMessage.findFirst({
    where: {
      conversationId,
      deletedAt: null,
      replyToId: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true },
  });

  if (!latest) return null;

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageId: latest.id,
      lastMessageAt: latest.createdAt,
    },
  });

  return latest;
}

async function setMemberReadState(params: {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  organizationId?: number | null;
}) {
  await prisma.chatConversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.userId,
      },
    },
    update: {
      organizationId: params.organizationId ?? undefined,
      lastReadMessageId: params.lastReadMessageId,
      lastReadAt: params.lastReadAt,
      leftAt: null,
      accessRevokedAt: null,
      bannedAt: null,
    },
    create: {
      conversationId: params.conversationId,
      userId: params.userId,
      role: ChatConversationMemberRole.MEMBER,
      organizationId: params.organizationId ?? null,
      lastReadMessageId: params.lastReadMessageId,
      lastReadAt: params.lastReadAt,
      displayAs: ChatMemberDisplayAs.ORGANIZATION,
      hiddenFromCustomer: false,
    },
  });
}

async function ensurePendingDmRequest(params: {
  requester: SeedProfile;
  target: SeedProfile;
}) {
  const contextId = dmContextId(params.requester.id, params.target.id);
  const key = `seed:${seedTag}:grant:dm:${params.requester.id}:${params.target.id}`;
  const sourceId = deterministicUuid(key);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const title = `Pedido de mensagem de ${profileLabel(params.requester)}`;

  const existing = await prisma.chatAccessGrant.findFirst({
    where: {
      sourceTable,
      sourceId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.chatAccessGrant.update({
      where: { id: existing.id },
      data: {
        kind: "USER_DM_REQUEST",
        status: "PENDING",
        contextType: ChatConversationContextType.USER_DM,
        contextId,
        requesterId: params.requester.id,
        targetUserId: params.target.id,
        targetOrganizationId: null,
        organizationId: null,
        conversationId: null,
        title,
        expiresAt,
        resolvedAt: null,
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        revokedAt: null,
        metadata: { seedTag, preview: true } as Prisma.InputJsonValue,
      },
    });
    return;
  }

  await prisma.chatAccessGrant.create({
    data: {
      kind: "USER_DM_REQUEST",
      status: "PENDING",
      contextType: ChatConversationContextType.USER_DM,
      contextId,
      requesterId: params.requester.id,
      targetUserId: params.target.id,
      targetOrganizationId: null,
      organizationId: null,
      conversationId: null,
      sourceTable,
      sourceId,
      title,
      expiresAt,
      metadata: { seedTag, preview: true } as Prisma.InputJsonValue,
    },
  });
}

async function resolveTargetProfile() {
  const profile = await prisma.profile.findFirst({
    where: {
      username: targetUsername,
      isDeleted: false,
    },
    select: { id: true, fullName: true, username: true, avatarUrl: true },
  });
  if (!profile) {
    throw new Error(`Perfil @${targetUsername} não encontrado no env=${seedEnv}.`);
  }
  return profile;
}

async function resolvePeerProfiles(targetId: string) {
  const peers = await prisma.profile.findMany({
    where: {
      id: { not: targetId },
      isDeleted: false,
      status: "ACTIVE",
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
    select: { id: true, fullName: true, username: true, avatarUrl: true },
  });
  if (peers.length < 3) {
    throw new Error("Perfis insuficientes para seed de mensagens (mínimo 3 peers).");
  }
  return peers;
}

async function resolveOrganization() {
  const organization = await prisma.organization.findFirst({
    where: { status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      groupId: true,
      publicName: true,
      businessName: true,
      username: true,
    },
  });
  if (!organization) return null;
  return organization;
}

async function resolveOrgAdminProfile(organization: SeedOrganization, fallbackUser: SeedProfile) {
  const group = await prisma.organizationGroup.findUnique({
    where: { id: organization.groupId },
    select: { ownerUserId: true },
  });

  if (!group?.ownerUserId) return fallbackUser;

  const owner = await prisma.profile.findUnique({
    where: { id: group.ownerUserId },
    select: { id: true, fullName: true, username: true, avatarUrl: true, isDeleted: true },
  });

  if (!owner || owner.isDeleted) return fallbackUser;
  return {
    id: owner.id,
    fullName: owner.fullName,
    username: owner.username,
    avatarUrl: owner.avatarUrl,
  };
}

async function main() {
  const target = await resolveTargetProfile();
  const peers = await resolvePeerProfiles(target.id);
  const dmPeerA = peers[0]!;
  const dmPeerB = peers[1]!;
  const requestPeer = peers[2]!;

  const dmAConversationId = await ensureDmConversation({ target, peer: dmPeerA });
  const dmAMsg1 = await upsertMessage({
    conversationId: dmAConversationId,
    senderId: dmPeerA.id,
    body: `Olá ${target.fullName?.split(" ")[0] ?? "@nunolopess"}, vamos combinar treino amanhã?`,
    clientMessageId: `${seedTag}:dm-a:1`,
    createdAt: minutesAgo(95),
  });
  const dmAMsg2 = await upsertMessage({
    conversationId: dmAConversationId,
    senderId: target.id,
    body: "Bora, no final da tarde funciona.",
    clientMessageId: `${seedTag}:dm-a:2`,
    createdAt: minutesAgo(88),
  });
  const dmAMsg3 = await upsertMessage({
    conversationId: dmAConversationId,
    senderId: dmPeerA.id,
    body: "Fechado, depois mando local.",
    clientMessageId: `${seedTag}:dm-a:3`,
    createdAt: minutesAgo(77),
  });
  await syncConversationTail(dmAConversationId);
  await setMemberReadState({
    conversationId: dmAConversationId,
    userId: target.id,
    lastReadMessageId: dmAMsg2.id,
    lastReadAt: dmAMsg2.createdAt,
  });

  const dmBConversationId = await ensureDmConversation({ target, peer: dmPeerB });
  await upsertMessage({
    conversationId: dmBConversationId,
    senderId: target.id,
    body: "Já viste os eventos novos desta semana?",
    clientMessageId: `${seedTag}:dm-b:1`,
    createdAt: minutesAgo(48),
  });
  await upsertMessage({
    conversationId: dmBConversationId,
    senderId: dmPeerB.id,
    body: "Sim, há 2 que quero ir contigo.",
    clientMessageId: `${seedTag}:dm-b:2`,
    createdAt: minutesAgo(40),
  });
  const dmBLast = await upsertMessage({
    conversationId: dmBConversationId,
    senderId: target.id,
    body: "Perfeito, depois alinhamos tudo.",
    clientMessageId: `${seedTag}:dm-b:3`,
    createdAt: minutesAgo(32),
  });
  await syncConversationTail(dmBConversationId);
  await setMemberReadState({
    conversationId: dmBConversationId,
    userId: target.id,
    lastReadMessageId: dmBLast.id,
    lastReadAt: dmBLast.createdAt,
  });

  let orgConversationId: string | null = null;
  const organization = await resolveOrganization();
  if (organization) {
    const professional = peers[3] ?? dmPeerA;
    const orgAdmin = await resolveOrgAdminProfile(organization, professional);
    orgConversationId = await ensureOrgConversation({
      target,
      organization,
      professional,
      orgAdmin,
    });

    const orgMsg1 = await upsertMessage({
      conversationId: orgConversationId,
      senderId: professional.id,
      organizationId: organization.id,
      body: `Olá ${target.fullName?.split(" ")[0] ?? "Nuno"}, podemos ajudar com a tua reserva.`,
      clientMessageId: `${seedTag}:org:1`,
      createdAt: minutesAgo(26),
    });
    const orgMsg2 = await upsertMessage({
      conversationId: orgConversationId,
      senderId: target.id,
      body: "Obrigado. Quero confirmar horário e disponibilidade.",
      clientMessageId: `${seedTag}:org:2`,
      createdAt: minutesAgo(18),
      organizationId: organization.id,
    });
    await upsertMessage({
      conversationId: orgConversationId,
      senderId: professional.id,
      organizationId: organization.id,
      body: "Está confirmado para amanhã às 19:00.",
      clientMessageId: `${seedTag}:org:3`,
      createdAt: minutesAgo(11),
    });
    await syncConversationTail(orgConversationId);
    await setMemberReadState({
      conversationId: orgConversationId,
      userId: target.id,
      lastReadMessageId: orgMsg2.id,
      lastReadAt: orgMsg2.createdAt,
      organizationId: null,
    });
    await setMemberReadState({
      conversationId: orgConversationId,
      userId: professional.id,
      lastReadMessageId: orgMsg1.id,
      lastReadAt: orgMsg1.createdAt,
      organizationId: organization.id,
    });
  }

  await ensurePendingDmRequest({ requester: requestPeer, target });

  console.log(`\n[seed] Mensagens criadas/atualizadas para @${targetUsername}`);
  console.log(`[seed] DMs: ${dmAConversationId}, ${dmBConversationId}`);
  if (orgConversationId) {
    console.log(`[seed] ORG_CONTACT: ${orgConversationId}`);
  } else {
    console.log("[seed] ORG_CONTACT: ignorado (sem organização ativa disponível).");
  }
  console.log(`[seed] Pedido pendente criado para preview de requests.`);
}

main()
  .catch((err) => {
    console.error("[seed] Erro ao criar dados de mensagens:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
