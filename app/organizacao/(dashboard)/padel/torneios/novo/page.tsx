import { redirect } from "next/navigation";

export default function PadelTournamentRedirect() {
  redirect("/organizacao/torneios/novo");
}
