export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/auth/rateLimit";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseLimit(value: string | null) {
  const raw = Number(value ?? "20");
  if (!Number.isFinite(raw)) return 20;
  return Math.min(Math.max(raw, 1), 50);
}

async function _GET(req: NextRequest) {
  try {

    const { user, organization } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 10 * 1000,
      max: 30,
      keyPrefix: "chat:search",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
    if (!query) {
      return jsonWrap({ ok: true, items: [] });
    }

    const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim() ?? null;
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

    const rows = await prisma.$queryRaw<
      Array<{ message_id: string; conversation_id: string; created_at: Date; snippet: string; rank: number }>
    >(Prisma.sql`
      SELECT
        m.id as message_id,
        m.conversation_id,
        m.created_at,
        ts_headline(
          'simple',
          m.body,
          plainto_tsquery('simple', ${query}),
          'MaxWords=14, MinWords=6, ShortWord=2, HighlightAll=true'
        ) as snippet,
        ts_rank(
          to_tsvector('simple', coalesce(m.body, '')),
          plainto_tsquery('simple', ${query})
        ) as rank
      FROM app_v3.chat_conversation_messages m
      JOIN app_v3.chat_conversations c ON c.id = m.conversation_id
      WHERE c.organization_id = ${organization.id}
        AND m.deleted_at IS NULL
        AND m.body IS NOT NULL
        AND to_tsvector('simple', coalesce(m.body, '')) @@ plainto_tsquery('simple', ${query})
        AND EXISTS (
          SELECT 1
          FROM app_v3.chat_conversation_members cm
          WHERE cm.conversation_id = m.conversation_id
            AND cm.user_id = ${user.id}
        )
        ${conversationId ? Prisma.sql`AND m.conversation_id = ${conversationId}` : Prisma.empty}
      ORDER BY rank DESC, m.created_at DESC
      LIMIT ${limit};
    `);

    const items = rows.map((row) => ({
      messageId: row.message_id,
      conversationId: row.conversation_id,
      createdAt: row.created_at.toISOString(),
      snippet: row.snippet,
      rank: Number(row.rank ?? 0),
    }));

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/search error:", err);
    return jsonWrap({ ok: false, error: "Erro ao pesquisar mensagens." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);