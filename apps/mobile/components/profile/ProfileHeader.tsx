import { Pressable, Text, View } from "react-native";
import type React from "react";
import { Image } from "expo-image";
import { Ionicons } from "../icons/Ionicons";
import { PROFILE_HEADER_TOKENS as T } from "./profileTokens";

type Counts = {
  followers: number;
  following: number;
  events: number;
};

type Props = {
  isUser: boolean;
  coverUrl?: string | null;
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  counts: Counts;
  onCoverPress?: () => void;
  onAvatarPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  rightActions?: React.ReactNode;
  nameNode?: React.ReactNode;
  usernameNode?: React.ReactNode;
  bioNode?: React.ReactNode;
};

export function ProfileHeader({
  isUser,
  coverUrl,
  avatarUrl,
  displayName,
  username,
  bio,
  counts,
  onCoverPress,
  onAvatarPress,
  onFollowersPress,
  onFollowingPress,
  rightActions,
  nameNode,
  usernameNode,
  bioNode,
}: Props) {
  const coverHasImage = Boolean(coverUrl);
  const coverEditable = Boolean(onCoverPress);
  const avatarEditable = Boolean(onAvatarPress);

  return (
    <View className="gap-5">
      <View style={{ position: "relative" }}>
        <Pressable
          onPress={onCoverPress}
          disabled={!coverEditable}
          accessibilityRole={coverEditable ? "button" : "image"}
          accessibilityLabel={coverEditable ? "Alterar capa do perfil" : "Capa do perfil"}
          accessibilityState={{ disabled: !coverEditable }}
          style={{
            height: T.coverHeight,
            borderRadius: T.coverRadius,
            overflow: "hidden",
            borderWidth: coverHasImage ? 1 : 0,
            borderColor: coverHasImage ? T.coverBorderColor : "transparent",
            backgroundColor: coverHasImage ? T.coverOverlayColor : T.coverFallbackColor,
          }}
        >
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
              transition={160}
            />
          ) : null}
          {coverEditable ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(8,12,20,0.5)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="camera" size={14} color="rgba(255,255,255,0.95)" />
            </View>
          ) : null}
        </Pressable>

        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -T.avatarOffset,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={onAvatarPress}
            disabled={!avatarEditable}
            accessibilityRole={avatarEditable ? "button" : "image"}
            accessibilityLabel={avatarEditable ? "Alterar foto de perfil" : "Foto de perfil"}
            accessibilityState={{ disabled: !avatarEditable }}
            style={{
              width: T.avatarSize,
              height: T.avatarSize,
              borderRadius: T.avatarRadius,
              borderWidth: 0,
              borderColor: "transparent",
              backgroundColor: T.avatarFallbackColor,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: T.avatarSize, height: T.avatarSize }} contentFit="cover" />
            ) : (
              <Ionicons name={isUser ? "person" : "business"} size={28} color="rgba(255,255,255,0.8)" />
            )}
            {avatarEditable ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: 4,
                  bottom: 4,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: "rgba(8,12,20,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="camera" size={12} color="rgba(255,255,255,0.95)" />
              </View>
            ) : null}
          </Pressable>
        </View>

        {rightActions ? (
          <View style={{ position: "absolute", right: 12, top: 12, flexDirection: "row", gap: 10 }}>
            {rightActions}
          </View>
        ) : null}
      </View>

      <View style={{ paddingTop: T.identityPaddingTop, gap: T.identityGap, alignItems: "center" }}>
        {nameNode ?? (
          <Text className="text-white text-2xl font-semibold" numberOfLines={1}>
            {displayName ?? "Perfil"}
          </Text>
        )}
        {usernameNode ??
          (username ? <Text className="text-white/60 text-sm">@{username}</Text> : null)}
        {bioNode ??
          (bio ? (
            <Text className="text-white/70 text-sm text-center" numberOfLines={3}>
              {bio}
            </Text>
          ) : null)}
      </View>

      <View className="flex-row justify-center gap-8">
        <Pressable
          onPress={onFollowersPress}
          disabled={!onFollowersPress}
          accessibilityRole={onFollowersPress ? "button" : "text"}
          accessibilityLabel="Ver seguidores"
          accessibilityState={{ disabled: !onFollowersPress }}
          className="items-center"
        >
          <Text className="text-white text-base font-semibold">{counts.followers}</Text>
          <Text className="text-white/60 text-xs">Seguidores</Text>
        </Pressable>
        <Pressable
          onPress={onFollowingPress}
          disabled={!onFollowingPress}
          accessibilityRole={onFollowingPress ? "button" : "text"}
          accessibilityLabel="Ver a seguir"
          accessibilityState={{ disabled: !onFollowingPress }}
          className="items-center"
        >
          <Text className="text-white text-base font-semibold">{counts.following}</Text>
          <Text className="text-white/60 text-xs">A seguir</Text>
        </Pressable>
        <View className="items-center">
          <Text className="text-white text-base font-semibold">{counts.events}</Text>
          <Text className="text-white/60 text-xs">Eventos</Text>
        </View>
      </View>
    </View>
  );
}
