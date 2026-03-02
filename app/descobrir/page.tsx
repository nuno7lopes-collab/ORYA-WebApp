import { Suspense } from "react";
import ExplorarSkeleton from "./_explorar/ExplorarSkeleton";
import { ExplorarContent } from "./_explorar/ExplorarContent";
import { DiscoverPadelTabsContent } from "./_explorar/DiscoverPadelTabsContent";
import { isDiscoverV2TabsEnabled } from "@/lib/featureFlags";

export default function ExplorarLandingPage() {
  const discoverV2TabsEnabled = isDiscoverV2TabsEnabled();

  return (
    <Suspense fallback={<ExplorarSkeleton initialWorld="PADEL" />}>
      {discoverV2TabsEnabled ? (
        <DiscoverPadelTabsContent />
      ) : (
        <ExplorarContent initialWorld="PADEL" hideWorldTabs />
      )}
    </Suspense>
  );
}
