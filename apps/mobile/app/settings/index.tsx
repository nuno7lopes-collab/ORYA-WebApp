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
import { safeBack, safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { SettingsToggle } from "../../components/settings/SettingsToggle";
import { SettingsButton } from "../../components/settings/SettingsButton";
import { SettingsModal } from "../../components/settings/SettingsModal";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchConsents, fetchNotificationPrefs, updateConsent, updateEmail, updateSettings } from "../../features/settings/api";
import { ConsentItem, NotificationPrefs, Visibility } from "../../features/settings/types";
import { supabase } from "../../lib/supabase";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { getMobileEnv } from "../../lib/env";
import { INTEREST_OPTIONS, InterestId } from "../../features/onboarding/types";
import { api } from "../../lib/api";
import {
  getPushPermissionStatus,
  type PushPermissionReason,
  requestPushPermission,
  syncPushTokenWithBackend,
} from "../../lib/push";
import { useI18n, type Locale } from "../../lib/i18n";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { resolveSafeHttpUrl } from "../../lib/externalUrl";

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
  const manifestVersion = (
    Constants as unknown as { manifest?: { version?: string } | null }
  ).manifest?.version;
  const version = Constants.expoConfig?.version ?? manifestVersion ?? "1.0.0";
  const deletePhrase = t("settings:session.deletePhrase");
  const deletePhraseUpper = deletePhrase.toUpperCase();
  const languageOptions: { value: Locale; label: string }[] = [
    { value: "pt-PT", label: t("settings:language.pt-PT") },
    { value: "en-US", label: t("settings:language.en-US") },
    { value: "es-ES", label: t("settings:language.es-ES") },
  ];
  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, TAB_PATHNAMES.profile)}
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
  const openLegalUrl = useCallback(
    async (url: string) => {
      const safeUrl = resolveSafeHttpUrl(url);
      if (!safeUrl) {
        Alert.alert("Ligação indisponível", "Não foi possível abrir esta página.");
        return;
      }
      try {
        await RNLinking.openURL(safeUrl);
      } catch {
        Alert.alert("Ligação indisponível", "Não foi possível abrir esta página.");
      }
    },
    [],
  );

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
  const [privacySuccessMessage, setPrivacySuccessMessage] = useState<string | null>(null);
  const [privacyErrorMessage, setPrivacyErrorMessage] = useState<string | null>(null);

  const [interests, setInterests] = useState<InterestId[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [interestsSuccessMessage, setInterestsSuccessMessage] = useState<string | null>(null);
  const [interestsErrorMessage, setInterestsErrorMessage] = useState<string | null>(null);

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
  const [notificationsSuccessMessage, setNotificationsSuccessMessage] = useState<string | null>(null);
  const [notificationsErrorMessage, setNotificationsErrorMessage] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "undetermined" | "unavailable">("undetermined");
  const [pushReason, setPushReason] = useState<PushPermissionReason>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [consentsExpanded, setConsentsExpanded] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentSavedMessage, setConsentSavedMessage] = useState<string | null>(null);
  const [consentSaving, setConsentSaving] = useState<Record<string, boolean>>({});
  const [consentBatchSaving, setConsentBatchSaving] = useState<Record<"MARKETING" | "CONTACT_EMAIL", boolean>>({
    MARKETING: false,
    CONTACT_EMAIL: false,
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const feedbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!profile?.email) return;
    setEmail(profile.email);
  }, [profile?.email]);

  useEffect(() => {
    if (!profile?.visibility) return;
    setVisibility(profile.visibility === "PRIVATE" ? "FOLLOWERS" : (profile.visibility as Visibility));
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

  useEffect(() => {
    return () => {
      feedbackTimers.current.forEach((timer) => clearTimeout(timer));
      feedbackTimers.current = [];
    };
  }, []);

  const showTransientMessage = useCallback((setter: (value: string | null) => void, message: string) => {
    setter(message);
    const timer = setTimeout(() => {
      setter(null);
      feedbackTimers.current = feedbackTimers.current.filter((entry) => entry !== timer);
    }, 2400);
    feedbackTimers.current.push(timer);
  }, []);

  const refreshPushStatus = useCallback(() => {
    getPushPermissionStatus()
      .then((result) => {
        setPushStatus(result.status);
        setPushReason(result.reason);
      })
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
      setPushReason(result.reason);
      if (result.granted && accessToken) {
        await syncPushTokenWithBackend(accessToken);
      }
    } catch {
      showTransientMessage(
        setNotificationsErrorMessage,
        t("settings:messages.pushEnableFailed"),
      );
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
    const baselineRaw = (profile?.visibility ?? "PUBLIC") as Visibility;
    const baseline = baselineRaw === "PRIVATE" ? "FOLLOWERS" : baselineRaw;
    const selected = visibility === "PRIVATE" ? "FOLLOWERS" : visibility;
    return selected !== baseline;
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

  const pushUnavailableDetail = useMemo(() => {
    if (pushStatus !== "unavailable") return null;
    if (pushReason === "simulator") return t("settings:notifications.pushUnavailableSimulator");
    if (pushReason === "expo_go") return t("settings:notifications.pushUnavailableExpoGo");
    if (pushReason === "not_ios") return t("settings:notifications.pushUnavailablePlatform");
    return t("settings:notifications.pushUnavailableUnknown");
  }, [pushReason, pushStatus, t]);

  const consentItems = useMemo(() => {
    return consents
      .filter((item) => item.isFollowed)
      .sort((a, b) => {
        const an =
          a.organization.publicName || a.organization.businessName || a.organization.username || "";
        const bn =
          b.organization.publicName || b.organization.businessName || b.organization.username || "";
        return an.localeCompare(bn, "pt-PT");
      });
  }, [consents]);

  const generalMarketingValue = useMemo(() => {
    if (consentItems.length === 0) return false;
    return consentItems.every((item) => item.consents.MARKETING);
  }, [consentItems]);

  const generalEmailValue = useMemo(() => {
    if (consentItems.length === 0) return false;
    return consentItems.every((item) => item.consents.CONTACT_EMAIL);
  }, [consentItems]);

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
      const callbackUrl = Linking.createURL("auth/callback");
      await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${callbackUrl}${callbackUrl.includes("?") ? "&" : "?"}type=recovery`,
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
    setPrivacySuccessMessage(null);
    setPrivacyErrorMessage(null);
    try {
      await updateSettings({ visibility }, accessToken);
      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
      showTransientMessage(setPrivacySuccessMessage, t("settings:messages.privacySaved"));
    } catch {
      setPrivacyErrorMessage(t("settings:messages.privacySaveFailed"));
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleSaveInterests = async () => {
    if (!interestsDirty) return;
    setSavingInterests(true);
    setInterestsSuccessMessage(null);
    setInterestsErrorMessage(null);
    try {
      await updateSettings({ favouriteCategories: interests }, accessToken);
      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
      showTransientMessage(setInterestsSuccessMessage, t("settings:messages.interestsSaved"));
    } catch {
      setInterestsErrorMessage(t("settings:messages.interestsSaveFailed"));
    } finally {
      setSavingInterests(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!notificationsDirty) return;
    setSavingNotifications(true);
    setNotificationsSuccessMessage(null);
    setNotificationsErrorMessage(null);
    try {
      await updateSettings({ ...notificationPrefs }, accessToken);
      await api.requestWithAccessToken("/api/notifications/prefs", accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPrefs),
      });
      prefsQuery.refetch();
      showTransientMessage(setNotificationsSuccessMessage, t("settings:messages.notificationsSaved"));
    } catch {
      setNotificationsErrorMessage(t("settings:messages.notificationsSaveFailed"));
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
    type: "MARKETING" | "CONTACT_EMAIL",
    granted: boolean,
  ) => {
    const key = `${organizationId}:${type}`;
    setConsentSaving((prev) => ({ ...prev, [key]: true }));
    setConsentError(null);
    setConsentSavedMessage(null);
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
      showTransientMessage(setConsentSavedMessage, t("settings:messages.consentSaved"));
    } catch {
      setConsents(previous);
      setConsentError(t("settings:messages.consentSaveFailed"));
    } finally {
      setConsentSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleGlobalConsentToggle = async (
    type: "MARKETING" | "CONTACT_EMAIL",
    granted: boolean,
  ) => {
    if (consentItems.length === 0) return;
    setConsentError(null);
    setConsentSavedMessage(null);
    setConsentBatchSaving((prev) => ({ ...prev, [type]: true }));
    const previous = consents;
    const targetOrgIds = new Set(consentItems.map((item) => item.organization.id));
    setConsents((prev) =>
      prev.map((item) =>
        targetOrgIds.has(item.organization.id)
          ? { ...item, consents: { ...item.consents, [type]: granted } }
          : item,
      ),
    );
    try {
      const results = await Promise.allSettled(
        Array.from(targetOrgIds).map((organizationId) => updateConsent(organizationId, type, granted, accessToken)),
      );
      const failed = results.some((result) => result.status === "rejected");
      if (failed) {
        setConsents(previous);
        setConsentError(t("settings:messages.consentSaveFailed"));
      } else {
        showTransientMessage(setConsentSavedMessage, t("settings:messages.consentSaved"));
      }
    } catch {
      setConsents(previous);
      setConsentError(t("settings:messages.consentSaveFailed"));
    } finally {
      setConsentBatchSaving((prev) => ({ ...prev, [type]: false }));
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
          <View style={styles.accountActions}>
            <SettingsButton
              label={t("settings:account.updateEmail")}
              onPress={handleEmailSave}
              disabled={!emailDirty || emailSaving}
              loading={emailSaving}
              loadingLabel={t("settings:account.updating")}
              variant="primary"
              style={styles.accountActionButton}
            />
            <SettingsButton
              label={resetting ? t("settings:account.sending") : t("settings:account.resetPassword")}
              onPress={handlePasswordReset}
              disabled={resetting}
              loading={resetting}
              loadingLabel={t("settings:account.sending")}
              variant="secondary"
              style={styles.accountActionButton}
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
              { key: "FOLLOWERS", label: t("settings:privacy.privateFollowers") },
            ] as { key: Visibility; label: string }[]).map((option) => {
              const normalizedVisibility = visibility === "PRIVATE" ? "FOLLOWERS" : visibility;
              const active = normalizedVisibility === option.key;
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
          {privacyErrorMessage ? <Text style={styles.errorText}>{privacyErrorMessage}</Text> : null}
          {privacySuccessMessage ? <Text style={styles.statusText}>{privacySuccessMessage}</Text> : null}
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
          {interestsErrorMessage ? <Text style={styles.errorText}>{interestsErrorMessage}</Text> : null}
          {interestsSuccessMessage ? <Text style={styles.statusText}>{interestsSuccessMessage}</Text> : null}
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
              <View style={styles.pushUnavailableBlock}>
                <View style={styles.pushBadgeMuted}>
                  <Text style={styles.pushBadgeTextMuted}>
                    {t("settings:notifications.pushUnavailable")}
                  </Text>
                </View>
                {pushUnavailableDetail ? (
                  <Text style={styles.pushUnavailableText}>{pushUnavailableDetail}</Text>
                ) : null}
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
          {notificationsErrorMessage ? <Text style={styles.errorText}>{notificationsErrorMessage}</Text> : null}
          {notificationsSuccessMessage ? <Text style={styles.statusText}>{notificationsSuccessMessage}</Text> : null}
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
          {consentSavedMessage ? <Text style={styles.statusText}>{consentSavedMessage}</Text> : null}
          {consentsQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="rgba(255,255,255,0.7)" />
              <Text style={styles.helperText}>{t("settings:consents.loading")}</Text>
            </View>
          ) : consentItems.length === 0 ? (
            <Text style={styles.helperText}>{t("settings:consents.emptyFollowed")}</Text>
          ) : (
            <View style={styles.stack}>
              <View style={styles.stack}>
                <Text style={styles.groupLabel}>{t("settings:consents.generalTitle")}</Text>
                <SettingsToggle
                  label={t("settings:consents.generalUpdates")}
                  value={generalMarketingValue}
                  onValueChange={(next) => handleGlobalConsentToggle("MARKETING", next)}
                  disabled={consentBatchSaving.MARKETING}
                />
                <SettingsToggle
                  label={t("settings:consents.generalEmail")}
                  value={generalEmailValue}
                  onValueChange={(next) => handleGlobalConsentToggle("CONTACT_EMAIL", next)}
                  disabled={consentBatchSaving.CONTACT_EMAIL}
                />
              </View>
              <Pressable
                onPress={() => setConsentsExpanded((prev) => !prev)}
                style={({ pressed }) => [styles.dropdownToggle, pressed ? { opacity: 0.86 } : null]}
                accessibilityRole="button"
                accessibilityLabel={t("settings:consents.orgToggle")}
                accessibilityState={{ expanded: consentsExpanded }}
              >
                <Text style={styles.dropdownToggleLabel}>
                  {t("settings:consents.orgToggleCount", { count: consentItems.length })}
                </Text>
                <Ionicons
                  name={consentsExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="rgba(255,255,255,0.82)"
                />
              </Pressable>
              {consentsExpanded
                ? consentItems.map((item) => {
                const orgName =
                  item.organization.publicName ||
                  item.organization.businessName ||
                  item.organization.username ||
                  t("settings:consents.orgFallback");
                const orgUsername = item.organization.username ?? null;
                return (
                  <View key={item.organization.id} style={styles.orgBlock}>
                    <Pressable
                      onPress={() => {
                        if (orgUsername) {
                          safePush(router, { pathname: "/[username]", params: { username: orgUsername } });
                        }
                      }}
                      disabled={!orgUsername}
                      style={styles.consentHeader}
                      accessibilityRole="button"
                      accessibilityLabel={t("settings:consents.openOrg", { name: orgName })}
                      accessibilityState={{ disabled: !orgUsername }}
                    >
                      <AvatarCircle
                        size={32}
                        uri={item.organization.brandingAvatarUrl ?? null}
                        iconName="business"
                        borderColor="rgba(255,255,255,0.18)"
                        borderWidth={1}
                      />
                      <Text style={styles.orgName}>{orgName}</Text>
                    </Pressable>
                    <View style={styles.stack}>
                      {(["MARKETING", "CONTACT_EMAIL"] as const).map((type) => {
                        const savingKey = `${item.organization.id}:${type}`;
                        const label =
                          type === "MARKETING"
                            ? t("settings:consents.marketing")
                            : t("settings:consents.contactEmail");
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
              })
                : null}
            </View>
          )}
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.session.title")}
          subtitle={t("settings:sections.session.subtitle")}
        >
          <View style={styles.stack}>
            <View style={styles.sessionWarning}>
              <Ionicons name="warning-outline" size={18} color="rgba(255,180,188,0.95)" />
              <View style={styles.sessionWarningContent}>
                <Text style={styles.sessionWarningTitle}>{t("settings:session.deleteWarningTitle")}</Text>
                <Text style={styles.sessionWarningBody}>
                  {t("settings:session.deleteWarningBody", { phrase: deletePhraseUpper })}
                </Text>
              </View>
            </View>
            <SettingsButton
              label={t("settings:session.signOut")}
              onPress={handleLogout}
              variant="secondary"
              style={styles.sessionActionButton}
            />
            <SettingsButton
              label={t("settings:session.delete")}
              onPress={() => setDeleteModalOpen(true)}
              variant="danger"
              style={styles.sessionActionButton}
            />
            <Text style={styles.sessionDeleteHint}>{t("settings:session.deleteHint")}</Text>
          </View>
        </SettingsSection>

        <SettingsSection
          title={t("settings:sections.legal.title")}
          subtitle={t("settings:sections.legal.subtitle")}
        >
          <View style={styles.stack}>
            <Pressable
              style={styles.linkRow}
              onPress={() => {
                void openLegalUrl(termsUrl);
              }}
              accessibilityRole="link"
              accessibilityLabel={t("settings:legal.openTerms")}
            >
              <Text style={styles.linkLabel}>{t("settings:legal.terms")}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable
              style={styles.linkRow}
              onPress={() => {
                void openLegalUrl(privacyUrl);
              }}
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
    gap: tokens.spacing.xl,
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
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 0,
    paddingVertical: 10,
    color: "rgba(255,255,255,0.98)",
    fontSize: 18,
    fontWeight: "500",
  },
  helperText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: "rgba(255,150,160,0.9)",
    fontSize: 12,
  },
  statusText: {
    color: "rgba(157, 255, 206, 0.95)",
    fontSize: 12,
    lineHeight: 17,
  },
  accountActions: {
    flexDirection: "column",
    gap: tokens.spacing.sm,
  },
  accountActionButton: {
    alignSelf: "stretch",
  },
  optionRow: {
    flexDirection: "column",
    gap: tokens.spacing.sm,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  radioOptionActive: {
    borderBottomColor: "rgba(123,232,255,0.8)",
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
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
  },
  radioLabelActive: {
    color: "#F2FBFF",
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
  groupLabel: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  dropdownToggle: {
    marginTop: tokens.spacing.xs,
    minHeight: tokens.layout.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.22)",
    paddingVertical: 12,
  },
  dropdownToggleLabel: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 15,
    fontWeight: "600",
  },
  orgBlock: {
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
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
    color: "rgba(255,255,255,0.96)",
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
  pushUnavailableBlock: {
    alignItems: "flex-end",
    gap: 6,
    maxWidth: 220,
  },
  pushUnavailableText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    textAlign: "right",
    lineHeight: 15,
  },
  orgName: {
    color: "rgba(255,255,255,0.98)",
    fontSize: 15,
    fontWeight: "600",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  linkLabel: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 16,
    fontWeight: "600",
  },
  versionRow: {
    alignItems: "flex-start",
  },
  sessionWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,120,132,0.38)",
    backgroundColor: "rgba(255,72,96,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sessionWarningContent: {
    flex: 1,
    gap: 2,
  },
  sessionWarningTitle: {
    color: "rgba(255,232,236,0.98)",
    fontSize: 13,
    fontWeight: "700",
  },
  sessionWarningBody: {
    color: "rgba(255,222,228,0.88)",
    fontSize: 12,
    lineHeight: 17,
  },
  sessionActionButton: {
    alignSelf: "stretch",
    minHeight: 50,
  },
  sessionDeleteHint: {
    color: "rgba(255,182,190,0.9)",
    fontSize: 12,
    lineHeight: 16,
  },
});
