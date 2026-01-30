import { AdminLayout } from "@/app/admin/components/AdminLayout";
import InfraClient from "@/app/admin/infra/InfraClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminInfraPage() {
  return (
    <AdminLayout
      title="Infra & Deploy"
      subtitle="Controlos de deploy, pausa e rotação de secrets com auditoria e requestId."
    >
      <InfraClient />
    </AdminLayout>
  );
}
