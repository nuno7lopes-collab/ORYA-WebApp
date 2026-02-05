"use client";

import { CheckinScanner } from "@/app/components/checkin/CheckinScanner";
import { cn } from "@/lib/utils";

type OrganizationScanPageProps = {
  embedded?: boolean;
};

export default function OrganizationScanPage({ embedded }: OrganizationScanPageProps) {
  const wrapperClass = cn(
    embedded ? "space-y-6 text-white" : "w-full space-y-6 py-8 text-white",
  );

  return (
    <div className={wrapperClass}>
      <CheckinScanner
        backHref="/organizacao/manage"
        backLabel="Ver gestão"
        title="Modo Receção · Organização"
        subtitle="Check-in em 2 passos com confirmação explícita."
        allowOrganizationEvents
        embedded
        showBackLink={false}
      />
    </div>
  );
}
