import { Suspense } from "react";
import ExplorarSkeleton from "./_components/ExplorarSkeleton";
import { ExplorarContent } from "./_components/ExplorarContent";

export default function ExplorarLandingPage() {
  return (
    <Suspense fallback={<ExplorarSkeleton initialWorld="EVENTOS" />}>
      <ExplorarContent initialWorld="EVENTOS" />
    </Suspense>
  );
}
