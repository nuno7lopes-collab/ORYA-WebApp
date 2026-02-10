"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPayoutsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/finance#payouts");
  }, [router]);

  return null;
}
