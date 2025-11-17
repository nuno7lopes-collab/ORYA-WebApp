// app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabaseServer"; // ⚠️ se o nome da função for diferente, ajusta aqui

export const runtime = "nodejs";

const BUCKET_NAME = "avatars";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    // 1) Garantir que o utilizador está autenticado
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Avatar upload: utilizador não autenticado", userError);
      return NextResponse.json(
        { success: false, error: "not_authenticated" },
        { status: 401 }
      );
    }

    // 2) Ler o ficheiro enviado no form-data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "file_missing" },
        { status: 400 }
      );
    }

    // 3) Construir um path único dentro do bucket
    const originalName = file.name || "avatar.jpg";
    const ext = originalName.includes(".")
      ? originalName.split(".").pop()
      : "jpg";

    const filePath = `${user.id}/${randomUUID()}.${ext}`;

    // 4) Converter File -> Buffer (necessário para o SDK no Node)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5) Upload para o bucket "avatars"
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        upsert: true,
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
      });

    if (uploadError || !uploadData) {
      console.error(
        "Erro ao fazer upload para Supabase Storage:",
        uploadError
      );
      return NextResponse.json(
        { success: false, error: "upload_failed" },
        { status: 500 }
      );
    }

    // 6) Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path);

    const publicUrl = publicUrlData.publicUrl;

    // 7) Atualizar o perfil na tabela "profiles"
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error(
        "Erro a atualizar profiles.avatar_url depois do upload:",
        updateError
      );
      // Mesmo que falhe o update, o upload correu bem – devolvemos o URL
    }

    return NextResponse.json({
      success: true,
      avatar_url: publicUrl,
    });
  } catch (err) {
    console.error("Erro inesperado em /api/profile/avatar:", err);
    return NextResponse.json(
      { success: false, error: "internal_error" },
      { status: 500 }
    );
  }
}