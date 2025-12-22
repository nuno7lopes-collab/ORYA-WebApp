import { redirect } from "next/navigation";

export default function PadelTournamentRedirect() {
  redirect("/organizador/eventos/novo?preset=padel");
}
