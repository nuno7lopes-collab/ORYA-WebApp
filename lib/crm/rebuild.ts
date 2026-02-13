import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RebuildResult = {
  consentReset: number;
  consentUpdated: number;
  contactsVisibilityUpdated: number;
  contactTotalsUpdated: number;
  contactNotesUpdated: number;
  contactNotesZeroed: number;
};

export async function rebuildCrmContacts(options?: { organizationId?: number | null }): Promise<RebuildResult> {
  const organizationId =
    typeof options?.organizationId === "number" && Number.isFinite(options.organizationId)
      ? options.organizationId
      : null;

  const orgFilter = organizationId ? Prisma.sql`AND organization_id = ${organizationId}` : Prisma.empty;
  const orgFilterAlias = organizationId ? Prisma.sql`AND c.organization_id = ${organizationId}` : Prisma.empty;

  const consentReset = await prisma.$executeRaw(Prisma.sql`
    UPDATE app_v3.crm_contacts c
    SET
      marketing_email_opt_in = FALSE,
      marketing_push_opt_in = FALSE,
      updated_at = now()
    WHERE ${organizationId ? Prisma.sql`c.organization_id = ${organizationId}` : Prisma.sql`TRUE`}
  `);

  const consentUpdated = await prisma.$executeRaw(Prisma.sql`
    UPDATE app_v3.crm_contacts c
    SET
      marketing_email_opt_in = TRUE,
      updated_at = now()
    WHERE EXISTS (
      SELECT 1
      FROM app_v3.crm_contact_consents cc
      WHERE cc.organization_id = c.organization_id
        AND cc.contact_id = c.id
        AND cc.type = 'MARKETING'::app_v3."ConsentType"
        AND cc.status = 'GRANTED'::app_v3."ConsentStatus"
    )
    ${orgFilterAlias}
  `);

  const contactsVisibilityUpdated = await prisma.$executeRaw(Prisma.sql`
    UPDATE app_v3.crm_contacts c
    SET
      contact_email = CASE
        WHEN EXISTS (
          SELECT 1
          FROM app_v3.user_consents uc
          WHERE uc.organization_id = c.organization_id
            AND uc.user_id = c.user_id
            AND uc.type = 'CONTACT_EMAIL'::app_v3."ConsentType"
            AND uc.status = 'GRANTED'::app_v3."ConsentStatus"
        ) THEN u.email
        ELSE NULL
      END,
      contact_phone = CASE
        WHEN EXISTS (
          SELECT 1
          FROM app_v3.user_consents uc
          WHERE uc.organization_id = c.organization_id
            AND uc.user_id = c.user_id
            AND uc.type = 'CONTACT_SMS'::app_v3."ConsentType"
            AND uc.status = 'GRANTED'::app_v3."ConsentStatus"
        ) THEN p.contact_phone
        ELSE NULL
      END,
      updated_at = now()
    FROM app_v3.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE c.user_id = p.id
      ${orgFilterAlias}
  `);

  const contactTotalsUpdated = await prisma.$executeRaw(Prisma.sql`
    UPDATE app_v3.crm_contacts c
    SET
      first_interaction_at = s.first_interaction_at,
      last_activity_at = s.last_activity_at,
      last_purchase_at = s.last_purchase_at,
      total_spent_cents = s.total_spent_cents,
      total_orders = s.total_orders,
      total_bookings = s.total_bookings,
      total_attendances = s.total_attendances,
      total_tournaments = s.total_tournaments,
      total_store_orders = s.total_store_orders,
      updated_at = now()
    FROM (
      SELECT
        organization_id,
        contact_id,
        MIN(occurred_at) AS first_interaction_at,
        MAX(occurred_at) AS last_activity_at,
        MAX(CASE
          WHEN type IN (
            'STORE_ORDER_PAID'::app_v3."CrmInteractionType",
            'EVENT_TICKET'::app_v3."CrmInteractionType",
            'BOOKING_CONFIRMED'::app_v3."CrmInteractionType",
            'PADEL_MATCH_PAYMENT'::app_v3."CrmInteractionType"
          ) THEN occurred_at
        END) AS last_purchase_at,
        COALESCE(SUM(CASE
          WHEN type IN (
            'STORE_ORDER_PAID'::app_v3."CrmInteractionType",
            'EVENT_TICKET'::app_v3."CrmInteractionType",
            'BOOKING_CONFIRMED'::app_v3."CrmInteractionType",
            'PADEL_MATCH_PAYMENT'::app_v3."CrmInteractionType"
          ) THEN amount_cents ELSE 0 END), 0) AS total_spent_cents,
        COUNT(CASE WHEN type = 'EVENT_TICKET'::app_v3."CrmInteractionType" THEN 1 END) AS total_orders,
        COUNT(CASE WHEN type = 'BOOKING_CONFIRMED'::app_v3."CrmInteractionType" THEN 1 END) AS total_bookings,
        COUNT(CASE WHEN type = 'EVENT_CHECKIN'::app_v3."CrmInteractionType" THEN 1 END) AS total_attendances,
        COUNT(CASE WHEN type = 'PADEL_TOURNAMENT_ENTRY'::app_v3."CrmInteractionType" THEN 1 END) AS total_tournaments,
        COUNT(CASE WHEN type = 'STORE_ORDER_PAID'::app_v3."CrmInteractionType" THEN 1 END) AS total_store_orders
      FROM app_v3.crm_interactions
      WHERE contact_id IS NOT NULL
      ${orgFilter}
      GROUP BY organization_id, contact_id
    ) s
    WHERE c.organization_id = s.organization_id AND c.id = s.contact_id
  `);

  const contactNotesUpdated = await prisma.$executeRaw(Prisma.sql`
    UPDATE app_v3.crm_contacts c
    SET notes_count = COALESCE(n.notes_count, 0)
    FROM (
      SELECT organization_id, contact_id, COUNT(*) AS notes_count
      FROM app_v3.crm_contact_notes
      WHERE 1=1
      ${orgFilter}
      GROUP BY organization_id, contact_id
    ) n
    WHERE c.id = n.contact_id AND c.organization_id = n.organization_id
  `);

  const contactNotesZeroed = await prisma.$executeRaw(Prisma.sql`
    UPDATE app_v3.crm_contacts c
    SET notes_count = 0
    WHERE ${organizationId ? Prisma.sql`c.organization_id = ${organizationId}` : Prisma.sql`TRUE`}
      AND NOT EXISTS (
        SELECT 1 FROM app_v3.crm_contact_notes n
        WHERE n.contact_id = c.id
      )
  `);

  return {
    consentReset: Number(consentReset),
    consentUpdated: Number(consentUpdated),
    contactsVisibilityUpdated: Number(contactsVisibilityUpdated),
    contactTotalsUpdated: Number(contactTotalsUpdated),
    contactNotesUpdated: Number(contactNotesUpdated),
    contactNotesZeroed: Number(contactNotesZeroed),
  };
}
