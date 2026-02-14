export const runtime = "nodejs";

import type { ReactNode } from "react";
import ModuleGuardLayout from "@/app/org/_internal/core/(dashboard)/_components/ModuleGuardLayout";

export default async function InscricoesLayout({ children }: { children: ReactNode }) {
  return <ModuleGuardLayout requiredModules={["INSCRICOES"]}>{children}</ModuleGuardLayout>;
}
