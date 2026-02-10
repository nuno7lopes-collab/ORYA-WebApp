"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRefundsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/finance#reembolsos");
  }, [router]);

  return null;
}
