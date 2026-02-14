export const runtime = "nodejs";

import type { ReactNode } from "react";
import ModuleGuardLayout from "@/app/org/_internal/core/(dashboard)/_components/ModuleGuardLayout";

export default async function ReservasLayout({ children }: { children: ReactNode }) {
  return <ModuleGuardLayout requiredModules={["RESERVAS"]}>{children}</ModuleGuardLayout>;
}
