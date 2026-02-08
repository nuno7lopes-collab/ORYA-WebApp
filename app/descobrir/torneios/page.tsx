import { Suspense } from "react";
import ExplorarSkeleton from "../_explorar/ExplorarSkeleton";
import { ExplorarContent } from "../_explorar/ExplorarContent";

export default function ExplorarTorneiosPage() {
  return (
    <Suspense fallback={<ExplorarSkeleton initialWorld="PADEL" />}>
      <ExplorarContent initialWorld="PADEL" />
    </Suspense>
  );
}
