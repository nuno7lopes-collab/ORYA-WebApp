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

export type ServiceAddon = {
  id: number;
  label: string;
  description: string | null;
  deltaMinutes: number;
  deltaPriceCents: number;
  maxQty: number | null;
  category: string | null;
  sortOrder: number;
};

export type ServicePackage = {
  id: number;
  label: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  recommended: boolean;
  sortOrder: number;
};

export type ServiceProfessional = {
  id: number;
  name: string;
  roleTitle: string | null;
  avatarUrl: string | null;
  username: string | null;
  fullName: string | null;
};

export type ServiceResource = {
  id: number;
  label: string;
  capacity: number;
  priority: number | null;
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
  locationMode: "FIXED" | "CHOOSE_AT_BOOKING" | string | null;
  addressId: string | null;
  addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
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
  addons?: ServiceAddon[];
  packages?: ServicePackage[];
  professionals?: ServiceProfessional[];
  resources?: ServiceResource[];
  policy: ServicePolicy | null;
};
