import { events } from "@/data/events";
export default function Explorar() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white px-6 py-20">
      <div className="max-w-6xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#FF00C8] to-[#6BFFFF] bg-clip-text text-transparent">
          Explorar eventos
        </h1>
        <p className="text-white/60 mt-3 max-w-xl">
          Descobre o que está a acontecer perto de ti — música, desporto, festas, cultura e muito mais.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        <div className="bg-[#141418] border border-white/10 rounded-2xl overflow-hidden hover:scale-[1.03] transition-transform cursor-pointer">
          <div className="h-48 w-full bg-gradient-to-br from-[#FF00C8] to-[#6BFFFF] opacity-40"></div>

          <div className="p-5">
            <h3 className="text-xl font-semibold">ORYA Open Fly Padel</h3>
            <p className="text-sm text-white/60 mt-1">Porto • 20 Dezembro 2025</p>

            <button className="mt-4 w-full bg-gradient-to-r from-[#FF00C8] to-[#6BFFFF] text-black font-semibold py-2 rounded-lg">
              Saber mais →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}