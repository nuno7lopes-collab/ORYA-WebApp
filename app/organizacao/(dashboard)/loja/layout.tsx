import type { ReactNode } from "react";
import ModuleGuardLayout from "../_components/ModuleGuardLayout";

export default function LojaLayout({ children }: { children: ReactNode }) {
  return <ModuleGuardLayout requiredModules={["LOJA"]}>{children}</ModuleGuardLayout>;
}
