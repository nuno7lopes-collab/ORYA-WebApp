import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppEnv } from "@/lib/appEnv";
import { getUserMutualSet } from "@/domain/social/follows";

const CLOSE_FRIEND_LIMIT_DEFAULT = 10;
const CLOSE_FRIEND_WINDOW_DAYS = 90;
const CLOSE_FRIEND_CACHE_DAYS = 7;

const SCORE_WEIGHTS = {
  directMessage: 5,
  communityComment: 3,
  communityReaction: 1,
  coEvent: 2,
};

type CloseFriend = {
  friendUserId: string;
  score: number;
};

type ScoreRow = { other_user_id: string | null; cnt: number | string };

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const toCount = (value: number | string | null) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const addScore = (scores: Map<string, number>, userId: string, delta: number) => {
  if (!userId || !Number.isFinite(delta)) return;
  scores.set(userId, (scores.get(userId) ?? 0) + delta);
};

async function addDirectMessageScores(
  scores: Map<string, number>,
  userId: string,
  windowStart: Date,
) {
  const directConversations = await prisma.chatConversationMember.findMany({
    where: { userId, conversation: { type: "DIRECT" } },
    select: { conversationId: true },
  });
  const conversationIds = directConversations.map((row) => row.conversationId);
  if (!conversationIds.length) return;

  const otherMembers = await prisma.chatConversationMember.findMany({
    where: { conversationId: { in: conversationIds }, userId: { not: userId } },
    select: { conversationId: true, userId: true },
  });
  const conversationToFriend = new Map<string, string>();
  otherMembers.forEach((member) => {
    if (!conversationToFriend.has(member.conversationId)) {
      conversationToFriend.set(member.conversationId, member.userId);
    }
  });

  if (!conversationToFriend.size) return;

  const counts = await prisma.chatConversationMessage.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversationIds },
      createdAt: { gte: windowStart },
      deletedAt: null,
    },
    _count: { _all: true },
  });

  counts.forEach((row) => {
    const friendUserId = conversationToFriend.get(row.conversationId);
    if (!friendUserId || friendUserId === userId) return;
    const count = row._count?._all ?? 0;
    if (!count) return;
    addScore(scores, friendUserId, count * SCORE_WEIGHTS.directMessage);
  });
}

async function addCommunityCommentScores(
  scores: Map<string, number>,
  env: string,
  userId: string,
  windowStart: Date,
) {
  const rows = await prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT p.author_user_id AS other_user_id, COUNT(*)::int AS cnt
    FROM app_v3.padel_community_comments c
    JOIN app_v3.padel_community_posts p ON p.id = c.post_id
    WHERE c.env = ${env}
      AND p.env = ${env}
      AND c.author_user_id = ${userId}
      AND c.created_at >= ${windowStart}
      AND p.author_user_id IS NOT NULL
      AND p.author_user_id <> ${userId}
    GROUP BY p.author_user_id
  `);
  rows.forEach((row) => {
    if (!row.other_user_id) return;
    addScore(scores, row.other_user_id, toCount(row.cnt) * SCORE_WEIGHTS.communityComment);
  });

  const reverseRows = await prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT c.author_user_id AS other_user_id, COUNT(*)::int AS cnt
    FROM app_v3.padel_community_comments c
    JOIN app_v3.padel_community_posts p ON p.id = c.post_id
    WHERE c.env = ${env}
      AND p.env = ${env}
      AND p.author_user_id = ${userId}
      AND c.author_user_id IS NOT NULL
      AND c.author_user_id <> ${userId}
      AND c.created_at >= ${windowStart}
    GROUP BY c.author_user_id
  `);
  reverseRows.forEach((row) => {
    if (!row.other_user_id) return;
    addScore(scores, row.other_user_id, toCount(row.cnt) * SCORE_WEIGHTS.communityComment);
  });
}

