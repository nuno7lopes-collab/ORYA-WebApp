import {
  resolveMobileLink as resolveMobileLinkShared,
  type ResolvedMobileLink,
  type ResolveMobileLinkOptions,
} from "../../../lib/mobile/links";

import { getMobileEnv } from "./env";

export type { ResolvedMobileLink, ResolveMobileLinkOptions };

export const resolveMobileLink = (
  input?: string | null,
  options: ResolveMobileLinkOptions = {},
): ResolvedMobileLink =>
  resolveMobileLinkShared(input, {
    ...options,
    apiBaseUrl: options.apiBaseUrl ?? getMobileEnv().apiBaseUrl,
  });
