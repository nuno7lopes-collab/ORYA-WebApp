import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default function PadelCategoryPage() {
  redirect("/organizacao/torneios?section=padel-hub&padel=categories");
}
