import { redirect } from "next/navigation";

export default function PadelTournamentRedirect() {
  redirect("/organizacao/eventos/novo?preset=padel");
}
