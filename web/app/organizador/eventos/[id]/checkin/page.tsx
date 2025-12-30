import { notFound } from "next/navigation";
import { CheckinScanner } from "@/app/components/checkin/CheckinScanner";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: { id: string };
};

export default async function OrganizerEventCheckinPage({ params }: PageProps) {
  const eventId = Number(params.id);
  if (!Number.isFinite(eventId)) {
    notFound();
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { templateType: true },
  });
  if (!event) {
    notFound();
  }
  const isPadel = event.templateType === "PADEL";

  return (
    <div className="w-full px-4 py-8 space-y-6 text-white md:px-6 lg:px-8">
      <CheckinScanner
        backHref={`/organizador/eventos/${eventId}`}
        backLabel={isPadel ? "Voltar ao torneio" : "Voltar ao evento"}
        title={isPadel ? "Check-in do torneio" : "Check-in do evento"}
        subtitle="Confirma entradas com validação rápida e segura."
        eventIdOverride={eventId}
        embedded
        showBackLink={false}
      />
    </div>
  );
}
