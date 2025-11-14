// app/api/profile/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: false });
  const { supabase } = createSupabaseServer(req, res);

  // Autenticado?
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user)
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  // Campos permitidos
  const allowedFields = [
    "username",
    "full_name",
    "bio",
    "birthdate",
    "gender",
    "phone",
    "favourite_categories",
    "city",
    "notify_events_near",
    "user_mode",
    "instagram",
    "tiktok",
    "show_profile",
    "show_events",
    "show_interests",
  ];

  const updateData: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) updateData[key] = body[key];
  }

  // Username -> lowercase
  if (updateData.username) {
    updateData.username = updateData.username.toLowerCase();

    // Verificar se já existe
    const { data: exists } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", updateData.username)
      .neq("id", auth.user.id)
      .maybeSingle();

    if (exists)
      return NextResponse.json(
        { success: false, error: "Esse username já está em uso." },
        { status: 400 }
      );
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", auth.user.id);

  if (error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}