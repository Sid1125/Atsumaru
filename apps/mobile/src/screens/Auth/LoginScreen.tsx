import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { IconMail } from "../../components/ui/Icons";
import { Marker } from "../../components/ui/Marker";
import { Sticker } from "../../components/ui/Sticker";
import { CATEGORY_ORDER, categoryIcon, categorySticker } from "../../categoryMeta";
import { DEMO_MODE } from "../../config/env";
import { useOAuthLogin } from "../../features/auth/hooks/useOAuthLogin";
import type { AuthStackParamList } from "../../app/navigation/types";
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
 * The night ground + warm ambient tints restage the site's hero: two washes, each
 * fading from fully transparent to a ~0.10 lift, the same gentle treatment as
 * site/globals.css `.ambient-surface-dark`. The loud rainbow washes are gone.
 *
 * Both stops of each gradient are derived from the same token, which is the whole
 * point of writing them out here. A gradient needs a transparent *version of its
 * own colour* — fading Orange Zest through a leftover coral `rgba(255,67,42,0)`
 * tints the midpoint toward a hue the palette no longer contains, and on a
 * full-bleed wash that is the most visible place it could possibly happen.
 *
 * (The names are roles, not hues, for the same reason: these constants were
 * `CORAL_WASH` and `SAGE_WASH`, and had to be renamed the moment the palette
 * moved.)
 */
const NIGHT_GROUND = [colors.night, colors.night, colors.nightRaised] as const;
/** Orange Zest `#CE4503`, and the same colour at zero alpha. */
const PRIMARY_WASH = ["rgba(206,69,3,0)", colors.washPrimary] as const;
/** Olive `#4F6B3A`, and the same colour at zero alpha. */
const ACCENT_WASH = ["rgba(79,107,58,0)", colors.washAccent] as const;

/**
 * OAuth is LINE + Google only — no phone OTP (docs/TRD.md §5).
 *
 * The night ground + coral CTA + manic ticker restage the site's hero
 * (site/globals.css `bg-dark`, the marquee strip) as the login. The coral
 * (brand) lower wash clips the bright CTA into place; a faint sage lift breathes
 * warmth into the corner. The entrance staggers title → actions on critically
 * damped springs: nothing here was thrown by the user (skill §4). Floater
 * stickers bob for breath; they are decorative and never touch the map/buttons.
 */
export function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
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
        colors={NIGHT_GROUND}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Warm ambient tints — coral glow upper, faint sage in the corner */}
      <LinearGradient
        colors={PRIMARY_WASH}
        style={styles.neonWash}
        pointerEvents="none"
      />
      <LinearGradient
        colors={ACCENT_WASH}
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
            {/* The wordmark wears the highlighter band — the site's loudest
                move, reserved for the brand itself. */}
            <Marker style={styles.wordmarkJa}>集まる</Marker>
            <Text style={styles.brand}>{t("common.appName")}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.actions, riseActions]}>
          <Button
            label={t("auth.continueWithLine")}
            variant="vinyl"
            style={{ backgroundColor: colors.brandLine }}
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
          <Button
            label={t("auth.continueWithEmail")}
            variant="secondary"
            onPress={() => navigation.navigate("EmailAuth")}
            disabled={pending !== null}
            size="large"
            leadingIcon={<IconMail size={20} color={colors.text} />}
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

/**
 * Decorative category stickers drifting beside the wordmark. Glyph and colour
 * come from the single category source (categoryMeta); only the placement is
 * this screen's.
 */
/**
 * Where the stickers sit, in dp, on the two bands of the screen that hold no text.
 *
 * They were 114–156pt circles at `top: 120/200/500/560`. On a ~880dp-tall handset
 * that put one across the tagline (the word "FIRST." rendered *on top of* a pink
 * disc) and two across the sign-in buttons. Decoration that lands on copy is not
 * ambience, it is a legibility bug — and an oversized disc with an icon in it is on
 * every list of mobile AI tells.
 *
 * Measured on a 411 x 923dp handset rather than estimated: the hero text block
 * lands at **dp 291–394** and the first CTA at **dp 638**, so the two free bands are
 * the top ~180dp (below the status bar) and the 400–630dp void between the wordmark
 * and the buttons. The top pair bleeds off the left and right edges, which is what
 * makes them read as stickers on a surface rather than icons placed in a layout.
 *
 * Sizes step down front-to-back so the group reads as depth rather than as four
 * equal shapes. Anything here that overlaps the text is a bug, not ambience —
 * re-measure before moving one.
 */
const FLOATER_LAYOUT = [
  { top: 70, align: "left" as const, inset: -30, size: 104, spin: -8, delay: 0 },
  { top: 92, align: "right" as const, inset: -26, size: 88, spin: 7, delay: 700 },
  { top: 450, align: "left" as const, inset: 16, size: 78, spin: -5, delay: 1400 },
  { top: 500, align: "right" as const, inset: 8, size: 70, spin: 6, delay: 2100 },
];

const FLOATERS = CATEGORY_ORDER.map((category, i) => {
  const sticker = categorySticker(category);
  return {
    Mark: categoryIcon(category),
    color: sticker.bg,
    on: sticker.on,
    ...FLOATER_LAYOUT[i]!,
  };
});

/**
 * Decorative category stickers drifting beside the wordmark. They bob on a sine
 * loop and never touch anything — `pointerEvents` is none, and the whole group is
 * dead behind the buttons. Reduced motion: hidden entirely.
 *
 * They are **die-cut squares, not discs**. Every other sticker in the app — card
 * marks, map pins, the meetup hero, filter chips — is a rounded square on a hard
 * vinyl offset, and these were the one place the same category colours rendered as
 * plain circles. Same shape language or the physicality reads as accidental.
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
  Mark,
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
        borderRadius={radius.lg}
        rotate={spin}
        offset={5}
        // No `overflow: "hidden"` — it would clip the vinyl offset back off.
        style={[styles.floaterSticker, { width: size, height: size }]}
      >
        <Mark size={size * 0.42} color={on} />
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
  /**
   * Held just under full strength. The wash gradients sit between the stickers and
   * the ground, so at full opacity the front two read as foreground objects
   * competing with the wordmark rather than as texture behind it.
   */
  floater: { position: "absolute", opacity: 0.9 },
  floaterSticker: {},
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between",
  },
  hero: { flex: 1, justifyContent: "center", gap: spacing.md },
  // No size override. `type.kicker`'s tracking is computed for its own 11pt;
  // dropping to 10pt while keeping 2.6 breaks the size-specific-tracking rule the
  // scale exists to enforce.
  positionKicker: {
    ...type.kicker,
    color: colors.citrus,
    marginBottom: spacing.sm,
  },
  /**
   * 集まる in the highlighter band. Positive tracking here is not the Latin rule
   * inverted — kana are square and set solid, so a few points of air is what keeps
   * three characters from reading as one block inside the band.
   */
  wordmarkJa: {
    ...type.title1,
    letterSpacing: 6,
    marginBottom: spacing.xs,
  },
  // `displayLarge` rather than `display` plus a hand-tuned 60/62 override. The
  // scale now has a tier for exactly this — the one thing a screen is about.
  brand: {
    ...type.displayLarge,
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
