import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PerfilRedirectPage() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      redirect("/me");
    }

    const profile = await prisma.profile.findUnique({
      where: { id: data.user.id },
      select: { username: true },
    });

    if (profile?.username) {
      redirect(`/${profile.username}`);
    }
  } catch (err) {
    console.warn("[perfil] falha no redirect", err);
  }

  redirect("/me");
}
