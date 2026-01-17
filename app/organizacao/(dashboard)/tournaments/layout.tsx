export const runtime = "nodejs";

import type { ReactNode } from "react";
import ModuleGuardLayout from "@/app/organizacao/(dashboard)/_components/ModuleGuardLayout";

export default async function TournamentsLayout({ children }: { children: ReactNode }) {
  return <ModuleGuardLayout requiredModules={["TORNEIOS"]}>{children}</ModuleGuardLayout>;
}
