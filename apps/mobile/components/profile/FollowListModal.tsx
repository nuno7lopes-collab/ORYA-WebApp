import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "../icons/Ionicons";
import { GlassCard } from "../liquid/GlassCard";
import { useRouter } from "expo-router";
import { FollowListItem } from "../../features/network/types";

type Props = {
  open: boolean;
  title: string;
  items?: FollowListItem[];
  isLoading: boolean;
  isError?: boolean;
  emptyLabel: string;
  onClose: () => void;
  onRetry?: () => void;
};

export function FollowListModal({
  open,
  title,
  items,
  isLoading,
  isError,
  emptyLabel,
  onClose,
  onRetry,
}: Props) {
  const router = useRouter();
  const list = items ?? [];

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 }}
      >
        <Pressable onPress={(event) => event.stopPropagation()} style={{ width: "100%" }}>
          <GlassCard intensity={60}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-sm font-semibold">{title}</Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>

            {isLoading ? (
              <ActivityIndicator color="rgba(255,255,255,0.8)" />
            ) : isError ? (
              <View className="gap-3">
                <Text className="text-white/70 text-sm">Não foi possível carregar.</Text>
                {onRetry ? (
                  <Pressable onPress={onRetry} className="rounded-xl bg-white/10 px-4 py-3">
                    <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {list.map((item) => (
                  <Pressable
                    key={item.userId}
                    onPress={() => {
                      if (item.username) {
                        onClose();
                        router.push({ pathname: "/[username]", params: { username: item.username } });
                      }
                    }}
                    className="flex-row items-center gap-3 py-2"
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: "rgba(255,255,255,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={{ width: 36, height: 36 }} />
                      ) : (
                        <Ionicons
                          name={item.kind === "organization" ? "business" : "person"}
                          size={18}
                          color="rgba(255,255,255,0.8)"
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-white text-sm font-semibold">{item.fullName ?? "Perfil"}</Text>
                      {item.username ? <Text className="text-white/60 text-xs">@{item.username}</Text> : null}
                    </View>
                  </Pressable>
                ))}
                {list.length === 0 ? (
                  <Text className="text-white/60 text-xs">{emptyLabel}</Text>
                ) : null}
              </ScrollView>
            )}
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
