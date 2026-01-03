import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FormSubmissionClient } from "./FormSubmissionClient";
import { getCustomPremiumProfileModules, isCustomPremiumActive } from "@/lib/organizationPremium";

type Params = { id: string };

export default async function PublicFormPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const formId = Number(id);
  if (!formId || Number.isNaN(formId)) notFound();

  const form = await prisma.organizationForm.findUnique({
    where: { id: formId },
    include: {
      organization: {
        select: {
          id: true,
          status: true,
          publicName: true,
          businessName: true,
          username: true,
          liveHubPremiumEnabled: true,
        },
      },
      fields: { orderBy: { order: "asc" } },
    },
  });

  if (!form || form.organization.status !== "ACTIVE") {
    notFound();
  }

  const premiumActive = isCustomPremiumActive(form.organization);
  const premiumModules = premiumActive ? getCustomPremiumProfileModules(form.organization) ?? {} : {};
  const allowInscricoes = Boolean(premiumModules.inscricoes);
  const isPublic = form.status !== "ARCHIVED";
  if (!isPublic) {
    notFound();
  }

  const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
    where: { organizationId: form.organization.id, moduleKey: "INSCRICOES", enabled: true },
    select: { organizationId: true },
  });

  if (!moduleEnabled || !allowInscricoes) {
    notFound();
  }

  const organizationName =
    form.organization.publicName ||
    form.organization.businessName ||
    form.organization.username ||
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
        organizationName,
        organizationUsername: form.organization.username ?? null,
        capacity: form.capacity ?? null,
        waitlistEnabled: form.waitlistEnabled,
        startAt: form.startAt ? form.startAt.toISOString() : null,
        endAt: form.endAt ? form.endAt.toISOString() : null,
        fields,
      }}
    />
  );
}
