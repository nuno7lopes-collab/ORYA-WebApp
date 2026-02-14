export const runtime = "nodejs";

import type { ReactNode } from "react";

export default async function MensagensLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