async function addCommunityReactionScores(
  scores: Map<string, number>,
  env: string,
  userId: string,
  windowStart: Date,
) {
  const rows = await prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT p.author_user_id AS other_user_id, COUNT(*)::int AS cnt
    FROM app_v3.padel_community_reactions r
    JOIN app_v3.padel_community_posts p ON p.id = r.post_id
    WHERE r.env = ${env}
      AND p.env = ${env}
      AND r.user_id = ${userId}
      AND r.created_at >= ${windowStart}
      AND p.author_user_id IS NOT NULL
      AND p.author_user_id <> ${userId}
    GROUP BY p.author_user_id
  `);
  rows.forEach((row) => {
    if (!row.other_user_id) return;
    addScore(scores, row.other_user_id, toCount(row.cnt) * SCORE_WEIGHTS.communityReaction);
  });

  const reverseRows = await prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT r.user_id AS other_user_id, COUNT(*)::int AS cnt
    FROM app_v3.padel_community_reactions r
    JOIN app_v3.padel_community_posts p ON p.id = r.post_id
    WHERE r.env = ${env}
      AND p.env = ${env}
      AND p.author_user_id = ${userId}
      AND r.user_id <> ${userId}
      AND r.created_at >= ${windowStart}
    GROUP BY r.user_id
  `);
  reverseRows.forEach((row) => {
    if (!row.other_user_id) return;
    addScore(scores, row.other_user_id, toCount(row.cnt) * SCORE_WEIGHTS.communityReaction);
  });
}

async function addCoEventScores(
  scores: Map<string, number>,
  env: string,
  userId: string,
  windowStart: Date,
  now: Date,
) {
  const rows = await prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT e2.owner_user_id AS other_user_id, COUNT(*)::int AS cnt
    FROM app_v3.entitlements e1
    JOIN app_v3.entitlements e2 ON e2.event_id = e1.event_id
    WHERE e1.env = ${env}
      AND e2.env = ${env}
      AND e1.owner_user_id = ${userId}
      AND e2.owner_user_id <> ${userId}
      AND e1.event_id IS NOT NULL
      AND e2.event_id IS NOT NULL
      AND e1.status IN ('ACTIVE', 'EXPIRED')
      AND e2.status IN ('ACTIVE', 'EXPIRED')
      AND e1.snapshot_start_at >= ${windowStart}
      AND e1.snapshot_start_at <= ${now}
    GROUP BY e2.owner_user_id
  `);
  rows.forEach((row) => {
    if (!row.other_user_id) return;
    addScore(scores, row.other_user_id, toCount(row.cnt) * SCORE_WEIGHTS.coEvent);
  });
}

async function computeCloseFriends(userId: string, limit: number, now: Date): Promise<CloseFriend[]> {
  const env = getAppEnv();
  const windowStart = addDays(now, -CLOSE_FRIEND_WINDOW_DAYS);
  const scores = new Map<string, number>();

  await addDirectMessageScores(scores, userId, windowStart);
  await addCommunityCommentScores(scores, env, userId, windowStart);
  await addCommunityReactionScores(scores, env, userId, windowStart);
  await addCoEventScores(scores, env, userId, windowStart, now);

  const candidateIds = Array.from(scores.keys());
  if (!candidateIds.length) return [];

  const mutualSet = await getUserMutualSet(userId, candidateIds);
  const ranked = candidateIds
    .filter((id) => mutualSet.has(id))
    .map((id) => ({ friendUserId: id, score: Math.round(scores.get(id) ?? 0) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked;
}

export async function getCloseFriends(userId: string, opts?: { limit?: number; now?: Date }) {
  const now = opts?.now ?? new Date();
  const limit = Math.min(Math.max(opts?.limit ?? CLOSE_FRIEND_LIMIT_DEFAULT, 1), 50);

  const cached = await prisma.userCloseFriend.findMany({
    where: { userId, expiresAt: { gt: now } },
    orderBy: [{ rank: "asc" }],
    take: limit,
    select: { friendUserId: true, score: true },
  });
  if (cached.length) {
    return cached.map((row) => ({ friendUserId: row.friendUserId, score: row.score ?? 0 }));
  }

  const computed = await computeCloseFriends(userId, limit, now);
  const expiresAt = addDays(now, CLOSE_FRIEND_CACHE_DAYS);

  await prisma.$transaction(async (tx) => {
    await tx.userCloseFriend.deleteMany({ where: { userId } });
    if (computed.length) {
      await tx.userCloseFriend.createMany({
        data: computed.map((entry, index) => ({
          userId,
          friendUserId: entry.friendUserId,
          score: entry.score,
          rank: index + 1,
          computedAt: now,
          expiresAt,
        })),
      });
    }
  });

  return computed;
}
