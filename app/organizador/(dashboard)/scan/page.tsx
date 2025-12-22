"use client";

import { CheckinScanner } from "@/app/components/checkin/CheckinScanner";
import ObjectiveSubnav from "@/app/organizador/ObjectiveSubnav";

type OrganizerScanPageProps = {
  embedded?: boolean;
};

export default function OrganizerScanPage({ embedded }: OrganizerScanPageProps) {
  const wrapperClass = embedded ? "space-y-6 text-white" : "w-full px-4 py-8 space-y-6 text-white md:px-6 lg:px-8";

  return (
    <div className={wrapperClass}>
      {!embedded && <ObjectiveSubnav objective="manage" activeId="checkin" />}
      <CheckinScanner
        backHref="/organizador?tab=manage"
        backLabel="Ver gestão"
        title="Modo Receção · Organizador"
        subtitle="Check-in em 2 passos com confirmação explícita."
        allowOrganizerEvents
      />
    </div>
  );
}
