"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function WalletDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/me/carteira?entitlementId=${params.id}`);
    } else {
      router.replace("/me/carteira");
    }
  }, [params?.id, router]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="relative orya-page-width px-4 py-10">
        <p className="text-sm text-white/70">A redirecionar...</p>
      </div>
    </main>
  );
}
