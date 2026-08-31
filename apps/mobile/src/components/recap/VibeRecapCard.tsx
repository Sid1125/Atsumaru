import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useVibeRecap } from "../../features/events/hooks/useEvents";
import { colors, radius, spacing, type, useReducedMotion } from "../../theme";

interface VibeRecapCardProps {
  eventId: string;
  /** Gate: only a member of a finished meetup can have a recap at all. */
  enabled: boolean;
}

/**
 * The vibe recap on a finished meetup (docs/AI.md §6a) — one line about the kind of
 * people the user clicked with, derived from their own private ratings.
 *
 * Deliberately renders **nothing** in its three non-answer states rather than a
 * `ScreenState`:
 *
 * - loading — it sits under the feedback panel, and a spinner there would compete with
 *   the thing the user came to do
 * - `NO_FEEDBACK_YET` (404) — the expected state before submitting; the feedback form is
 *   already on screen saying what to do
 * - any other error — a recap is a garnish, so failing it must not put an error card
 *   above the group's actual content
 *
 * The traits are shown as text chips beside the sentence, never colour alone
 * (docs/DESIGN.md §10).
 */
export function VibeRecapCard({ eventId, enabled }: VibeRecapCardProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const query = useVibeRecap(eventId, enabled);

  // Pre-submission is the common case, and it is not a failure worth showing.
  if (query.isPending || query.isError || !query.data) return null;

  const { recap, traits } = query.data;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(320)}
      style={styles.card}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.kicker}>{t("recap.title")}</Text>
      <Text style={styles.recap}>{recap}</Text>

      {traits.length > 0 ? (
        <View style={styles.traits}>
          {traits.map((trait) => (
            <View key={trait} style={styles.trait}>
              <Text style={styles.traitText}>{trait}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.privacy}>{t("recap.privacyNote")}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.night,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  kicker: { ...type.kicker, color: colors.neon },
  recap: { ...type.title3, color: colors.nightText },
  traits: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  trait: {
    backgroundColor: colors.nightRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  traitText: { ...type.caption, color: colors.nightMuted },
  privacy: { ...type.overline, color: colors.nightMuted },
});
