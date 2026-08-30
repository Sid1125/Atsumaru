import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "../common/Button";
import { Chip } from "../common/Chip";
import { ScreenState } from "../common/ScreenState";
import { useFeedbackForm } from "../../features/feedback/hooks/useFeedbackForm";
import { feedbackApi } from "../../services/api/feedback";
import { colors, elevation, radius, sectionHeader, spacing, type } from "../../theme";
import type { Connection, Rating } from "../../types/api";

const RATINGS: { value: Rating; emoji: string }[] = [
  { value: "meh", emoji: "😐" },
  { value: "good", emoji: "🙂" },
  { value: "fire", emoji: "🔥" },
];

interface FeedbackPanelProps {
  eventId: string;
  /** Routes into the new 1:1 thread once a mutual connection unlocks. */
  onOpenConnection?: (connection: Connection) => void;
}

export function FeedbackPanel({ eventId, onOpenConnection }: FeedbackPanelProps) {
  const { t } = useTranslation();
  const query = useFeedbackForm(eventId);

  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [connectWith, setConnectWith] = useState<string[]>([]);
  const [rejoin, setRejoin] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Connection[] | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      const result = await feedbackApi.submit(eventId, {
        ratings: Object.entries(ratings).map(([to_user, rating]) => ({
          to_user,
          rating,
        })),
        rejoin: rejoin ?? false,
        connect_with: connectWith,
      });
      setUnlocked(result.connections_unlocked);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (query.isPending) return <ScreenState status="loading" />;
  if (query.isError)
    return <ScreenState status="error" onRetry={() => query.refetch()} />;

  // Only mutual picks come back from the server; non-matches are never revealed —
  // the no-unlock branch says nothing about who did or did not pick the user.
  if (unlocked) {
    return (
      <View style={[styles.card, styles.celebration]}>
        {unlocked.length > 0 ? (
          <>
            <Text style={styles.celebrationGlyph}>🎉</Text>
            <Text style={styles.celebrationKicker}>MUTUAL MATCH</Text>
            <Text style={styles.celebrationTitle}>{t("connection.mutualTitle")}</Text>
            <Text style={styles.privacy}>{t("feedback.privacyNote")}</Text>
            {onOpenConnection
              ? unlocked.map((connection) => (
                  <Button
                    key={connection.id}
                    label={t("connection.startChatting")}
                    onPress={() => onOpenConnection(connection)}
                    variant="neon"
                  />
                ))
              : null}
          </>
        ) : (
          <>
            <Text style={styles.celebrationKicker}>THANK YOU</Text>
            <Text style={styles.celebrationTitle}>{t("feedback.thanksTitle")}</Text>
            <Text style={styles.privacy}>{t("feedback.privacyNote")}</Text>
          </>
        )}
      </View>
    );
  }

  const members = query.data.members;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{t("feedback.title")}</Text>

      {members.map((member) => (
        <View key={member.user_id} style={styles.row}>
          <Text style={styles.handle}>@{member.user.handle}</Text>
          <View style={styles.ratingRow}>
            {RATINGS.map(({ value, emoji }) => (
              <Chip
                key={value}
                label={`${emoji} ${t(`feedback.ratings.${value}`)}`}
                selected={ratings[member.user_id] === value}
                onPress={() =>
                  setRatings((prev) => ({ ...prev, [member.user_id]: value }))
                }
              />
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>{t("feedback.rejoin")}</Text>
      <View style={styles.ratingRow}>
        <Chip
          label={t("feedback.yes")}
          selected={rejoin === true}
          onPress={() => setRejoin(true)}
        />
        <Chip
          label={t("feedback.no")}
          selected={rejoin === false}
          onPress={() => setRejoin(false)}
        />
      </View>

      <Text style={styles.sectionLabel}>{t("feedback.connectPrompt")}</Text>
      <View style={styles.ratingRow}>
        {members.map((member) => (
          <Chip
            key={`connect-${member.user_id}`}
            label={`@${member.user.handle}`}
            selected={connectWith.includes(member.user_id)}
            onPress={() =>
              setConnectWith((prev) =>
                prev.includes(member.user_id)
                  ? prev.filter((id) => id !== member.user_id)
                  : [...prev, member.user_id]
              )
            }
          />
        ))}
      </View>

      <Text style={styles.privacy}>{t("feedback.privacyNote")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={t("feedback.submitPrivately")}
        onPress={submit}
        loading={submitting}
        disabled={Object.keys(ratings).length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...elevation.low,
  },
  celebration: {
    backgroundColor: colors.night,
    borderWidth: 2,
    borderColor: colors.neon,
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  celebrationGlyph: { fontSize: 44 },
  celebrationKicker: { ...type.overline, color: colors.neon },
  celebrationTitle: {
    ...type.title2,
    color: colors.nightText,
    textAlign: "center",
  },
  kicker: { ...type.overline, color: colors.primary },
  title: { ...type.title2, color: colors.text },
  sectionLabel: { ...type.footnote, color: colors.textMuted, marginTop: spacing.xs },
  row: { gap: spacing.sm },
  handle: { ...type.bodyEmphasized, color: colors.text },
  ratingRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  privacy: {
    ...type.overline,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: { ...type.footnote, color: colors.danger },
});
