import { Suspense } from "react";
import { ExplorarContent } from "../_components/ExplorarContent";

export default function ExplorarReservasPage() {
  return (
    <Suspense fallback={null}>
      <ExplorarContent initialWorld="RESERVAS" />
    </Suspense>
  );
}
