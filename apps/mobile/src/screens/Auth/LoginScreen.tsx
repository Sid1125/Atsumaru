import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button } from "../../components/common/Button";
import { LineLogo, GoogleLogo } from "../../components/common/BrandLogos";
import { Sticker } from "../../components/ui/Sticker";
import { DEMO_MODE } from "../../config/env";
import { useOAuthLogin } from "../../features/auth/hooks/useOAuthLogin";
import {
  colors,
  radius,
  spacing,
  springs,
  timings,
  type,
  useReducedMotion,
} from "../../theme";

/**
 * OAuth is LINE + Google only — no phone OTP (docs/TRD.md §5).
 *
 * The night ground + neon CTA + manic ticker restage the site's hero
 * (site/globals.css `bg-dark`, `.cta-neon`, the marquee strip) as the login.
 * The entrance staggers title → actions on critically damped springs: nothing
 * here was thrown by the user (skill §4). Floater stickers bob for breath; they
 * are decorative and never touch the map or buttons.
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

  const riseActions = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - entrance.value) * 38 }],
  }));

  return (
    <View style={styles.root}>
      {/* Night ground — the site's dark hero section */}
      <LinearGradient
        colors={[colors.night, "#0B0A0C", colors.nightRaised]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Electric washes — the site's ambient tints, neon top-left, lilac bottom-right */}
      <LinearGradient
        colors={["rgba(200,255,0,0)", "rgba(200,255,0,0.07)"]}
        style={styles.neonWash}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(138,79,255,0)", "rgba(138,79,255,0.18)"]}
        style={styles.ambient}
        pointerEvents="none"
      />

      {!reducedMotion ? <FloatingStickers /> : null}

      <View
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.hero}>
          <Animated.View style={riseTitle}>
            <Text style={styles.positionKicker}>{t("auth.tagline")}</Text>
            <Text style={styles.kicker}>集まる</Text>
            <Text style={styles.brand}>{t("common.appName")}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.actions, riseActions]}>
          <Button
            label={t("auth.continueWithLine")}
            variant="neon"
            onPress={() => start("line")}
            loading={pending === "line"}
            disabled={pending !== null}
            size="large"
            leadingIcon={<LineLogo size={20} />}
          />
          <Button
            label={t("auth.continueWithGoogle")}
            variant="secondary"
            onPress={() => start("google")}
            loading={pending === "google"}
            disabled={pending !== null}
            size="large"
            leadingIcon={<GoogleLogo size={20} />}
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

const FLOATERS = [
  { glyph: "🍜", color: colors.sticker.food.bg, on: colors.sticker.food.on, top: 120, align: "left" as const, inset: -20, size: 156, spin: -8, delay: 0 },
  { glyph: "🎮", color: colors.sticker.gaming.bg, on: colors.sticker.gaming.on, top: 200, align: "right" as const, inset: -15, size: 132, spin: 6, delay: 700 },
  { glyph: "🎨", color: colors.sticker.arts.bg, on: colors.sticker.arts.on, top: 500, align: "left" as const, inset: 30, size: 120, spin: -4, delay: 1400 },
  { glyph: "🥾", color: colors.sticker.outdoor.bg, on: colors.sticker.outdoor.on, top: 560, align: "right" as const, inset: 20, size: 114, spin: 5, delay: 2100 },
];

/**
 * Decorative category stickers drifting beside the wordmark. They bob on a
 * sine loop and never touch anything — `pointerEvents` is none, and the whole
 * group is dead behind the buttons. Reduced motion: hidden entirely.
 */
function FloatingStickers() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      {FLOATERS.map((item, i) => (
        <Floater key={i} {...item} />
      ))}
    </View>
  );
}

function Floater({
  glyph,
  color,
  on,
  top,
  align,
  inset,
  size,
  spin,
  delay,
}: (typeof FLOATERS)[number]) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(
      withDelay(delay, withTiming(-8, timings.float)),
      -1,
      true
    );
  }, [y, delay]);

  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View
      style={[
        styles.floater,
        { top, [align]: inset },
        bob,
      ]}
    >
      <Sticker
        color={color}
        borderRadius={999}
        rotate={spin}
        offset={6}
        style={[styles.floaterSticker, { width: size, height: size, overflow: "hidden" }]}
      >
        <Text style={[styles.floaterGlyph, { fontSize: size * 0.42 }]}>
          {glyph}
        </Text>
      </Sticker>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  neonWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  ambient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 340,
  },
  floater: { position: "absolute" },
  floaterSticker: {},
  floaterGlyph: {},
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between",
  },
  hero: { flex: 1, justifyContent: "center", gap: spacing.md },
  positionKicker: {
    ...type.kicker,
    color: colors.neon,
    fontSize: 10,
    lineHeight: 14,
    marginBottom: spacing.sm,
  },
  kicker: {
    ...type.title1,
    color: colors.nightText,
    letterSpacing: 6,
    marginBottom: spacing.xs,
  },
  brand: {
    ...type.display,
    fontSize: 60,
    lineHeight: 62,
    color: colors.nightText,
  },
  actions: { gap: spacing.md },
  error: {
    ...type.footnote,
    color: colors.dangerLight,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  demo: {
    ...type.caption,
    color: colors.nightMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
