import { AdminLayout } from "@/app/admin/components/AdminLayout";
import InfraClient from "./InfraClient";
import { getAppEnv } from "@/lib/appEnv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminInfraPage() {
  const currentEnv = getAppEnv();
  const infraReadOnly = process.env.INFRA_READ_ONLY !== "false";
  return (
    <AdminLayout
      title="Infra & Deploy"
      subtitle="Controlos de deploy, pausa e rotação de secrets com auditoria e requestId."
    >
      <InfraClient initialEnv={currentEnv} infraReadOnly={infraReadOnly} />
    </AdminLayout>
  );
}
