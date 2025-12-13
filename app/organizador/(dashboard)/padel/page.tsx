export const runtime = "nodejs";

import { redirect } from "next/navigation";

// LEGACY – hub de Padel vive em /organizador?tab=padel
export default async function OrganizerPadelPage() {
  redirect("/organizador?tab=padel");
}
