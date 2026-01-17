import { Suspense } from "react";
import { ExplorarContent } from "../_components/ExplorarContent";

export default function ExplorarEventosPage() {
  return (
    <Suspense fallback={null}>
      <ExplorarContent initialWorld="EVENTOS" />
    </Suspense>
  );
}
