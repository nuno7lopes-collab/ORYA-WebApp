#!/usr/bin/env node
const { PrismaClient, NotificationType } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

require("./load-env");

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
if (!dbUrl) {
  console.error("Falta DATABASE_URL (ou DIRECT_URL) no ambiente.");
  process.exit(1);
}

const seedEnv = (process.env.SEED_ENV || "prod").toLowerCase() === "prod" ? "prod" : "test";

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});

pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [seedEnv]).catch(() => {});
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

const pickOne = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const buildDate = (maxDaysAgo = 80) => {
  const daysAgo = randomInt(0, maxDaysAgo - 1);
  const hours = randomInt(0, 23);
  const minutes = randomInt(0, 59);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, randomInt(0, 59), 0);
  return date;
};

(async () => {
  const user = await prisma.profile.findFirst({
    where: { username: "lopes", env: seedEnv },
    select: { id: true, username: true },
  });

  if (!user) {
    throw new Error("Não encontrei o utilizador @lopes.");
  }

  const actors = await prisma.profile.findMany({
    where: { env: seedEnv, isDeleted: false, id: { not: user.id } },
    take: 40,
    select: { id: true, username: true, fullName: true },
  });

  if (!actors.length) {
    throw new Error("Não encontrei utilizadores para usar como atores.");
  }

  const events = await prisma.event.findMany({
    where: { env: seedEnv },
    take: 20,
    select: { id: true, slug: true, title: true, organizationId: true },
  });

  const organizations = await prisma.organization.findMany({
    where: { env: seedEnv },
    take: 20,
    select: { id: true, publicName: true, businessName: true },
  });

  const pickEvent = () => pickOne(events);
  const pickOrg = () => pickOne(organizations);
  const pickActor = () => pickOne(actors);

  const makeNotif = (type, options = {}) => {
    const createdAt = options.createdAt || buildDate();
    const isRead = options.isRead ?? createdAt.getTime() < Date.now() - 1000 * 60 * 60 * 24 * 7;
    return {
      userId: user.id,
      type,
      title: options.title || null,
      body: options.body || null,
      ctaUrl: options.ctaUrl || null,
      ctaLabel: options.ctaLabel || null,
      fromUserId: options.fromUserId || null,
      organizationId: options.organizationId || null,
      eventId: options.eventId || null,
      inviteId: options.inviteId || null,
      payload: options.payload || {},
      isRead,
      createdAt,
      readAt: isRead ? new Date(createdAt.getTime() + 1000 * 60) : null,
      env: seedEnv,
    };
  };

  const notifications = [];

  // Social / network
  for (let i = 0; i < 3; i++) {
    const actor = pickActor();
    notifications.push(
      makeNotif(NotificationType.FOLLOW_REQUEST, {
        fromUserId: actor?.id,
      }),
    );
  }

  for (let i = 0; i < 3; i++) {
    const actor = pickActor();
    notifications.push(
      makeNotif(NotificationType.FOLLOWED_YOU, {
        fromUserId: actor?.id,
      }),
    );
  }

  notifications.push(
    makeNotif(NotificationType.FOLLOW_ACCEPT, {
      fromUserId: pickActor()?.id,
    }),
  );

  // Organization / invites
  notifications.push(
    makeNotif(NotificationType.ORGANIZATION_INVITE, {
      organizationId: pickOrg()?.id || null,
    }),
  );

  notifications.push(
    makeNotif(NotificationType.CLUB_INVITE, {
      organizationId: pickOrg()?.id || null,
    }),
  );

  // Events
  for (let i = 0; i < 2; i++) {
    const event = pickEvent();
    notifications.push(
      makeNotif(NotificationType.NEW_EVENT_FROM_FOLLOWED_ORGANIZATION, {
        organizationId: event?.organizationId || pickOrg()?.id || null,
        eventId: event?.id || null,
        ctaUrl: event?.slug ? `/eventos/${event.slug}` : null,
        ctaLabel: event?.slug ? "Ver evento" : null,
      }),
    );
  }

  for (let i = 0; i < 2; i++) {
    const event = pickEvent();
    notifications.push(
      makeNotif(NotificationType.EVENT_REMINDER, {
        organizationId: event?.organizationId || null,
        eventId: event?.id || null,
        ctaUrl: event?.slug ? `/eventos/${event.slug}` : null,
        ctaLabel: event?.slug ? "Ver evento" : null,
      }),
    );
  }

  for (let i = 0; i < 2; i++) {
    const event = pickEvent();
    const actor = pickActor();
    notifications.push(
      makeNotif(NotificationType.EVENT_INVITE, {
        fromUserId: actor?.id || null,
        organizationId: event?.organizationId || pickOrg()?.id || null,
        eventId: event?.id || null,
        ctaUrl: event?.slug ? `/eventos/${event.slug}` : null,
        ctaLabel: event?.slug ? "Ver evento" : null,
      }),
    );
  }

  for (let i = 0; i < 2; i++) {
    const event = pickEvent();
    const actor = pickActor();
    notifications.push(
      makeNotif(NotificationType.FRIEND_GOING_TO_EVENT, {
        fromUserId: actor?.id || null,
        organizationId: event?.organizationId || pickOrg()?.id || null,
        eventId: event?.id || null,
        ctaUrl: event?.slug ? `/eventos/${event.slug}` : null,
        ctaLabel: event?.slug ? "Ver evento" : null,
      }),
    );
  }

  notifications.push(
    makeNotif(NotificationType.TICKET_SHARED, {
      eventId: pickEvent()?.id || null,
      ctaUrl: "/me/bilhetes",
      ctaLabel: "Ver bilhete",
    }),
  );

  notifications.push(
    makeNotif(NotificationType.TICKET_TRANSFER_RECEIVED, {
      eventId: pickEvent()?.id || null,
      ctaUrl: "/me/bilhetes",
      ctaLabel: "Ver bilhete",
    }),
  );

  // System announce
  notifications.push(
    makeNotif(NotificationType.SYSTEM_ANNOUNCE, {
      title: "Atualização do sistema",
      body: "Tens novidades importantes na tua conta.",
      ctaUrl: "/me",
      ctaLabel: "Ver detalhes",
    }),
  );

  // Ensure exactly 20
  const totalNeeded = 20;
  while (notifications.length < totalNeeded) {
    notifications.push(
      makeNotif(NotificationType.SYSTEM_ANNOUNCE, {
        title: "Notificação",
        body: "Atualização da tua conta.",
        ctaUrl: "/me",
        ctaLabel: "Ver",
      }),
    );
  }

  const trimmedNotifications = notifications.slice(0, totalNeeded);

  // Create follow requests for FOLLOW_REQUEST notifications
  for (const notif of trimmedNotifications) {
    if (notif.type !== NotificationType.FOLLOW_REQUEST || !notif.fromUserId) continue;
    const existing = await prisma.follow_requests.findFirst({
      where: { requester_id: notif.fromUserId, target_id: user.id },
      select: { id: true },
    });
    if (!existing) {
      await prisma.follow_requests.create({
        data: {
          requester_id: notif.fromUserId,
          target_id: user.id,
          created_at: notif.createdAt,
          env: seedEnv,
        },
      });
    }
  }

  // Insert notifications
  for (const notif of trimmedNotifications) {
    await prisma.notification.create({ data: notif });
  }

  console.info(`Criadas ${trimmedNotifications.length} notificações para @${user.username}.`);

  await prisma.$disconnect();
  await pool.end();
})().catch(async (err) => {
  console.error("Erro a gerar notificações:", err);
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
