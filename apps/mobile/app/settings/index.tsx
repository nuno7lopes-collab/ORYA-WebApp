import {
  ActivityIndicator,
  Alert,
  Linking as RNLinking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens, useTranslation } from "@orya/shared";
import { useRouter } from "expo-router";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { SettingsToggle } from "../../components/settings/SettingsToggle";
import { SettingsButton } from "../../components/settings/SettingsButton";
import { SettingsModal } from "../../components/settings/SettingsModal";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { useMemo, useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchConsents, fetchNotificationPrefs, updateConsent, updateEmail, updateSettings } from "../../features/settings/api";
import { ConsentItem, NotificationPrefs, Visibility } from "../../features/settings/types";
import { supabase } from "../../lib/supabase";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { getMobileEnv } from "../../lib/env";
import { INTEREST_OPTIONS, InterestId } from "../../features/onboarding/types";
import { Image } from "expo-image";
import { api } from "../../lib/api";
import { getPushPermissionStatus, registerForPushToken, requestPushPermission } from "../../lib/push";
import { useI18n, type Locale } from "../../lib/i18n";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const navigation = useNavigation();
  const topPadding = useTopHeaderPadding(24);
  const bottomPadding = useTabBarPadding();
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const queryClient = useQueryClient();
  const env = getMobileEnv();
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const termsUrl = `${baseUrl}/termos`;
  const privacyUrl = `${baseUrl}/privacidade`;
  const manifest = (Constants as any)?.manifest as { version?: string } | undefined;
  const version = Constants.expoConfig?.version ?? manifest?.version ?? "1.0.0";
  const deletePhrase = t("settings:session.deletePhrase");
  const deletePhraseUpper = deletePhrase.toUpperCase();
  const languageOptions: { value: Locale; label: string }[] = [
    { value: "pt-PT", label: t("settings:language.pt-PT") },
    { value: "en-US", label: t("settings:language.en-US") },
    { value: "es-ES", label: t("settings:language.es-ES") },
  ];
  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, "/(tabs)/profile")}
      accessibilityRole="button"
      accessibilityLabel={t("common:actions.back")}
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          minHeight: tokens.layout.touchTarget,
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
      hitSlop={10}
    >
      <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );

  const profileQuery = useProfileSummary(true, accessToken, userId);
  const profile = profileQuery.data ?? null;

  const prefsQuery = useQuery({
    queryKey: ["settings", "prefs", userId ?? "anon"],
    queryFn: () => fetchNotificationPrefs(accessToken),
    enabled: Boolean(accessToken),
  });

  const consentsQuery = useQuery({
    queryKey: ["settings", "consents", userId ?? "anon"],
    queryFn: () => fetchConsents(accessToken),
    enabled: Boolean(accessToken),
  });

  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [savingVisibility, setSavingVisibility] = useState(false);

  const [interests, setInterests] = useState<InterestId[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    allowEmailNotifications: true,
    allowSocialNotifications: true,
    allowEventNotifications: true,
    allowSystemNotifications: true,
    allowMarketingNotifications: true,
    allowSalesAlerts: true,
    allowEventReminders: true,
    allowFollowRequests: true,
    allowMarketingCampaigns: true,
    allowSystemAnnouncements: true,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "undetermined" | "unavailable">("undetermined");
  const [pushBusy, setPushBusy] = useState(false);

  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentSaving, setConsentSaving] = useState<Record<string, boolean>>({});

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!profile?.email) return;
    setEmail(profile.email);
  }, [profile?.email]);

  useEffect(() => {
    if (!profile?.visibility) return;
    setVisibility(profile.visibility as Visibility);
  }, [profile?.visibility]);

  useEffect(() => {
    if (!profile?.favouriteCategories) return;
    setInterests(profile.favouriteCategories as InterestId[]);
  }, [profile?.favouriteCategories]);

  useEffect(() => {
    if (!prefsQuery.data) return;
    setNotificationPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  useEffect(() => {
    if (!consentsQuery.data) return;
    setConsents(consentsQuery.data);
  }, [consentsQuery.data]);

  const refreshPushStatus = useCallback(() => {
    getPushPermissionStatus()
      .then((result) => setPushStatus(result.status))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshPushStatus();
  }, [refreshPushStatus]);

  useFocusEffect(
    useCallback(() => {
      refreshPushStatus();
    }, [refreshPushStatus]),
  );

  const handlePushPermission = async () => {
    if (pushBusy) return;
    if (pushStatus === "denied") {
      RNLinking.openSettings().catch(() => undefined);
      return;
    }
    setPushBusy(true);
    try {
      const result = await requestPushPermission();
      setPushStatus(result.status);
      if (result.granted && accessToken) {
        const token = await registerForPushToken();
        if (token) {
          await api.requestWithAccessToken("/api/me/push-tokens", accessToken, {
            method: "POST",
            body: JSON.stringify({ token, platform: "ios" }),
          });
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  const emailDirty = useMemo(() => {
    const current = email.trim().toLowerCase();
    const baseline = (profile?.email ?? "").trim().toLowerCase();
    return Boolean(current && current !== baseline);
  }, [email, profile?.email]);

  const visibilityDirty = useMemo(() => {
    const baseline = (profile?.visibility ?? "PUBLIC") as Visibility;
    return visibility !== baseline;
  }, [visibility, profile?.visibility]);

  const interestsDirty = useMemo(() => {
    const baseline = (profile?.favouriteCategories ?? []) as InterestId[];
    const left = [...interests].sort().join("|");
    const right = [...baseline].sort().join("|");
    return left !== right;
  }, [interests, profile?.favouriteCategories]);

  const notificationsDirty = useMemo(() => {
    const baseline = prefsQuery.data;
    if (!baseline) return false;
    return (
      notificationPrefs.allowEmailNotifications !== baseline.allowEmailNotifications ||
      notificationPrefs.allowSocialNotifications !== baseline.allowSocialNotifications ||
      notificationPrefs.allowEventNotifications !== baseline.allowEventNotifications ||
      notificationPrefs.allowSystemNotifications !== baseline.allowSystemNotifications ||
      notificationPrefs.allowMarketingNotifications !== baseline.allowMarketingNotifications ||
      notificationPrefs.allowSalesAlerts !== baseline.allowSalesAlerts ||
      notificationPrefs.allowEventReminders !== baseline.allowEventReminders ||
      notificationPrefs.allowFollowRequests !== baseline.allowFollowRequests ||
      notificationPrefs.allowMarketingCampaigns !== baseline.allowMarketingCampaigns ||
      notificationPrefs.allowSystemAnnouncements !== baseline.allowSystemAnnouncements
    );
  }, [notificationPrefs, prefsQuery.data]);

  const handleEmailSave = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setEmailMessage(t("settings:messages.invalidEmail"));
      return;
    }
    setEmailSaving(true);
    setEmailMessage(null);
    try {
      const nextEmail = await updateEmail(normalized, accessToken);
      setEmail(nextEmail);
      setEmailMessage(t("settings:messages.emailUpdated"));
      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
    } catch {
      setEmailMessage(t("settings:messages.emailUpdateFailed"));
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (resetting) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setEmailMessage(t("settings:messages.resetInvalidEmail"));
      return;
    }
    setResetting(true);
    setEmailMessage(null);
    try {
      await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: Linking.createURL("auth/callback"),
      });
      setEmailMessage(t("settings:messages.resetSent"));
    } catch {
      setEmailMessage(t("settings:messages.resetFailed"));
    } finally {
      setResetting(false);
    }
  };

  const handleSaveVisibility = async () => {
    if (!visibilityDirty) return;
    setSavingVisibility(true);
    try {
      await updateSettings({ visibility }, accessToken);
      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
    } catch {
      Alert.alert(t("common:labels.error"), t("settings:messages.privacySaveFailed"));
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleSaveInterests = async () => {
    if (!interestsDirty) return;
    setSavingInterests(true);
    try {
      await updateSettings({ favouriteCategories: interests }, accessToken);
      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
    } catch {
      Alert.alert(t("common:labels.error"), t("settings:messages.interestsSaveFailed"));
    } finally {
      setSavingInterests(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!notificationsDirty) return;
    setSavingNotifications(true);
    try {
      await updateSettings({ ...notificationPrefs }, accessToken);
      await api.requestWithAccessToken("/api/notifications/prefs", accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPrefs),
      });
      prefsQuery.refetch();
    } catch {
      Alert.alert(t("common:labels.error"), t("settings:messages.notificationsSaveFailed"));
    } finally {
      setSavingNotifications(false);
    }
  };

  const toggleInterest = (interest: InterestId) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((item) => item !== interest);
      if (prev.length >= 6) return prev;
      return [...prev, interest];
    });
  };

  const handleConsentToggle = async (
    organizationId: number,
    type: "MARKETING" | "CONTACT_EMAIL" | "CONTACT_SMS",
    granted: boolean,
  ) => {
    const key = `${organizationId}:${type}`;
    setConsentSaving((prev) => ({ ...prev, [key]: true }));
    setConsentError(null);
    const previous = consents;
    setConsents((prev) =>
      prev.map((item) =>
        item.organization.id === organizationId
          ? { ...item, consents: { ...item.consents, [type]: granted } }
          : item,
      ),
    );
    try {
      await updateConsent(organizationId, type, granted, accessToken);
    } catch {
      setConsents(previous);
      setConsentError(t("settings:messages.consentSaveFailed"));
    } finally {
      setConsentSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace({ pathname: "/auth", params: { next: "/settings" } });
    } catch {
      Alert.alert(t("common:labels.error"), t("settings:messages.logoutFailed"));
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== deletePhraseUpper) return;
    setDeleting(true);
    try {
      await api.requestWithAccessToken("/api/me/settings/delete", accessToken, { method: "POST" });
      await supabase.auth.signOut();
      router.replace({ pathname: "/auth", params: { next: "/settings" } });
    } catch {
      Alert.alert(t("common:labels.error"), t("settings:messages.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader scrollState={topBar} variant="title" title={t("settings:title")} leftSlot={backButton} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPadding, paddingBottom: bottomPadding + 24 },
        ]}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection
          title={t("settings:sections.account.title")}
          subtitle={t("settings:sections.account.subtitle")}
        >
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("settings:fields.email")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("settings:fields.emailPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              accessibilityLabel={t("settings:fields.email")}
            />
          </View>
          {emailMessage ? <Text style={styles.helperText}>{emailMessage}</Text> : null}
          <View style={styles.rowButtons}>
            <SettingsButton
              label={t("settings:account.updateEmail")}
              onPress={handleEmailSave}
              disabled={!emailDirty || emailSaving}
              loading={emailSaving}
              loadingLabel={t("settings:account.updating")}
              variant="primary"
              style={{ flex: 1 }}
            />
            <SettingsButton
              label={resetting ? t("settings:account.sending") : t("settings:account.resetPassword")}
              onPress={handlePasswordReset}
              disabled={resetting}
              loading={resetting}
              loadingLabel={t("settings:account.sending")}
              variant="secondary"
              style={{ flex: 1 }}
            />
          </View>
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.privacy.title")}
          subtitle={t("settings:sections.privacy.subtitle")}
        >
          <View style={styles.optionRow}>
            {([
              { key: "PUBLIC", label: t("settings:privacy.public") },
              { key: "FOLLOWERS", label: t("settings:privacy.followers") },
              { key: "PRIVATE", label: t("settings:privacy.private") },
            ] as { key: Visibility; label: string }[]).map((option) => {
              const active = visibility === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setVisibility(option.key)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.radioOption,
                    active ? styles.radioOptionActive : null,
                  ]}
                >
                  <View style={[styles.radioDot, active ? styles.radioDotActive : null]} />
                  <Text style={[styles.radioLabel, active ? styles.radioLabelActive : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <SettingsButton
            label={t("settings:privacy.save")}
            onPress={handleSaveVisibility}
            disabled={!visibilityDirty || savingVisibility}
            loading={savingVisibility}
            variant="primary"
            style={{ alignSelf: "stretch" }}
          />
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.interests.title")}
          subtitle={t("settings:sections.interests.subtitle")}
        >
          <View style={styles.interestGrid}>
            {INTEREST_OPTIONS.map((interest) => {
              const active = interests.includes(interest.id);
              const interestLabel = t(`common:interests.${interest.id}`);
              return (
                <Pressable
                  key={interest.id}
                  onPress={() => toggleInterest(interest.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("common:labels.interests")} ${interestLabel}`}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.interestChip,
                    active ? styles.interestChipActive : styles.interestChipIdle,
                  ]}
                >
                  <Text style={[styles.interestLabel, active ? styles.interestLabelActive : null]}>
                    {interestLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>
            {t("settings:interests.selectedCount", { count: interests.length })}
          </Text>
          <SettingsButton
            label={t("settings:interests.save")}
            onPress={handleSaveInterests}
            disabled={!interestsDirty || savingInterests}
            loading={savingInterests}
            variant="primary"
            style={{ alignSelf: "stretch" }}
          />
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.notifications.title")}
          subtitle={t("settings:sections.notifications.subtitle")}
        >
          {prefsQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="rgba(255,255,255,0.7)" />
              <Text style={styles.helperText}>{t("settings:notifications.loading")}</Text>
            </View>
          ) : (
            <View style={styles.stack}>
              <SettingsToggle
                label={t("settings:notifications.social")}
                value={notificationPrefs.allowSocialNotifications}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    allowSocialNotifications: next,
                    allowFollowRequests: next,
                  }))
                }
              />
              <SettingsToggle
                label={t("settings:notifications.events")}
                value={notificationPrefs.allowEventNotifications}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    allowEventNotifications: next,
                    allowEventReminders: next,
                  }))
                }
              />
              <SettingsToggle
                label={t("settings:notifications.system")}
                value={notificationPrefs.allowSystemNotifications}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    allowSystemNotifications: next,
                    allowSystemAnnouncements: next,
                  }))
                }
              />
              <SettingsToggle
                label={t("settings:notifications.marketing")}
                value={notificationPrefs.allowMarketingNotifications}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    allowMarketingNotifications: next,
                    allowMarketingCampaigns: next,
                  }))
                }
              />
              <SettingsToggle
                label={t("settings:notifications.sales")}
                value={notificationPrefs.allowSalesAlerts}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({ ...prev, allowSalesAlerts: next }))
                }
              />
              <SettingsToggle
                label={t("settings:notifications.news")}
                value={notificationPrefs.allowEmailNotifications}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({ ...prev, allowEmailNotifications: next }))
                }
              />
            </View>
          )}
          <View style={styles.pushRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pushTitle}>{t("settings:notifications.pushTitle")}</Text>
              <Text style={styles.helperText}>{t("settings:notifications.pushSubtitle")}</Text>
            </View>
            {pushStatus === "granted" ? (
              <View style={styles.pushBadge}>
                <Text style={styles.pushBadgeText}>{t("settings:notifications.pushActive")}</Text>
              </View>
            ) : pushStatus === "unavailable" ? (
              <View style={styles.pushBadgeMuted}>
                <Text style={styles.pushBadgeTextMuted}>
                  {t("settings:notifications.pushUnavailable")}
                </Text>
              </View>
            ) : (
              <SettingsButton
                label={
                  pushStatus === "denied"
                    ? t("settings:notifications.pushOpenSettings")
                    : t("settings:notifications.pushEnable")
                }
                onPress={handlePushPermission}
                loading={pushBusy}
                variant="secondary"
                style={{ alignSelf: "flex-start" }}
              />
            )}
          </View>
          <SettingsButton
            label={t("settings:notifications.save")}
            onPress={handleSaveNotifications}
            disabled={!notificationsDirty || savingNotifications}
            loading={savingNotifications}
            variant="primary"
            style={{ alignSelf: "stretch" }}
          />
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.language.title")}
          subtitle={t("settings:sections.language.subtitle")}
        >
          <View style={styles.stack}>
            {languageOptions.map((option) => {
              const active = locale === option.value;
              return (
                <SettingsRow
                  key={option.value}
                  label={option.label}
                  onPress={() => setLocale(option.value)}
                  disabled={active}
                  trailing={
                    active ? (
                      <Ionicons name="checkmark" size={18} color="rgba(255,255,255,0.9)" />
                    ) : null
                  }
                />
              );
            })}
          </View>
        </SettingsSection>

        <SettingsSection
          title={t("settings:consents.title")}
          subtitle={t("settings:consents.subtitle")}
        >
          {consentError ? <Text style={styles.errorText}>{consentError}</Text> : null}
          {consentsQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="rgba(255,255,255,0.7)" />
              <Text style={styles.helperText}>{t("settings:consents.loading")}</Text>
            </View>
          ) : consents.length === 0 ? (
            <Text style={styles.helperText}>{t("settings:consents.empty")}</Text>
          ) : (
            <View style={styles.stack}>
              {consents.map((item) => {
                const orgName =
                  item.organization.publicName ||
                  item.organization.businessName ||
                  item.organization.username ||
                  t("settings:consents.orgFallback");
                const orgUsername = item.organization.username ?? null;
                return (
                  <View key={item.organization.id} style={styles.consentCard}>
                    <Pressable
                      onPress={() => {
                        if (orgUsername) {
                          router.push({ pathname: "/[username]", params: { username: orgUsername } });
                        }
                      }}
                      disabled={!orgUsername}
                      style={styles.consentHeader}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings:consents.openOrg", { name: orgName })}
                      accessibilityState={{ disabled: !orgUsername }}
                    >
                      {item.organization.brandingAvatarUrl ? (
                        <Image source={{ uri: item.organization.brandingAvatarUrl }} style={styles.orgAvatar} />
                      ) : (
                        <View style={styles.orgAvatarFallback}>
                          <Ionicons name="business" size={16} color="rgba(255,255,255,0.9)" />
                        </View>
                      )}
                      <Text style={styles.orgName}>{orgName}</Text>
                    </Pressable>
                    <View style={styles.stack}>
                      {(["MARKETING", "CONTACT_EMAIL", "CONTACT_SMS"] as const).map((type) => {
                        const savingKey = `${item.organization.id}:${type}`;
                        const label =
                          type === "MARKETING"
                            ? t("settings:consents.marketing")
                            : type === "CONTACT_EMAIL"
                              ? t("settings:consents.contactEmail")
                              : t("settings:consents.contactSms");
                        return (
                          <SettingsToggle
                            key={type}
                            label={label}
                            value={item.consents[type]}
                            onValueChange={(next) =>
                              handleConsentToggle(item.organization.id, type, next)
                            }
                            disabled={consentSaving[savingKey]}
                          />
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.session.title")}
          subtitle={t("settings:sections.session.subtitle")}
        >
          <View style={styles.rowButtons}>
            <SettingsButton
              label={t("settings:session.signOut")}
              onPress={handleLogout}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <SettingsButton
              label={t("settings:session.delete")}
              onPress={() => setDeleteModalOpen(true)}
              variant="danger"
              style={{ flex: 1 }}
            />
          </View>
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.legal.title")}
          subtitle={t("settings:sections.legal.subtitle")}
        >
          <View style={styles.stack}>
            <Pressable
              style={styles.linkRow}
              onPress={() => Linking.openURL(termsUrl)}
              accessibilityRole="link"
              accessibilityLabel={t("settings:legal.openTerms")}
            >
              <Text style={styles.linkLabel}>{t("settings:legal.terms")}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable
              style={styles.linkRow}
              onPress={() => Linking.openURL(privacyUrl)}
              accessibilityRole="link"
              accessibilityLabel={t("settings:legal.openPrivacy")}
            >
              <Text style={styles.linkLabel}>{t("settings:legal.privacy")}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <View style={styles.versionRow}>
              <Text style={styles.helperText}>{t("settings:legal.version", { version })}</Text>
            </View>
          </View>
        </SettingsSection>
      </ScrollView>

      <SettingsModal
        visible={deleteModalOpen}
        title={t("settings:session.deleteModalTitle")}
        subtitle={t("settings:session.deleteModalSubtitle")}
        confirmLabel={t("settings:session.deleteConfirmLabel")}
        cancelLabel={t("common:actions.cancel")}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeleteConfirm("");
        }}
        onConfirm={handleDeleteAccount}
        confirmInputLabel={t("settings:session.deleteInputLabel")}
        confirmInputValue={deleteConfirm}
        onConfirmInputChange={setDeleteConfirm}
        confirmPlaceholder={deletePhraseUpper}
        confirmDisabled={deleteConfirm.trim().toUpperCase() !== deletePhraseUpper}
        confirmLoading={deleting}
      />
    </LiquidBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: tokens.spacing.lg,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: tokens.layout.touchTarget,
  },
  backText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
  },
  helperText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
  },
  errorText: {
    color: "rgba(255,150,160,0.9)",
    fontSize: 12,
  },
  rowButtons: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  optionRow: {
    flexDirection: "column",
    gap: tokens.spacing.sm,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
  },
  radioOptionActive: {
    borderColor: "rgba(107,255,255,0.5)",
    backgroundColor: "rgba(107,255,255,0.08)",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  radioDotActive: {
    backgroundColor: "rgba(107,255,255,0.9)",
    borderColor: "rgba(107,255,255,0.9)",
  },
  radioLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  radioLabelActive: {
    color: "#E8F6FF",
    fontWeight: "600",
  },
  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  interestChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  interestChipIdle: {
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  interestChipActive: {
    borderColor: "rgba(107,255,255,0.8)",
    backgroundColor: "rgba(107,255,255,0.24)",
  },
  interestLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "600",
  },
  interestLabelActive: {
    color: "#EAFBFF",
  },
  stack: {
    gap: tokens.spacing.sm,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  consentCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: tokens.spacing.sm,
  },
  consentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  pushRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  pushTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "700",
  },
  pushBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(76, 217, 100, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(76, 217, 100, 0.5)",
  },
  pushBadgeText: {
    color: "rgba(210,255,220,0.95)",
    fontSize: 12,
    fontWeight: "700",
  },
  pushBadgeMuted: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  pushBadgeTextMuted: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "700",
  },
  orgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  orgAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  orgName: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
  },
  linkLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  versionRow: {
    alignItems: "flex-start",
  },
});
