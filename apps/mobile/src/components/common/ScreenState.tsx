import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "./Button";
import { IconMap, IconWarning } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";
import {
  colors,
  radius,
  spacing,
  timings,
  type,
  useReducedMotion,
} from "../../theme";

interface ScreenStateProps {
  status: "loading" | "error" | "empty";
  message?: string;
  onRetry?: () => void;
  /**
   * An action for the **empty** state.
   *
   * An empty state with no way out is a dead end, and the composition guidance is
   * consistent that first-use empty is the onboarding moment: explain, then offer
   * the one thing the user can do. Discover has an obvious answer — host one — and
   * was rendering a bare "nothing here" instead.
   */
  actionLabel?: string;
  onAction?: () => void;
  dark?: boolean;
}

export function ScreenState({
  status,
  message,
  onRetry,
  actionLabel,
  onAction,
  dark,
}: ScreenStateProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  /**
   * The loading state is deliberately NOT animated.
   *
   * This is the most-mounted animated surface in the app — every network-backed
   * view, every refetch, every retry, and the whole-app bootstrap screen in
   * RootNavigator. An entrance here delays the spinner by its own duration at
   * exactly the moment the user is already waiting, which DESIGN.md §9 rules
   * out ("avoid animation that delays the user").
   *
   * Error and empty are answers rather than waits, so they may fade — opacity
   * only, because the container is centred and `flexGrow: 1`, so a translate
   * moves the whole block and reads as the screen settling rather than a result
   * arriving. Gated, unlike before: this was the one animated component in the
   * app ignoring the reduced-motion setting.
   */
  const entering =
    status === "loading" || reducedMotion
      ? undefined
      : FadeIn.duration(timings.fast.duration);

  return (
    <Animated.View
      entering={entering}
      style={styles.container}
      accessibilityLiveRegion="polite"
    >
      {status === "loading" ? (
        <>
          <ActivityIndicator color={dark ? colors.citrus : colors.primary} size="large" />
          <Text style={[styles.label, dark && styles.labelDark]}>
            {message ?? t("common.loading")}
          </Text>
        </>
      ) : (
        <>
          {/*
            A `Sticker`, not a bespoke 64pt tinted square. That shape appeared
            nowhere else in the vocabulary, so the app's error and empty states were
            the one place with their own private badge idiom. The die-cut mark is
            what the rest of the system uses to say "this is a thing".
          */}
          <Sticker
            color={dark ? colors.nightRaisedSoft : colors.primarySoft}
            borderRadius={radius.lg}
            rotate={-3}
            style={styles.badge}
          >
            {status === "error" ? (
              <IconWarning size={26} color={dark ? colors.citrus : colors.primaryInk} />
            ) : (
              <IconMap size={26} color={dark ? colors.citrus : colors.primaryInk} />
            )}
          </Sticker>
          <Text style={[styles.label, dark && styles.labelDark]}>
            {message ??
              (status === "error" ? t("common.error") : t("common.empty"))}
          </Text>
          {status === "error" && onRetry ? (
            <Button
              label={t("common.retry")}
              onPress={onRetry}
              variant={dark ? "vinyl" : "secondary"}
              size="regular"
            />
          ) : null}
          {status === "empty" && onAction && actionLabel ? (
            <Button
              label={actionLabel}
              onPress={onAction}
              variant={dark ? "vinyl" : "primary"}
              size="regular"
            />
          ) : null}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
    minHeight: 200,
  },
  badge: { width: 64, height: 64 },
  label: {
    ...type.callout,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
  labelDark: {
    color: colors.nightMuted,
  },
});
