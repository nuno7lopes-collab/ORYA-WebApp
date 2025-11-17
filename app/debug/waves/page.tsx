// app/npm run dev/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";

type Wave = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  available: boolean;
  isVisible: boolean;
  startsAt: string | null;
  endsAt: string | null;
  totalQuantity: number | null;
  soldQuantity: number;
  remaining: number | null;
  status: string;
};

type EventWithWaves = {
  id: number;
  slug: string;
  title: string;
  description: string;
  isFree: boolean;
  basePrice: number | null;
  coverImageUrl: string | null;
  waves: Wave[];
};

async function getEventsWithWaves(): Promise<EventWithWaves[]> {
  const res = await fetch("http://localhost:3000/api/eventos/com-waves", {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Falha ao buscar /api/eventos/com-waves", res.status);
    return [];
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch (err) {
    console.error("Erro a fazer parse do JSON de /api/eventos/com-waves", err);
    return [];
  }

  if (!data || !Array.isArray(data.events)) {
    console.error("Resposta inesperada de /api/eventos/com-waves", data);
    return [];
  }

  return data.events as EventWithWaves[];
}

export default async function DebugWavesPage() {
  const events = await getEventsWithWaves();

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-semibold mb-6">
        Debug – Eventos &amp; Waves
      </h1>

      {events.length === 0 && (
        <p className="text-sm text-zinc-400">
          Nenhum evento encontrado (ou erro a carregar dados).
        </p>
      )}

      <div className="space-y-6">
        {events.map((event) => (
          <div
            key={event.id}
            className="border border-zinc-800 rounded-2xl p-4 bg-zinc-950"
          >
            <div className="flex items-center justify-between mb-3 gap-4">
              <div>
                <h2 className="text-lg font-semibold">{event.title}</h2>
                <p className="text-xs text-zinc-500">
                  slug: <span className="font-mono">{event.slug}</span>
                </p>
              </div>

              <Link
                href={`/eventos/${event.slug}`}
                className="text-xs px-3 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800 transition"
              >
                Ver página do evento
              </Link>
            </div>

            {event.waves.length === 0 ? (
              <p className="text-sm text-zinc-500">Sem waves para este evento.</p>
            ) : (
              <div className="space-y-2">
                {event.waves.map((w) => {
                  let label = "À VENDA";
                  if (w.status === "sold_out") label = "ESGOTADO";
                  if (w.status === "coming_soon") label = "EM BREVE";
                  if (w.status === "closed") label = "ENCERRADO";

                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2"
                    >
                      <div>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-zinc-400">
                          {w.price} {w.currency} ·{" "}
                          {w.totalQuantity == null
                            ? "Stock ilimitado"
                            : `Vendido: ${w.soldQuantity}/${w.totalQuantity}`}
                          {w.remaining != null &&
                            ` · Restantes: ${w.remaining}`}
                        </div>
                      </div>

                      <span className="text-[11px] px-2 py-1 rounded-full border border-zinc-700">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}