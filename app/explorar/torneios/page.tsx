import { Suspense } from "react";
import { ExplorarContent } from "../_components/ExplorarContent";

export default function ExplorarTorneiosPage() {
  return (
    <Suspense fallback={null}>
      <ExplorarContent initialWorld="PADEL" />
    </Suspense>
  );
}
