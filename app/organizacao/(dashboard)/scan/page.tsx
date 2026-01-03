"use client";

import { CheckinScanner } from "@/app/components/checkin/CheckinScanner";
import ObjectiveSubnav from "@/app/organizacao/ObjectiveSubnav";

type OrganizationScanPageProps = {
  embedded?: boolean;
};

export default function OrganizationScanPage({ embedded }: OrganizationScanPageProps) {
  const wrapperClass = embedded ? "space-y-6 text-white" : "w-full px-4 py-8 space-y-6 text-white md:px-6 lg:px-8";

  return (
    <div className={wrapperClass}>
      {!embedded && <ObjectiveSubnav objective="manage" activeId="checkin" />}
      <CheckinScanner
        backHref="/organizacao?tab=manage"
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
