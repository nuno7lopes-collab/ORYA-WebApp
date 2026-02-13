import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { fetchGeoAutocomplete, fetchGeoDetails, type MobileGeoAutocompleteItem, type MobileGeoDetailsItem } from "../../features/discover/location";
import { tokens } from "@orya/shared";

export type AddressSelection = {
  addressId: string;
  label: string;
  formattedAddress?: string | null;
  canonical?: Record<string, unknown> | null;
  sourceProvider?: string | null;
  providerId?: string | null;
};

type AddressPickerProps = {
  value?: AddressSelection | null;
  onSelect: (selection: AddressSelection) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
};

export function AddressPicker({ value, onSelect, onClear, placeholder, label }: AddressPickerProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MobileGeoAutocompleteItem[]>([]);

  useEffect(() => {
    if (value?.label && value.label !== query) {
      setQuery(value.label);
    }
  }, [value?.label]);

  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setResults([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchGeoAutocomplete(query.trim())
        .then((items) => {
          if (!active) return;
          setResults(items);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "Não foi possível carregar moradas.");
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = async (item: MobileGeoAutocompleteItem) => {
    if (!item.providerId) return;
    setDetailsLoading(true);
    setError(null);
    try {
      const details: MobileGeoDetailsItem | null = await fetchGeoDetails(item.providerId, {
        sourceProvider: item.sourceProvider ?? null,
        lat: item.lat,
        lng: item.lng,
      });
      if (!details?.addressId) {
        throw new Error("Morada inválida.");
      }
      onSelect({
        addressId: details.addressId,
        label: details.formattedAddress ?? item.label,
        formattedAddress: details.formattedAddress ?? null,
        canonical: details.canonical ?? null,
        sourceProvider: details.sourceProvider ?? item.sourceProvider ?? null,
        providerId: details.providerId ?? item.providerId ?? null,
      });
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível validar esta morada.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const showResults = results.length > 0 && !detailsLoading;

  return (
    <View className="gap-2">
      {label ? <Text className="text-white text-sm font-semibold">{label}</Text> : null}
      <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder ?? "Procurar morada"}
          placeholderTextColor="rgba(255,255,255,0.45)"
          className="text-white text-sm"
          style={{ minHeight: tokens.layout.touchTarget - 12 }}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      {(loading || detailsLoading) && (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color="white" />
          <Text className="text-white/70 text-xs">A procurar moradas...</Text>
        </View>
      )}
      {error ? <Text className="text-rose-200 text-xs">{error}</Text> : null}
      {value && onClear ? (
        <Pressable onPress={onClear} className="self-start rounded-full border border-white/10 px-3 py-1">
          <Text className="text-white/70 text-xs">Limpar morada</Text>
        </Pressable>
      ) : null}
      {showResults ? (
        <View className="gap-2">
          {results.map((item) => (
            <Pressable
              key={`${item.providerId}-${item.lat}-${item.lng}`}
              onPress={() => handleSelect(item)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Text className="text-white text-sm">{item.label}</Text>
              {item.secondaryLabel || item.city || item.address ? (
                <Text className="text-white/60 text-xs">
                  {[item.secondaryLabel, item.address, item.city].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
