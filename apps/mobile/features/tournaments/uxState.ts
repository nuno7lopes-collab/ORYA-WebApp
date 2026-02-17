export type PairingJoinMode = "INVITE_PARTNER" | "LOOKING_FOR_PARTNER";
export type PaymentMode = "FULL" | "SPLIT";
export type RegistrationPrimaryCta = "CREATE_AND_PAY" | "CREATE_AND_CONTINUE";

export type RegistrationBlockReason =
  | "MISSING_CATEGORY"
  | "REGISTRATION_CLOSED"
  | "MISSING_INVITE_CONTACT"
  | "BUSY"
  | "POLICY_LOCKED";

type RegistrationBlockInput = {
  registrationOpen: boolean;
  hasCategory: boolean;
  joinMode: PairingJoinMode;
  inviteContact: string;
  pairingBusy: boolean;
  padelActionsDisabled: boolean;
};

export const resolveRegistrationBlockReason = (
  input: RegistrationBlockInput,
): RegistrationBlockReason | null => {
  if (!input.hasCategory) return "MISSING_CATEGORY";
  if (!input.registrationOpen) return "REGISTRATION_CLOSED";
  if (input.joinMode === "INVITE_PARTNER" && input.inviteContact.trim().length === 0) {
    return "MISSING_INVITE_CONTACT";
  }
  if (input.pairingBusy) return "BUSY";
  if (input.padelActionsDisabled) return "POLICY_LOCKED";
  return null;
};

export const shouldShowOpenPairingsSection = (
  isLoading: boolean,
  count: number,
): boolean => isLoading || count > 0;

export const shouldShowMyPairingSection = (
  isAuthenticated: boolean,
  isLoading: boolean,
  count: number,
): boolean => isAuthenticated && (isLoading || count > 0);

export const resolveRegistrationPrimaryCtaLabel = (
  paymentMode: PaymentMode,
): RegistrationPrimaryCta => {
  if (paymentMode === "SPLIT") return "CREATE_AND_CONTINUE";
  return "CREATE_AND_PAY";
};
