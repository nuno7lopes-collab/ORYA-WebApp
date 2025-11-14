"use client";

import Link from "next/link";
import useUser from "../hooks/useUser";
import LogoutButton from "./LogoutBtn"; // 👈 é ESTE caminho

export default function Navbar() {
  const { user, loading } = useUser();

  return (
    <nav className="flex justify-between items-center p-4 bg-[#0a0a0f] text-white">
      <Link href="/" className="text-xl font-bold">ORYA</Link>

      <div className="flex items-center gap-4">
        <Link href="/explorar">Explorar</Link>
        <Link href="/pesquisar">Pesquisar</Link>
        <Link href="/criar-evento">Criar Evento</Link>

        {loading ? null : user ? (
          <>
            <Link href="/me" className="px-3 py-1 bg-white text-black rounded">
              O meu perfil
            </Link>

            <LogoutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1 bg-gradient-to-r from-[#FF00C8] to-[#6BFFFF]
             text-black rounded"
          >
            Entrar
          </Link>
        )}
      </div>
    </nav>
  );
}