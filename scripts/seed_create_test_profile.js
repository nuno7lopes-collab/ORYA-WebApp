#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

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

const seedEnv = (process.env.SEED_ENV || "test").toLowerCase() === "prod" ? "prod" : "test";
const newUsername = process.env.SEED_USERNAME || "test-orya";
const sourceUsername = process.env.SEED_SOURCE_USERNAME || "orya";
const seedEmail = process.env.SEED_EMAIL || `${newUsername}@orya.pt`;
const seedPassword = process.env.SEED_PASSWORD || "TestOrya123!";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE no ambiente.");
  process.exit(1);
}

if (process.env.NODE_ENV !== "production") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [seedEnv]).catch(() => {});
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function resolveOrCreateUser() {
  let user = null;
  try {
    if (typeof supabaseAdmin.auth.admin.getUserByEmail === "function") {
      const { data } = await supabaseAdmin.auth.admin.getUserByEmail(seedEmail);
      user = data?.user ?? null;
    }
  } catch {
    // fall through to list/create
  }

  if (!user) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    user = data?.users?.find((item) => item.email?.toLowerCase() === seedEmail.toLowerCase()) ?? null;
  }

  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: seedEmail,
      password: seedPassword,
      email_confirm: true,
    });
    if (error) throw new Error(`Falha ao criar user test: ${error.message}`);
    user = data?.user ?? null;
  }

  if (!user) throw new Error("Falha ao resolver user test.");
  return user;
}

(async () => {
  const testUser = await resolveOrCreateUser();
  const source = await prisma.profile.findFirst({
    where: { username: sourceUsername, env: "prod" },
    include: { users: { select: { id: true } } }, // <- ISTO é o crucial
  });

  if (!source) throw new Error(`Não encontrei profile source em prod: username=${sourceUsername}`);

  const existsByUsername = await prisma.profile.findFirst({
    where: { username: newUsername },
    select: { id: true, username: true, env: true },
  });

  if (existsByUsername && existsByUsername.id !== testUser.id) {
    throw new Error(`Username ${newUsername} já pertence a outro profile (${existsByUsername.id})`);
  }

  const existsById = await prisma.profile.findFirst({
    where: { id: testUser.id },
    select: { id: true, env: true, username: true },
  });
  if (existsById) {
    if (existsById.env !== seedEnv) {
      const updated = await prisma.profile.update({
        where: { id: testUser.id },
        data: {
          env: seedEnv,
          username: newUsername,
          fullName: source.fullName ?? "Orya (TEST)",
          avatarUrl: source.avatarUrl,
          coverUrl: source.coverUrl,
          bio: source.bio ?? "",
          gender: source.gender,
          padelLevel: source.padelLevel,
          padelPreferredSide: source.padelPreferredSide,
          padelClubName: source.padelClubName,
          favouriteCategories: source.favouriteCategories ?? [],
          onboardingDone: true,
          roles: source.roles ?? ["user"],
          deletedAt: null,
          isDeleted: false,
          visibility: source.visibility ?? "PUBLIC",
          is_verified: false,
          contactPhone: source.contactPhone,
          status: source.status ?? "ACTIVE",
          deletionRequestedAt: null,
          deletionScheduledFor: null,
          deletedAtFinal: null,
          locationConsent: source.locationConsent ?? "PENDING",
          locationGranularity: source.locationGranularity ?? "COARSE",
          locationSource: null,
          locationUpdatedAt: null,
          activeOrganizationId: null,
        },
      });
      console.log("MOVED:", { id: updated.id, username: updated.username, env: updated.env, email: seedEmail });
      return;
    }
    console.log("EXISTS:", existsById);
    return;
  }

  const userIds = [testUser.id];

  const created = await prisma.profile.create({
    data: {
      id: testUser.id,
      env: seedEnv,
      username: newUsername,
      fullName: source.fullName ?? "Orya (TEST)",
      avatarUrl: source.avatarUrl,
      coverUrl: source.coverUrl,
      bio: source.bio ?? "",
      gender: source.gender,
      padelLevel: source.padelLevel,
      padelPreferredSide: source.padelPreferredSide,
      padelClubName: source.padelClubName,
      favouriteCategories: source.favouriteCategories ?? [],
      onboardingDone: true,
      roles: source.roles ?? ["user"],
      deletedAt: null,
      isDeleted: false,
      visibility: source.visibility ?? "PUBLIC",
      is_verified: false,
      contactPhone: source.contactPhone,
      status: source.status ?? "ACTIVE",
      deletionRequestedAt: null,
      deletionScheduledFor: null,
      deletedAtFinal: null,
      locationConsent: source.locationConsent ?? "PENDING",
      locationGranularity: source.locationGranularity ?? "COARSE",
      locationSource: null,
      locationUpdatedAt: null,

      // <- usa o user de teste (auth.users)
      users: {
        connect: userIds.map((id) => ({ id })),
      },
    },
  });

  console.log("CREATED:", { id: created.id, username: created.username, env: created.env, connectedUsers: userIds.length, email: seedEmail });
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
