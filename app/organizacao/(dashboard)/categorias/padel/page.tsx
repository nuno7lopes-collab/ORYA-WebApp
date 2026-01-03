import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default function PadelCategoryPage() {
  redirect("/organizacao?tab=manage&section=padel-hub");
}
