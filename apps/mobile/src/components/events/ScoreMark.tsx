import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Sticker } from "../ui/Sticker";
import { colors, radius, spacing, type, useReducedMotion } from "../../theme";

const AnimatedText = Animated.createAnimatedComponent(Text);

/**
 * The group-fit percentage.
 *
 * It was rendered two ways — a lime sticker on the meetup screen, a bare coral
 * numeral on the card — with no shared a11y label, so the meetup's hero score
 * announced nothing at all to a screen reader.
 *
 * ## Colour is per-ground, not per-variant
 *
 * The score is a *number*, and it is 11–12pt on the card. `colors.primary` measures
 * 3.79:1 on champagne and 3.82:1 on night, so the action colour cannot carry it on
 * either ground. Inline it takes `primaryInk` on light (5.83:1) and Citrus **Fizz**
 * on night (12.24:1) — Fizz rather than Neon Citrus because the Discover sheet
 * already spends Neon Citrus on the Host button, and pitching a read-only number in
 * the same colour as the one control on the surface makes it look pressable.
 */
export function ScoreMark({
  score,
  size = "inline",
  dark,
}: {
  /** 0–1 as the server returns it. Rounded here, once, so the two sizes agree. */
  score: number;
  /** `inline` on a card · `hero` as the subject of the match panel */
  size?: "inline" | "hero";
  dark?: boolean;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const target = Math.round(score * 100);

  /**
   * The hero score counts up once on arrival. It is the only number in the app
   * that does, and it earns it: this is the answer to "why this group?", so a beat
   * of attention on it is the point rather than decoration.
   *
   * One-shot, never looping, and `withTiming` rather than a spring — a percentage
   * overshooting past its own value and settling back would be a lie about data.
   */
  const shown = useSharedValue(size === "hero" && !reducedMotion ? 0 : target);

  useEffect(() => {
    if (size !== "hero" || reducedMotion) {
      shown.value = target;
      return;
    }

    shown.value = withTiming(target, {
      duration: 620,
      // Decelerating hard: fast through the meaningless low numbers, slow onto the
      // real one, so the eye lands on the value and not on the animation.
      easing: Easing.out(Easing.cubic),
    });
  }, [shown, target, size, reducedMotion]);

  const counted = useAnimatedProps(() => ({
    text: `${Math.round(shown.value)}%`,
    // RN types `text` as a native-only prop on Text; it is how Reanimated drives
    // a string without a JS-thread re-render every frame.
    defaultValue: `${Math.round(shown.value)}%`,
  })) as never;

  const label = t("discover.groupFit", { score: target });

  if (size === "hero") {
    return (
      <Sticker color={colors.citrus} borderRadius={radius.md} rotate={-1.5} offset={2}>
        <AnimatedText
          style={styles.hero}
          animatedProps={counted}
          accessibilityLabel={label}
          // The animated value is not a live region — announcing every frame would
          // flood a screen reader. The static label above is what gets read.
          accessibilityLiveRegion="none"
        >
          {`${target}%`}
        </AnimatedText>
      </Sticker>
    );
  }

  return (
    <Text style={[styles.inline, dark && styles.inlineDark]} accessibilityLabel={label}>
      {target}%
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: {
    ...type.title1,
    color: colors.citrusInk,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  inline: {
    ...type.caption,
    color: colors.primaryInk,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  inlineDark: { color: colors.fizz },
});
