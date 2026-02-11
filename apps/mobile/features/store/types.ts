export type StoreResolvedState =
  | "DISABLED"
  | "HIDDEN"
  | "LOCKED"
  | "CHECKOUT_DISABLED"
  | "ACTIVE";

export type StoreCatalogStore = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  resolvedState: StoreResolvedState;
  catalogAvailable: boolean;
  checkoutAvailable: boolean;
  currency: string;
  freeShippingThresholdCents: number | null;
  supportEmail: string | null;
  supportPhone: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsUrl: string | null;
};

export type StoreCategory = {
  id: number;
  name: string;
  slug: string;
};

export type StoreCatalogProduct = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  category: {
    id: number;
    name: string;
    slug: string;
  } | null;
  images: Array<{
    url: string;
    altText: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
};

export type StoreCatalogBundle = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  pricingMode: "FIXED" | "PERCENT_DISCOUNT";
  priceCents: number | null;
  percentOff: number | null;
  baseCents: number;
  totalCents: number;
  discountCents: number;
  currency: string;
  items: Array<{
    id: number;
    quantity: number;
    product: {
      id: number;
      name: string;
      slug: string;
      image: {
        url: string;
        altText: string | null;
        isPrimary: boolean;
        sortOrder: number;
      } | null;
    };
    variant: { id: number; label: string | null } | null;
  }>;
};

export type StoreCatalogResponse = {
  store: StoreCatalogStore;
  categories: StoreCategory[];
  products: StoreCatalogProduct[];
  bundles: StoreCatalogBundle[];
};

export type StoreProductOptionValue = {
  id: number;
  value: string;
  label: string | null;
  priceDeltaCents: number;
};

export type StoreProductOption = {
  id: number;
  label: string;
  optionType: "TEXT" | "SELECT" | "NUMBER" | "CHECKBOX";
  required: boolean;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  priceDeltaCents: number;
  values: StoreProductOptionValue[];
};

export type StoreProductVariant = {
  id: number;
  label: string;
  priceCents: number | null;
  stockQty: number | null;
  isActive: boolean;
};

export type StoreProductResponse = {
  store: {
    id: number;
    username: string;
    displayName: string;
    resolvedState: StoreResolvedState;
    currency: string;
  };
  product: {
    id: number;
    name: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    priceCents: number;
    compareAtPriceCents: number | null;
    currency: string;
    requiresShipping: boolean;
    stockPolicy: "NONE" | "TRACKED";
    stockQty: number | null;
    category: {
      id: number;
      name: string;
      slug: string;
    } | null;
    images: Array<{
      url: string;
      altText: string | null;
      isPrimary: boolean;
      sortOrder: number;
    }>;
    variants: StoreProductVariant[];
    options: StoreProductOption[];
    shippingEta: {
      minDays: number | null;
      maxDays: number | null;
    } | null;
  };
};

export type StoreCartStandaloneItem = {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  unitPriceCents: number;
  personalization: Record<string, unknown> | null;
  product: {
    id: number;
    name: string;
    slug: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    currency: string;
    requiresShipping: boolean;
    images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
  };
  variant: { id: number; label: string; priceCents: number | null } | null;
};

export type StoreCartBundle = {
  bundleKey: string;
  bundleId: number | null;
  name: string;
  description: string | null;
  pricingMode: "FIXED" | "PERCENT_DISCOUNT";
  priceCents: number | null;
  percentOff: number | null;
  baseCents: number;
  totalCents: number;
  discountCents: number;
  quantity: number;
  items: Array<{
    id: number;
    productId: number;
    variantId: number | null;
    quantity: number;
    perBundleQty: number;
    unitPriceCents: number;
    product: {
      id: number;
      name: string;
      slug: string;
      priceCents: number;
      compareAtPriceCents: number | null;
      currency: string;
      requiresShipping: boolean;
      images: Array<{ url: string; altText: string | null; isPrimary: boolean; sortOrder: number }>;
    };
    variant: { id: number; label: string; priceCents: number | null } | null;
  }>;
};

export type StoreCart = {
  id: string;
  storeId: number;
  currency: string;
  items: StoreCartStandaloneItem[];
  bundles: StoreCartBundle[];
};

export type StoreCartResponse = {
  cart: StoreCart;
};

