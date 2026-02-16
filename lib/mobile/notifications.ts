import { resolveMobileLink, type ResolvedMobileLink } from "./links";

export type ResolvedNotificationLink = ResolvedMobileLink;

export const resolveNotificationLink = (input?: string | null): ResolvedNotificationLink =>
  resolveMobileLink(input, { source: "notifications", allowWeb: true });
