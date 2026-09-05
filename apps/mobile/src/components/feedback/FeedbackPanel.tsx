import { useState, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "../common/Button";
import { Card } from "../ui/Card";
import { Chip } from "../common/Chip";
import { IconFaceGood, IconFaceMeh, IconFire, IconSparkle } from "../ui/Icons";
import { ScreenState } from "../common/ScreenState";
import { useFeedbackForm } from "../../features/feedback/hooks/useFeedbackForm";
import { useVibeRecap } from "../../features/events/hooks/useEvents";
import { feedbackApi } from "../../services/api/feedback";
import { colors, radius, spacing, type } from "../../theme";
import type { Connection, Rating } from "../../types/api";

// Each rating is a data mark: selected, the chip wears its own sticker colour
// (meh stays quiet, good sages, fire burns coral) — ink is chosen per colour
// (docs/DESIGN.md §10).
const RATINGS: {
  value: Rating;
  mark: ReactElement<{ color?: string }>;
  sticker: { bg: string; on: string };
}[] = [
  { value: "meh", mark: <IconFaceMeh size={16} />, sticker: colors.rating.meh },
  { value: "good", mark: <IconFaceGood size={16} />, sticker: colors.rating.good },
  { value: "fire", mark: <IconFire size={16} />, sticker: colors.rating.fire },
];

interface FeedbackPanelProps {
  eventId: string;
  /**
   * Routes into the new 1:1 thread once a mutual connection unlocks. `handle` is
   * passed alongside because `Connection` carries only user ids, and the `Dm`
   * route wants it for the header — without it the thread opens with an empty
   * title and a "Message @…" placeholder, which is the exact flash `Dm.handle`
   * exists to prevent.
   */
  onOpenConnection?: (connection: Connection, handle?: string) => void;
  /** Fired after a successful submit — the vibe recap becomes available at that point. */
  onSubmitted?: () => void;
}

export function FeedbackPanel({
  eventId,
  onOpenConnection,
  onSubmitted,
}: FeedbackPanelProps) {
  const { t } = useTranslation();
  const query = useFeedbackForm(eventId);

  // A recap only exists once the caller's own feedback has landed, so its presence is
  // the persisted "already submitted" signal. This panel and <VibeRecapCard> share the
  // same query key, so the fetch is deduped across them.
  const recapQuery = useVibeRecap(eventId, true);
  const alreadySubmitted = !!recapQuery.data;

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
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (query.isPending) return <ScreenState status="loading" />;
  if (query.isError)
    return <ScreenState status="error" onRetry={() => query.refetch()} />;

  // Post-submit state: either a fresh unlock from this session's submit, or the caller
  // already left feedback on an earlier visit (recall: this state was previously only
  // in transient local memory, so it vanished on remount and the editable form
  // reappeared beside a recap that already existed).
  const showCelebration = alreadySubmitted || !!unlocked;

  /**
   * `connection.mutualBody` names the other person, but `Connection` carries only
   * user ids. `members` is the roster *excluding* the caller — they are the people
   * you rate — so whichever side of the connection appears in it is the other
   * party. That avoids threading the current user id into this component just to
   * answer "which one is not me".
   *
   * Returns undefined rather than a blank when it cannot resolve, so the line is
   * dropped instead of rendering "@ both want to stay connected."
   */
  function otherHandle(connection: Connection): string | undefined {
    return query.data?.members.find(
      (m) => m.user_id === connection.user_a || m.user_id === connection.user_b
    )?.user.handle;
  }

  if (showCelebration) {
    return (
      <View style={[styles.card, styles.celebration]}>
        {unlocked && unlocked.length > 0 ? (
          <>
            <IconSparkle size={40} color={colors.citrus} />
            <Text style={styles.celebrationKicker}>{t("feedback.mutualKicker")}</Text>
            <Text style={styles.celebrationTitle}>{t("connection.mutualTitle")}</Text>
            {/* docs/DESIGN.md §5 asks for a body line under the title here.
                `connection.mutualBody` has existed in all three locales the whole
                time and was rendered by nothing. */}
            {unlocked.map((connection) => {
              const handle = otherHandle(connection);

              return handle ? (
                <Text key={`body-${connection.id}`} style={styles.celebrationBody}>
                  {t("connection.mutualBody", { handle })}
                </Text>
              ) : null;
            })}
            <Text style={styles.privacyOnNight}>{t("feedback.privacyNote")}</Text>
            {onOpenConnection
              ? unlocked.map((connection) => (
                  <Button
                    key={connection.id}
                    label={t("connection.startChatting")}
                    onPress={() =>
                      onOpenConnection(connection, otherHandle(connection))
                    }
                    variant="vinyl"
                  />
                ))
              : null}
          </>
        ) : (
          <>
            <Text style={styles.celebrationKicker}>{t("feedback.thanksKicker")}</Text>
            <Text style={styles.celebrationTitle}>{t("feedback.thanksTitle")}</Text>
            <Text style={styles.privacyOnNight}>{t("feedback.privacyNote")}</Text>
          </>
        )}
      </View>
    );
  }

  const members = query.data.members;

  return (
    <Card style={styles.card}>
      {/* No kicker here: the panel now lives on its own modal screen whose
          navigation header already carries this title, and printing it twice is
          the duplication docs/DESIGN.md's header grammar exists to prevent. */}

      {members.map((member) => (
        <View key={member.user_id} style={styles.row}>
          <Text style={styles.handle}>@{member.user.handle}</Text>
          <View style={styles.ratingRow}>
            {RATINGS.map(({ value, mark, sticker }) => (
              <Chip
                key={value}
                icon={mark}
                label={t(`feedback.ratings.${value}`)}
                selected={ratings[member.user_id] === value}
                onPress={() =>
                  setRatings((prev) => ({ ...prev, [member.user_id]: value }))
                }
                sticker={sticker}
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  celebration: {
    backgroundColor: colors.night,
    // `styles.card` is only `{ gap }` here — this branch does not use <Card> —
    // so without an explicit radius the 2pt coral border drew square corners.
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.citrus,
    alignItems: "center",
    // Both axes. With only `paddingVertical` the privacy note ran flush into the
    // 2pt border on both sides — the card had no inner margin at all horizontally.
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  celebrationKicker: { ...type.overline, color: colors.citrus },
  celebrationTitle: {
    ...type.title2,
    color: colors.nightText,
    textAlign: "center",
  },
  celebrationBody: {
    ...type.callout,
    color: colors.nightMuted,
    textAlign: "center",
  },
  /**
   * The night twin of `privacy`. The celebration branch was rendering
   * `styles.privacy` — `textMuted` — on the `night` ground, which measures
   * **2.92:1**. The note was effectively invisible on the one screen whose whole
   * job is to reassure someone that their picks stayed private.
   */
  privacyOnNight: {
    ...type.overline,
    color: colors.nightMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },

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
