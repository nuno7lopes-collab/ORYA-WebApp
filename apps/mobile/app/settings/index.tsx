import {
  ActivityIndicator,
  Alert,
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
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { SettingsToggle } from "../../components/settings/SettingsToggle";
import { SettingsButton } from "../../components/settings/SettingsButton";
import { SettingsModal } from "../../components/settings/SettingsModal";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { useMemo, useEffect, useState } from "react";
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

export default function SettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const topPadding = useTopHeaderPadding(24);
  const bottomPadding = useTabBarPadding();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const queryClient = useQueryClient();
  const env = getMobileEnv();
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const termsUrl = `${baseUrl}/termos`;
  const privacyUrl = `${baseUrl}/privacidade`;
  const version = Constants.expoConfig?.version ?? Constants.manifest?.version ?? "1.0.0";

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
    allowEventReminders: true,
    allowFollowRequests: true,
    allowMarketingCampaigns: true,
    allowSystemAnnouncements: true,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

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
      notificationPrefs.allowEventReminders !== baseline.allowEventReminders ||
      notificationPrefs.allowFollowRequests !== baseline.allowFollowRequests ||
      notificationPrefs.allowMarketingCampaigns !== baseline.allowMarketingCampaigns ||
      notificationPrefs.allowSystemAnnouncements !== baseline.allowSystemAnnouncements
    );
  }, [notificationPrefs, prefsQuery.data]);

  const handleEmailSave = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setEmailMessage("Indica um email válido.");
      return;
    }
    setEmailSaving(true);
    setEmailMessage(null);
    try {
      const nextEmail = await updateEmail(normalized, accessToken);
      setEmail(nextEmail);
      setEmailMessage("Email atualizado. Pode ser necessária confirmação.");
      queryClient.invalidateQueries({ queryKey: ["profile", "summary"] });
    } catch {
      setEmailMessage("Não foi possível atualizar o email.");
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (resetting) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setEmailMessage("Indica um email válido para recuperar a password.");
      return;
    }
    setResetting(true);
    setEmailMessage(null);
    try {
      await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: Linking.createURL("auth/callback"),
      });
      setEmailMessage("Enviámos um link para recuperar a password.");
    } catch {
      setEmailMessage("Não foi possível enviar o link de recuperação.");
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
      Alert.alert("Erro", "Não foi possível guardar a privacidade.");
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
      Alert.alert("Erro", "Não foi possível guardar os interesses.");
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
      Alert.alert("Erro", "Não foi possível guardar as notificações.");
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
      setConsentError("Não foi possível guardar o consentimento.");
    } finally {
      setConsentSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace("/auth");
    } catch {
      Alert.alert("Erro", "Não foi possível terminar sessão.");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== "APAGAR CONTA") return;
    setDeleting(true);
    try {
      await api.requestWithAccessToken("/api/me/settings/delete", accessToken, { method: "POST" });
      await supabase.auth.signOut();
      router.replace("/auth");
    } catch {
      Alert.alert("Erro", "Não foi possível marcar a conta para eliminação.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPadding, paddingBottom: bottomPadding + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => safeBack(router, navigation)}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>

        <SettingsSection title="Conta" subtitle="Email e recuperação.">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemplo.pt"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
          {emailMessage ? <Text style={styles.helperText}>{emailMessage}</Text> : null}
          <View style={styles.rowButtons}>
            <SettingsButton
              label="Atualizar email"
              onPress={handleEmailSave}
              disabled={!emailDirty || emailSaving}
              loading={emailSaving}
              loadingLabel="A atualizar..."
              variant="primary"
              style={{ flex: 1 }}
            />
            <SettingsButton
              label={resetting ? "A enviar..." : "Recuperar password"}
              onPress={handlePasswordReset}
              disabled={resetting}
              loading={resetting}
              loadingLabel="A enviar..."
              variant="secondary"
              style={{ flex: 1 }}
            />
          </View>
        </SettingsSection>

        <SettingsSection title="Privacidade" subtitle="Controla quem pode ver o teu perfil.">
          <View style={styles.optionRow}>
            {([
              { key: "PUBLIC", label: "Perfil público" },
              { key: "FOLLOWERS", label: "Só seguidores" },
              { key: "PRIVATE", label: "Privado" },
            ] as { key: Visibility; label: string }[]).map((option) => {
              const active = visibility === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setVisibility(option.key)}
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
            label="Guardar privacidade"
            onPress={handleSaveVisibility}
            disabled={!visibilityDirty || savingVisibility}
            loading={savingVisibility}
            variant="primary"
            style={{ alignSelf: "stretch" }}
          />
        </SettingsSection>

        <SettingsSection title="Interesses" subtitle="Escolhe até 6 interesses.">
          <View style={styles.interestGrid}>
            {INTEREST_OPTIONS.map((interest) => {
              const active = interests.includes(interest.id);
              return (
                <Pressable
                  key={interest.id}
                  onPress={() => toggleInterest(interest.id)}
                  style={[
                    styles.interestChip,
                    active ? styles.interestChipActive : styles.interestChipIdle,
                  ]}
                >
                  <Text style={[styles.interestLabel, active ? styles.interestLabelActive : null]}>
                    {interest.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>{interests.length}/6 selecionados</Text>
          <SettingsButton
            label="Guardar interesses"
            onPress={handleSaveInterests}
            disabled={!interestsDirty || savingInterests}
            loading={savingInterests}
            variant="primary"
            style={{ alignSelf: "stretch" }}
          />
        </SettingsSection>

        <SettingsSection title="Notificações" subtitle="Emails e alertas essenciais.">
          {prefsQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="rgba(255,255,255,0.7)" />
              <Text style={styles.helperText}>A carregar notificações...</Text>
            </View>
          ) : (
            <View style={styles.stack}>
              <SettingsToggle
                label="Email de novidades e segurança"
                value={notificationPrefs.allowEmailNotifications}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({ ...prev, allowEmailNotifications: next }))
                }
              />
              <SettingsToggle
                label="Lembretes de eventos"
                value={notificationPrefs.allowEventReminders}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({ ...prev, allowEventReminders: next }))
                }
              />
              <SettingsToggle
                label="Pedidos para seguir"
                value={notificationPrefs.allowFollowRequests}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({ ...prev, allowFollowRequests: next }))
                }
              />
              <SettingsToggle
                label="Campanhas das organizações"
                value={notificationPrefs.allowMarketingCampaigns}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({ ...prev, allowMarketingCampaigns: next }))
                }
              />
              <SettingsToggle
                label="Anúncios do sistema"
                value={notificationPrefs.allowSystemAnnouncements}
                onValueChange={(next) =>
                  setNotificationPrefs((prev) => ({ ...prev, allowSystemAnnouncements: next }))
                }
              />
            </View>
          )}
          <SettingsButton
            label="Guardar notificações"
            onPress={handleSaveNotifications}
            disabled={!notificationsDirty || savingNotifications}
            loading={savingNotifications}
            variant="primary"
            style={{ alignSelf: "stretch" }}
          />
        </SettingsSection>

        <SettingsSection
          title="Consentimentos por organização"
          subtitle="Controla como cada organização comunica contigo."
        >
          {consentError ? <Text style={styles.errorText}>{consentError}</Text> : null}
          {consentsQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="rgba(255,255,255,0.7)" />
              <Text style={styles.helperText}>A carregar consentimentos...</Text>
            </View>
          ) : consents.length === 0 ? (
            <Text style={styles.helperText}>Sem organizações associadas.</Text>
          ) : (
            <View style={styles.stack}>
              {consents.map((item) => {
                const orgName =
                  item.organization.publicName ||
                  item.organization.businessName ||
                  item.organization.username ||
                  "Organização";
                return (
                  <View key={item.organization.id} style={styles.consentCard}>
                    <View style={styles.consentHeader}>
                      {item.organization.brandingAvatarUrl ? (
                        <Image source={{ uri: item.organization.brandingAvatarUrl }} style={styles.orgAvatar} />
                      ) : (
                        <View style={styles.orgAvatarFallback}>
                          <Ionicons name="business" size={16} color="rgba(255,255,255,0.9)" />
                        </View>
                      )}
                      <Text style={styles.orgName}>{orgName}</Text>
                    </View>
                    <View style={styles.stack}>
                      {(["MARKETING", "CONTACT_EMAIL", "CONTACT_SMS"] as const).map((type) => {
                        const savingKey = `${item.organization.id}:${type}`;
                        const label =
                          type === "MARKETING"
                            ? "Marketing"
                            : type === "CONTACT_EMAIL"
                              ? "Contacto por email"
                              : "Contacto por SMS";
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

        <SettingsSection title="Sessão e conta" subtitle="Termina sessão ou elimina a conta.">
          <View style={styles.rowButtons}>
            <SettingsButton label="Terminar sessão" onPress={handleLogout} variant="secondary" style={{ flex: 1 }} />
            <SettingsButton label="Apagar conta" onPress={() => setDeleteModalOpen(true)} variant="danger" style={{ flex: 1 }} />
          </View>
        </SettingsSection>

        <SettingsSection title="Legal e app" subtitle="Informação legal e versão.">
          <View style={styles.stack}>
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL(termsUrl)}>
              <Text style={styles.linkLabel}>Termos</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => Linking.openURL(privacyUrl)}>
              <Text style={styles.linkLabel}>Política de Privacidade</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <View style={styles.versionRow}>
              <Text style={styles.helperText}>Versão {version}</Text>
            </View>
          </View>
        </SettingsSection>
      </ScrollView>

      <SettingsModal
        visible={deleteModalOpen}
        title="Apagar conta ORYA"
        subtitle="A conta será desativada já. Tens 30 dias para reativar via login ou email. Escreve APAGAR CONTA para confirmar."
        confirmLabel="Confirmar eliminação"
        cancelLabel="Cancelar"
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeleteConfirm("");
        }}
        onConfirm={handleDeleteAccount}
        confirmInputLabel="Confirmação"
        confirmInputValue={deleteConfirm}
        onConfirmInputChange={setDeleteConfirm}
        confirmPlaceholder="APAGAR CONTA"
        confirmDisabled={deleteConfirm.trim().toUpperCase() !== "APAGAR CONTA"}
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
