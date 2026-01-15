import { Suspense } from "react";
import MobileTopBar from "@/app/components/mobile/MobileTopBar";
import { ExplorarContent } from "@/app/explorar/_components/ExplorarContent";

export default function ProcurarPage() {
  return (
    <>
      <MobileTopBar />
      <Suspense fallback={null}>
        <ExplorarContent initialWorld="EVENTOS" />
      </Suspense>
    </>
  );
}
