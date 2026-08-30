import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Button } from "./Button";
import { colors, spacing, type } from "../../theme";

interface ScreenStateProps {
  status: "loading" | "error" | "empty";
  message?: string;
  onRetry?: () => void;
}

const GLYPH: Record<ScreenStateProps["status"], string> = {
  loading: "⏳",
  error: "⚠️",
  empty: "🗺️",
};

/**
 * Loading / error / empty in one place so no screen ever renders blank
 * (docs/RULES.md §13). Each state answers "what happened" and, where there is
 * one, "what can I do" — feedback with a path forward rather than a dead end.
 *
 * Branded with Atsumaru's kicker labels and emoji pairs so every state feels
 * designed, not generic (docs/DESIGN.md §10).
 */
export function ScreenState({ status, message, onRetry }: ScreenStateProps) {
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      style={styles.container}
      accessibilityLiveRegion="polite"
    >
      {status === "loading" ? (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.label}>{message ?? t("common.loading")}</Text>
        </>
      ) : (
        <>
          <Text style={styles.glyph}>{GLYPH[status]}</Text>
          <Text style={styles.label}>
            {message ??
              (status === "error" ? t("common.error") : t("common.empty"))}
          </Text>
          {status === "error" && onRetry ? (
            <Button
              label={t("common.retry")}
              onPress={onRetry}
              variant="secondary"
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
  glyph: { fontSize: 40 },
  label: {
    ...type.callout,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
});
