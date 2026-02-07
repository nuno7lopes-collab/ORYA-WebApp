export type ServicePolicy = {
  id: number;
  name: string;
  policyType: string;
  cancellationWindowMinutes: number;
};

export type ServicePack = {
  id: number;
  quantity: number;
  packPriceCents: number;
  label: string | null;
  recommended: boolean;
};

export type ServiceDetail = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  kind: "GENERAL" | "COURT" | "CLASS";
  categoryTag: string | null;
  locationMode: string | null;
  addressId: string | null;
  addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  instructor: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
    publicDescription: string | null;
    publicWebsite: string | null;
    publicInstagram: string | null;
    timezone: string | null;
    reservationAssignmentMode: string | null;
    addressId: string | null;
    addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  };
  packs: ServicePack[];
  policy: ServicePolicy | null;
};
