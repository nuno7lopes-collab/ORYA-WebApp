import { events } from '../data/events';
import EventCard from './components/EventCard';
import Ring from './components/Ring';
import LogoutButton from "./components/LogoutBtn";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">

      <div className="w-full flex justify-center mt-10">
        <LogoutButton />
      </div>

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 pt-32 pb-28 flex flex-col md:flex-row items-center justify-between gap-20">
        
        {/* LEFT TEXT */}
        <div className="md:w-1/2 text-center md:text-left">
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight">
            <span className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-transparent">
              A nova forma de descobrir<br/>e viver a cidade.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 mt-6 max-w-md">
            Eventos, experiências e momentos reais — tudo num só lugar.
          </p>

          <a
            href="/explorar"
            className="mt-8 inline-block bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold py-3 px-8 rounded-xl shadow-lg shadow-[#6bffff33] hover:scale-105 transition-all"
          >
            Explorar eventos →
          </a>
        </div>

        {/* RIGHT SIDE RING */}
        <div className="md:w-1/2 flex justify-center">
          <Ring size={280} />
        </div>
      </section>

            {/* SECTION - EVENTOS EM DESTAQUE */}
      <section className="max-w-7xl mx-auto px-6 mt-10">
        <h2 className="text-3xl font-bold mb-6">Eventos em destaque</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.slice(0, 3).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        <a
          href="/explorar"
          className="block mt-6 text-[#6BFFFF] hover:text-white transition"
        >
          Ver mais eventos →
        </a>
      </section>

      {/* NOTIFICAÇÃO DO LANÇAMENTO */}
      <section className="max-w-7xl mx-auto px-6 mt-32 text-center">
        <h2 className="text-3xl font-bold">
          A nova app ORYA está a chegar
        </h2>
        <p className="text-white/70 mt-3 max-w-xl mx-auto">
          Recebe uma notificação quando a app ficar disponível.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <input
            type="email"
            placeholder="O teu email"
            className="px-4 py-3 w-64 rounded-lg bg-white/10 border border-white/20 outline-none text-white"
          />
          <button className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-3 rounded-lg font-semibold text-black">
            Notificar-me
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-32 py-16 border-t border-white/10 bg-[#0b0b10] text-center">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-10 text-white/70">

          <div>
            <h3 className="font-semibold text-white mb-2">ORYA</h3>
            <p>A plataforma social de eventos.</p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">Links</h3>
            <ul className="space-y-1">
              <li><a href="/sobre" className="hover:text-white">Sobre a ORYA</a></li>
              <li><a href="/privacidade" className="hover:text-white">Privacidade</a></li>
              <li><a href="/seguranca" className="hover:text-white">Segurança</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">Redes sociais</h3>
            <ul className="space-y-1">
              <li><a href="#" className="hover:text-white">Instagram</a></li>
              <li><a href="#" className="hover:text-white">TikTok</a></li>
            </ul>
          </div>

        </div>

        <p className="text-white/40 mt-10 text-sm">© {new Date().getFullYear()} ORYA. Todos os direitos reservados.</p>
      </footer>

    </main>
  );
}