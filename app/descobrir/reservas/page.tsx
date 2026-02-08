import { Suspense } from "react";
import ExplorarSkeleton from "../_explorar/ExplorarSkeleton";
import { ExplorarContent } from "../_explorar/ExplorarContent";

export default function ExplorarReservasPage() {
  return (
    <Suspense fallback={<ExplorarSkeleton initialWorld="RESERVAS" />}>
      <ExplorarContent initialWorld="RESERVAS" />
    </Suspense>
  );
}
