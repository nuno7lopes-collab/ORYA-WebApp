"use client";

import ObjectiveSubnav from "@/app/organizacao/ObjectiveSubnav";
import { DASHBOARD_CARD, DASHBOARD_LABEL, DASHBOARD_MUTED, DASHBOARD_TITLE } from "@/app/organizacao/dashboardUi";

export default function ClubMembrosPage() {
  return (
    <div className="space-y-6">
      <ObjectiveSubnav objective="manage" activeId="membros" mode="page" />

      <div>
        <p className={DASHBOARD_LABEL}>Clube</p>
        <h1 className={DASHBOARD_TITLE}>Membros</h1>
        <p className={DASHBOARD_MUTED}>Funcionalidade fora do MVP.</p>
      </div>

      <section className={`${DASHBOARD_CARD} p-5`}>
        <p className="text-sm text-white/70">
          Este modulo fica fora do MVP. Vamos retomar quando a base estiver estabilizada.
        </p>
      </section>
    </div>
  );
}
