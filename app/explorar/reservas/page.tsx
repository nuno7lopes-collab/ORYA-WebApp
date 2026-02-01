import { Suspense } from "react";
import ExplorarSkeleton from "../_components/ExplorarSkeleton";
import { ExplorarContent } from "../_components/ExplorarContent";

export default function ExplorarReservasPage() {
  return (
    <Suspense fallback={<ExplorarSkeleton initialWorld="RESERVAS" />}>
      <ExplorarContent initialWorld="RESERVAS" />
    </Suspense>
  );
}
