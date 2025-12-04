import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Utilitário para limpar cookies locais (incluindo os sb- do Supabase) quando ficam corrompidos.
export async function POST() {
  try {
    const store = await cookies();
    const all = store.getAll();

    for (const c of all) {
      try {
        store.set({
          name: c.name,
          value: "",
          path: c.path ?? "/",
          maxAge: 0,
        });
      } catch (err) {
        console.error("[api/auth/clear] erro a limpar cookie", c.name, err);
      }
    }

    return NextResponse.json({ ok: true, cleared: all.map((c) => c.name) });
  } catch (err) {
    console.error("[api/auth/clear] erro inesperado:", err);
    return NextResponse.json({ ok: false, error: "CLEAR_FAILED" }, { status: 500 });
  }
}
