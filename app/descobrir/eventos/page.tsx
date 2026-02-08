import { Suspense } from "react";
import ExplorarSkeleton from "../_explorar/ExplorarSkeleton";
import { ExplorarContent } from "../_explorar/ExplorarContent";

export default function ExplorarEventosPage() {
  return (
    <Suspense fallback={<ExplorarSkeleton initialWorld="EVENTOS" />}>
      <ExplorarContent initialWorld="EVENTOS" />
    </Suspense>
  );
}
