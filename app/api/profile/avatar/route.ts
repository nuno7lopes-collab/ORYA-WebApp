// app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const { supabase } = createSupabaseServer(req, res);

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { success: false, error: "Ficheiro inválido" },
      { status: 400 }
    );
  }

  // @ts-ignore – Next File é um Blob com .name
  const fileName = `avatars/${userData.user.id}-${Date.now()}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError || !uploadData) {
    console.error("AVATAR UPLOAD ERROR:", uploadError);
    return NextResponse.json(
      { success: false, error: "Erro ao fazer upload da imagem" },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);

  // Guardar URL no perfil
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userData.user.id)
    .select()
    .single();

  if (profileError) {
    console.error("AVATAR PROFILE UPDATE ERROR:", profileError);
    return NextResponse.json(
      { success: false, error: "Imagem enviada mas falhou gravar no perfil" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    avatar_url: publicUrl,
    profile: profileData,
  });
}