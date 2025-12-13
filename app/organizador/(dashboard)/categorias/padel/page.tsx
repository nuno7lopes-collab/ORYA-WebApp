import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default function PadelCategoryPage() {
  redirect("/organizador?tab=padel");
}
