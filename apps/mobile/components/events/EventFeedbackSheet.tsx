import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { PublicEventCard } from "@orya/shared";
import { GlassCard } from "../liquid/GlassCard";
import { sendEventSignal } from "../../features/events/signals";
import { formatInterestTagLabel, resolvePrimaryInterestTag } from "../../features/events/interestTags";

type EventFeedbackSheetProps = {
  visible: boolean;
  event: PublicEventCard | null;
  onClose: () => void;
  onHide?: (payload: { eventId: number; scope: "event" | "category" | "org"; tag?: string | null }) => void;
};

const REASON_LABELS: Record<string, string> = {
  PREF_MATCH: "Bate com os teus interesses",
  BEHAVIOR_PURCHASE: "Já compraste eventos semelhantes",
  BEHAVIOR_FAVORITE: "Marcaste eventos semelhantes",
  BEHAVIOR_VIEW: "Tens visto eventos parecidos",
  BEHAVIOR_CLICK: "Tens clicado em eventos parecidos",
  SOCIAL_ORG_FOLLOW: "Segues a organização",
  SOCIAL_FRIENDS_GOING: "Amigos vão a este evento",
  CONTEXT_NEARBY: "Perto de ti",
  CONTEXT_SOON: "Começa em breve",
};

export function EventFeedbackSheet({ visible, event, onClose, onHide }: EventFeedbackSheetProps) {
  const [showReasons, setShowReasons] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowReasons(false);
    }
  }, [visible]);

  const reasons = useMemo(() => {
    const list = event?.rank?.reasons ?? [];
    return list
      .map((reason) => reason.label || REASON_LABELS[reason.code] || reason.code)
      .filter(Boolean);
  }, [event?.rank?.reasons]);

  const categoryTag = useMemo(() => resolvePrimaryInterestTag(event), [event]);
  const categoryLabel = useMemo(() => formatInterestTagLabel(categoryTag), [categoryTag]);

  const handleHideEvent = async () => {
    if (!event?.id) return;
    await sendEventSignal({ eventId: event.id, signalType: "HIDE_EVENT" });
    onHide?.({ eventId: event.id, scope: "event" });
    onClose();
  };

  const handleHideCategory = async () => {
    if (!event?.id || !categoryTag) return;
    await sendEventSignal({
      eventId: event.id,
      signalType: "HIDE_CATEGORY",
      metadata: { tag: categoryTag },
    });
    onHide?.({ eventId: event.id, scope: "category", tag: categoryTag });
    onClose();
  };

  const handleHideOrg = async () => {
    if (!event?.id) return;
    await sendEventSignal({ eventId: event.id, signalType: "HIDE_ORG" });
    onHide?.({ eventId: event.id, scope: "org" });
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <GlassCard>
            <Text style={styles.title}>Feedback do evento</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {event?.title ?? "Evento"}
            </Text>

            <View style={styles.actions}>
              <Pressable onPress={handleHideEvent} accessibilityRole="button" style={styles.primaryButton}>
                <Text style={styles.primaryText}>Ver menos deste evento</Text>
              </Pressable>
              {categoryLabel ? (
                <Pressable onPress={handleHideCategory} accessibilityRole="button" style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Ver menos de {categoryLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleHideOrg} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Ver menos desta organização</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowReasons((prev) => !prev)}
                accessibilityRole="button"
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Porque estou a ver isto?</Text>
              </Pressable>
            </View>

            {showReasons && (
              <View style={styles.reasons}>
                {reasons.length === 0 ? (
                  <Text style={styles.reasonText}>Ainda a aprender o que gostas.</Text>
                ) : (
                  reasons.map((reason, index) => (
                    <Text key={`${reason}-${index}`} style={styles.reasonText}>
                      - {reason}
                    </Text>
                  ))
                )}
              </View>
            )}
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(5, 8, 12, 0.6)",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textAlign: "center",
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  reasons: {
    marginTop: 12,
    gap: 6,
  },
  reasonText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    lineHeight: 16,
  },
});