export type StoreShippingMethod = {
  id: number;
  zoneId: number;
  name: string;
  description: string | null;
  baseRateCents: number;
  mode: "FLAT" | "VALUE_TIERS";
  freeOverCents: number | null;
  isDefault: boolean;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  available: boolean;
  shippingCents: number | null;
  freeOverRemainingCents: number | null;
  methodFreeOverRemainingCents: number | null;
};

export type StoreShippingMethodsResponse = {
  zone: { id: number; name: string };
  methods: StoreShippingMethod[];
};

export type StoreShippingQuote = {
  shippingCents: number;
  zoneId: number;
  methodId: number;
  methodName: string;
  freeOverRemainingCents: number | null;
  methodFreeOverRemainingCents: number | null;
};

export type StoreShippingQuoteResponse = {
  quote: StoreShippingQuote;
};

export type StoreBundlesResponse = {
  items: StoreCatalogBundle[];
};

export type StoreCheckoutPrefill = {
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  shippingAddress: {
    addressId: string;
    fullName: string;
    formattedAddress: string | null;
    nif: string | null;
  } | null;
  billingAddress: {
    addressId: string;
    fullName: string;
    formattedAddress: string | null;
    nif: string | null;
  } | null;
};

export type StoreCheckoutPayload = {
  customer: {
    email: string;
    name: string;
    phone?: string | null;
  };
  shippingAddress?: {
    addressId: string;
    fullName: string;
    nif?: string | null;
  } | null;
  billingAddress?: {
    addressId: string;
    fullName: string;
    nif?: string | null;
  } | null;
  shippingMethodId?: number | null;
  notes?: string | null;
  idempotencyKey?: string;
  promoCode?: string | null;
};

export type StoreCheckoutResponse = {
  orderId: number;
  orderNumber: string;
  purchaseId: string;
  paymentIntentId: string;
  clientSecret: string | null;
  amountCents: number;
  discountCents: number;
  currency: string;
  shippingCents: number;
  shippingZoneId: number | null;
  shippingMethodId: number | null;
  freeCheckout: boolean;
  status: string;
  final: boolean;
};

export type StorePurchaseListItem = {
  id: number;
  orderNumber: string | null;
  status: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  store: {
    id: number;
    displayName: string;
    username: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
  };
  shipping: {
    zoneName: string | null;
    methodName: string | null;
    etaMinDays: number | null;
    etaMaxDays: number | null;
    address: {
      addressId: string;
      formattedAddress: string | null;
    } | null;
  };
  shipments: Array<{
    id: number;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    createdAt: string;
  }>;
  lines: Array<{
    id: number;
    name: string;
    slug: string | null;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    requiresShipping: boolean;
    variantLabel: string | null;
    image: {
      url: string;
      altText: string | null;
    } | null;
  }>;
};

export type StorePurchasesResponse = {
  items: StorePurchaseListItem[];
  nextCursor: string | null;
};

export type StorePurchaseDetail = {
  id: number;
  orderNumber: string | null;
  status: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  paymentStatus: string;
  store: {
    id: number;
    displayName: string;
    username: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
  };
  shipping: {
    zoneName: string | null;
    methodName: string | null;
    etaMinDays: number | null;
    etaMaxDays: number | null;
    address: {
      fullName: string;
      addressId: string;
      formattedAddress: string | null;
      nif: string | null;
    } | null;
  };
  billing: {
    fullName: string;
    addressId: string;
    formattedAddress: string | null;
    nif: string | null;
  } | null;
  shipments: Array<{
    id: number;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  timeline: Array<{
    key: string;
    status: string;
    title: string;
    description: string;
    occurredAt: string;
    complete: boolean;
  }>;
  lines: Array<{
    id: number;
    name: string;
    slug: string | null;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    requiresShipping: boolean;
    variantLabel: string | null;
    image: {
      url: string;
      altText: string | null;
    } | null;
    personalization: Array<{ label: string; value: string; priceDeltaCents: number }>;
  }>;
};

export type StoreDigitalGrant = {
  id: number;
  downloadsCount: number;
  expiresAt: string | null;
  createdAt: string;
  order: {
    id: number;
    orderNumber: string | null;
    createdAt: string;
  };
  store: {
    id: number;
    displayName: string;
    username: string | null;
  };
  product: {
    id: number;
    name: string;
    slug: string;
  };
  assets: Array<{
    id: number;
    productId: number;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    maxDownloads: number | null;
    isActive: boolean;
    createdAt: string;
  }>;
};
