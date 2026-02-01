import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { api } from "../../lib/api";
import { EventListItem, EventListResponseSchema, i18n } from "@orya/shared";

const fetchEvents = async (): Promise<EventListItem[]> => {
  const data = await api.request<any>("/api/eventos/list");
  const parsed = EventListResponseSchema.safeParse(data);
  if (parsed.success && parsed.data?.data) return parsed.data.data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export default function DiscoverScreen() {
  const t = i18n.pt.discover;
  const { data = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  return (
    <View className="flex-1 bg-[#0b101a] px-6 pt-14">
      <Text className="text-white text-2xl font-semibold mb-6">{t.title}</Text>
      {isLoading ? (
        <Text className="text-white/60">A carregar…</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.slug ?? item.id)}
          renderItem={({ item }) => (
            <Link href={`/event/${item.slug}`} asChild>
              <TouchableOpacity className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <Text className="text-white font-semibold">{item.title}</Text>
                {item.venueName ? (
                  <Text className="text-white/60 text-xs mt-1">{item.venueName}</Text>
                ) : null}
              </TouchableOpacity>
            </Link>
          )}
          ListEmptyComponent={
            <Text className="text-white/60">Sem eventos publicados.</Text>
          }
        />
      )}
    </View>
  );
}
