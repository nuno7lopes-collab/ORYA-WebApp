export type GeoAutocompleteItem = {
  providerId: string;
  label: string;
  name: string | null;
  city: string | null;
  address: string | null;
  lat: number;
  lng: number;
  sourceProvider?: string | null;
};

export type GeoDetailsItem = {
  providerId: string | null;
  formattedAddress: string | null;
  components: Record<string, unknown> | null;
  lat: number | null;
  lng: number | null;
  name: string | null;
  city: string | null;
  address: string | null;
  sourceProvider?: string | null;
  addressId?: string | null;
  canonical?: Record<string, unknown> | null;
  confidenceScore?: number | null;
  validationStatus?: string | null;
};

export type GeoProvider = {
  autocomplete: (args: {
    query: string;
    lat?: number | null;
    lng?: number | null;
    limit?: number;
    lang?: string;
  }) => Promise<GeoAutocompleteItem[]>;
  details: (args: {
    providerId: string;
    lang?: string;
  }) => Promise<GeoDetailsItem | null>;
  reverse: (args: {
    lat: number;
    lng: number;
    lang?: string;
  }) => Promise<GeoDetailsItem | null>;
};
