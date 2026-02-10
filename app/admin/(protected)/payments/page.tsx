"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPaymentsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/finance#pagamentos");
  }, [router]);

  return null;
}
