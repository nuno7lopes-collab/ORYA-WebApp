import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const usernameParam = searchParams.get("username");

  if (!usernameParam) {
    return NextResponse.json(
      { success: false, error: "Username em falta." },
      { status: 400 }
    );
  }

  const res = NextResponse.next();
  const { supabase } = createSupabaseServer(req, res);

  // 1) Buscar perfil pelo username
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      full_name,
      bio,
      avatar_url,
      city,
      favourite_categories,
      show_profile,
      show_events,
      show_interests
    `
    )
    .eq("username", usernameParam.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("PUBLIC PROFILE ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar o perfil." },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { success: false, error: "Perfil não encontrado." },
      { status: 404 }
    );
  }

  // 2) Respeitar privacidade do perfil
  if (profile.show_profile === false) {
    return NextResponse.json(
      {
        success: false,
        error: "Este perfil é privado.",
      },
      { status: 403 }
    );
  }

  // 3) Se show_events = true, buscar eventos públicos onde ele vai
  let events: {
    id: string;
    title: string;
    city: string | null;
    start_at: string | null;
  }[] = [];

  if (profile.show_events !== false) {
    const { data: rows, error: eventsError } = await supabase
      .from("event_participants")
      .select(
        `
        event_id,
        events!inner (
          id,
          title,
          city,
          start_at
        )
      `
      )
      .eq("user_id", profile.id)
      .order("start_at", { referencedTable: "events", ascending: true })
      .limit(10);

    if (eventsError) {
      console.error("PUBLIC PROFILE EVENTS ERROR:", eventsError);
    } else if (rows) {
      events = rows.map((row: any) => ({
        id: row.events.id,
        title: row.events.title,
        city: row.events.city,
        start_at: row.events.start_at,
      }));
    }
  }

  // 4) Respeitar show_interests para os interesses
  const safeFavouriteCategories =
    profile.show_interests === false
      ? []
      : profile.favourite_categories || [];

  return NextResponse.json({
    success: true,
    profile: {
      username: profile.username,
      full_name: profile.full_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      city: profile.city,
      favourite_categories: safeFavouriteCategories,
    },
    events,
  });
}