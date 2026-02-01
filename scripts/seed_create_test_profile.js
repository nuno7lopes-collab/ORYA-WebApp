#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL no ambiente.");
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
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
  options: `-c app.env=${seedEnv}`,
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
    where: { username: newUsername, env: seedEnv },
    select: { id: true, username: true, env: true },
  });

  if (existsByUsername) {
    console.log("EXISTS:", existsByUsername);
    return;
  }

  const existsById = await prisma.profile.findFirst({
    where: { id: testUser.id },
    select: { id: true, env: true, username: true },
  });
  if (existsById) {
    if (existsById.env !== seedEnv) {
      throw new Error(`Profile com id ${testUser.id} já existe em env=${existsById.env}`);
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
      city: source.city,
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
      locationCity: null,
      locationRegion: null,
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
