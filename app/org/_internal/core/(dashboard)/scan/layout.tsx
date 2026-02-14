export const runtime = "nodejs";

import type { ReactNode } from "react";
import ModuleGuardLayout from "@/app/org/_internal/core/(dashboard)/_components/ModuleGuardLayout";

export default async function ScanLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGuardLayout requiredModules={["EVENTOS", "TORNEIOS"]} mode="any">
      {children}
    </ModuleGuardLayout>
  );
}
