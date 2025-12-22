import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FormSubmissionClient } from "./FormSubmissionClient";

type Params = { id: string };

export default async function PublicFormPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const formId = Number(id);
  if (!formId || Number.isNaN(formId)) notFound();

  const form = await prisma.organizationForm.findUnique({
    where: { id: formId },
    include: {
      organizer: {
        select: {
          id: true,
          status: true,
          publicName: true,
          businessName: true,
          username: true,
        },
      },
      fields: { orderBy: { order: "asc" } },
    },
  });

  if (!form || form.status !== "PUBLISHED" || form.organizer.status !== "ACTIVE") {
    notFound();
  }

  const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
    where: { organizerId: form.organizer.id, moduleKey: "INSCRICOES", enabled: true },
    select: { organizerId: true },
  });

  if (!moduleEnabled) {
    notFound();
  }

  const organizerName =
    form.organizer.publicName ||
    form.organizer.businessName ||
    form.organizer.username ||
    "Organização";

  const fields = form.fields.map((field) => ({
    id: field.id,
    label: field.label,
    fieldType: field.fieldType,
    required: field.required,
    helpText: field.helpText ?? null,
    placeholder: field.placeholder ?? null,
    options: Array.isArray(field.options)
      ? field.options.map((opt) => String(opt))
      : null,
  }));

  return (
    <FormSubmissionClient
      form={{
        id: form.id,
        title: form.title,
        description: form.description ?? null,
        status: form.status,
        organizerName,
        organizerUsername: form.organizer.username ?? null,
        capacity: form.capacity ?? null,
        waitlistEnabled: form.waitlistEnabled,
        startAt: form.startAt ? form.startAt.toISOString() : null,
        endAt: form.endAt ? form.endAt.toISOString() : null,
        fields,
      }}
    />
  );
}
