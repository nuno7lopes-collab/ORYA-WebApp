import { Suspense } from "react";
import ScanClient from "./scan-client";

export const metadata = {
  title: "Scan | ORYA",
};

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70">A preparar scanner…</div>}>
      <ScanClient />
    </Suspense>
  );
}
