/**
 * Seed de teste para Padel (organizer + jogadores + evento + equipas/jogos).
 *
 * NOTA: não corre automaticamente. Usa:
 *   npx ts-node scripts/seed_padel.ts
 *
 * Antes de correr:
 *   - Define USER_ID_TEST (auth.users.id) de um utilizador existente.
 *   - Ajusta emails/usernames se necessário.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = process.env.USER_ID_TEST;
  if (!userId) throw new Error("Define USER_ID_TEST com o id do utilizador (auth.users.id).");

  const organizer = await prisma.organizer.upsert({
    where: { username: "club-padel-demo" },
    update: {},
    create: {
      userId,
      username: "club-padel-demo",
      displayName: "Clube Padel Demo",
      businessName: "Clube Padel Demo",
      city: "Lisboa",
      entityType: "CLUBE",
      status: "ACTIVE",
    },
  });

  const playersData = [
    { fullName: "João Silva", email: "joao.silva+padel@example.com", level: "M3" },
    { fullName: "Maria Costa", email: "maria.costa+padel@example.com", level: "M3" },
    { fullName: "Ricardo Lopes", email: "ricardo.lopes+padel@example.com", level: "M4" },
    { fullName: "Ana Santos", email: "ana.santos+padel@example.com", level: "M4" },
  ];

  const players = await Promise.all(
    playersData.map((p) =>
      prisma.padelPlayerProfile.upsert({
        where: { organizerId_email: { organizerId: organizer.id, email: p.email! } },
        update: { fullName: p.fullName, level: p.level },
        create: { organizerId: organizer.id, fullName: p.fullName, email: p.email, level: p.level },
      }),
    ),
  );

  const event = await prisma.event.create({
    data: {
      slug: `torneio-padel-demo-${Math.random().toString(36).slice(2, 6)}`,
      title: "Torneio Padel Demo",
      description: "Seed de teste Padel",
      type: "ORGANIZER_EVENT",
      templateType: "PADEL",
      ownerUserId: userId,
      organizerId: organizer.id,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      locationName: "Clube Demo",
      locationCity: "Lisboa",
      isFree: true,
      status: "PUBLISHED",
      resaleMode: "ALWAYS",
      feeMode: "INCLUDED",
      payoutMode: "ORGANIZER",
    },
  });

  await prisma.padelTournamentConfig.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      organizerId: organizer.id,
      format: "TODOS_CONTRA_TODOS",
      numberOfCourts: 2,
    },
    update: {},
  });

  const teamA = await prisma.padelTeam.create({
    data: { eventId: event.id, player1Id: players[0].id, player2Id: players[1].id },
  });
  const teamB = await prisma.padelTeam.create({
    data: { eventId: event.id, player1Id: players[2].id, player2Id: players[3].id },
  });

  await prisma.padelMatch.create({
    data: {
      eventId: event.id,
      teamAId: teamA.id,
      teamBId: teamB.id,
      status: "DONE",
      score: { sets: [{ teamA: 6, teamB: 4 }, { teamA: 6, teamB: 3 }] },
    },
  });

  console.log("Seed Padel criada com sucesso:", { organizerId: organizer.id, eventId: event.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
