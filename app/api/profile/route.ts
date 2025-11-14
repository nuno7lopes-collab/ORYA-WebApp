import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

// ------------------------
// GET - Ler perfil
// ------------------------
export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const { supabase } = createSupabaseServer(req, res);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("PROFILE GET ERROR:", profileError);
    return NextResponse.json({ success: false, error: "Erro ao carregar o perfil" }, { status: 500 });
  }

  return NextResponse.json({ success: true, profile });
}

// ------------------------
// PUT - Atualizar perfil
// ------------------------
export async function PUT(req: NextRequest) {
  const res = NextResponse.next();
  const { supabase } = createSupabaseServer(req, res);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const user = userData.user;
  const body = await req.json();

  // Normalizar username
  const username = body.username?.trim().toLowerCase() || null;

  // Payload FINAL usando apenas colunas reais da DB
  const updatePayload = {
    id: user.id,
    username,
    full_name: body.full_name ?? null,
    bio: body.bio ?? null,
    avatar_url: body.avatar_url ?? null,
    birthdate: body.birthdate?.trim() === "" ? null : body.birthdate,
    gender: body.gender ?? null,
    phone: body.phone ?? null,

    // LOCALIZAÇÃO — só city porque é o que existe na DB
    city: body.city ?? null,

    // MODO
    user_mode: body.mode ?? null,

    // INTERESSES
    favourite_categories: body.favourite_categories ?? [],

    // PRIVACIDADE
    show_profile: body.show_profile ?? true,
    show_events: body.show_events ?? true,
    show_interests: body.show_interests ?? true,

    // REDES
    instagram: body.instagram ?? null,
    tiktok: body.tiktok ?? null,
  };

  // Verificar duplicado de username
  if (username) {
    const { data: existing, error: usernameErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();

    if (usernameErr) {
      console.error("USERNAME CHECK ERROR:", usernameErr);
      return NextResponse.json(
        { success: false, error: "Erro ao validar o username" },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Esse username já está a ser usado." },
        { status: 409 }
      );
    }
  }

  // Upsert
  const { data, error } = await supabase
    .from("profiles")
    .upsert(updatePayload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("PROFILE UPDATE ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao guardar o perfil" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, profile: data });
}