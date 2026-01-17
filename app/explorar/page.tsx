import { Suspense } from "react";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import { ExplorarContent } from "./_components/ExplorarContent";

export default function ExplorarLandingPage() {
  return (
    <>
      <MobileTopBar />
      <Suspense fallback={null}>
        <ExplorarContent initialWorld="EVENTOS" />
      </Suspense>
    </>
  );
}
