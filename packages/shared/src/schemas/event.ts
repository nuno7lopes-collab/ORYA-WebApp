import { z } from "zod";

export const EventListItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  slug: z.string().optional(),
  title: z.string(),
  venueName: z.string().optional().nullable(),
});

export type EventListItem = z.infer<typeof EventListItemSchema>;

export const EventListResponseSchema = z.object({
  data: z.array(EventListItemSchema).optional(),
});
