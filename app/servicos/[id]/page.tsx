import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function ServicoRedirectPage({ params }: PageProps) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    notFound();
  }

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      isActive: true,
      organization: {
        status: "ACTIVE",
        OR: [
          { primaryModule: "RESERVAS" },
          { organizationModules: { some: { moduleKey: "RESERVAS", enabled: true } } },
        ],
      },
    },
    select: {
      id: true,
      organization: { select: { username: true } },
    },
  });

  if (!service || !service.organization?.username) {
    notFound();
  }

  redirect(`/${service.organization.username}?serviceId=${service.id}`);
}
