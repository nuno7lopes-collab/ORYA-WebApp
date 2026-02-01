import { z } from "zod";

export const EventListItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  venueName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
});

export const EventListResponseSchema = z.object({
  ok: z.boolean().optional(),
  data: z.array(EventListItemSchema).optional(),
});

export type EventListItem = z.infer<typeof EventListItemSchema>;
