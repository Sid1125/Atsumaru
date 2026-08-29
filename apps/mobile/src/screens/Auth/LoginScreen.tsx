import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button } from "../../components/common/Button";
import { DEMO_MODE } from "../../config/env";
import { useOAuthLogin } from "../../features/auth/hooks/useOAuthLogin";
import {
  colors,
  spacing,
  springs,
  timings,
  type,
  useReducedMotion,
} from "../../theme";

/**
 * OAuth is LINE + Google only — no phone OTP (docs/TRD.md §5).
 *
 * The entrance staggers title → tagline → actions. Each element rises a short
 * distance on a critically damped spring: it arrives without overshoot, because
 * nothing here was thrown by the user (skill §4 — bounce is earned by momentum).
 */
export function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { start, pending, error } = useOAuthLogin();
  const reducedMotion = useReducedMotion();

  const entrance = useSharedValue(0);

  useEffect(() => {
    entrance.value = reducedMotion
      ? withTiming(1, timings.base)
      : withDelay(60, withSpring(1, springs.standard));
  }, [entrance, reducedMotion]);

  // Three explicit hooks rather than a `rise(n)` helper: calling useAnimatedStyle
  // from inside a function is a hooks-order hazard the moment one becomes
  // conditional. The staggered offset is what reads as a sequence.
  const riseTitle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - entrance.value) * 18 }],
  }));

  const riseTagline = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - entrance.value) * 28 }],
  }));

  const riseActions = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - entrance.value) * 38 }],
  }));

  return (
    <View style={styles.root}>
      {/* A warm ground wash — depth without an image the brand has not earned */}
      <LinearGradient
        colors={["#FBF7F2", "#F6EDE2", "#F1E3D6"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.hero}>
          <Animated.View style={riseTitle}>
            <Text style={styles.kicker}>集まる</Text>
            <Text style={styles.brand}>{t("common.appName")}</Text>
          </Animated.View>

          <Animated.View style={riseTagline}>
            <Text style={styles.tagline}>{t("auth.tagline")}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.actions, riseActions]}>
          <Button
            label={t("auth.continueWithLine")}
            onPress={() => start("line")}
            loading={pending === "line"}
            disabled={pending !== null}
            size="large"
          />
          <Button
            label={t("auth.continueWithGoogle")}
            variant="secondary"
            onPress={() => start("google")}
            loading={pending === "google"}
            disabled={pending !== null}
            size="large"
          />

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          {DEMO_MODE ? <Text style={styles.demo}>{t("auth.demoNote")}</Text> : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between",
  },
  hero: { flex: 1, justifyContent: "center", gap: spacing.md },
  kicker: {
    ...type.title3,
    color: colors.primary,
    letterSpacing: 6,
    marginBottom: spacing.xs,
  },
  brand: { ...type.display, fontSize: 46, lineHeight: 50, color: colors.text },
  tagline: { ...type.title3, fontWeight: "400", color: colors.textMuted },
  actions: { gap: spacing.sm + 4 },
  error: {
    ...type.footnote,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  demo: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
