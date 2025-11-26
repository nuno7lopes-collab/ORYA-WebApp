import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventIdParam = searchParams.get("eventId");
    const eventId = eventIdParam ? Number(eventIdParam) : null;

    if (!eventId || Number.isNaN(eventId)) {
      return NextResponse.json({ joined: false }, { status: 200 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ joined: false }, { status: 200 });
    }

    const participant = await prisma.experienceParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: user.id,
        },
      },
    });

    return NextResponse.json({ joined: !!participant }, { status: 200 });
  } catch (err) {
    console.error("[experiencias/join/status] error", err);
    return NextResponse.json({ joined: false }, { status: 200 });
  }
}
