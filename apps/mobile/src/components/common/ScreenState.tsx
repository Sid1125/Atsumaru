import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Button } from "./Button";
import { colors, spacing, type } from "../../theme";

interface ScreenStateProps {
  status: "loading" | "error" | "empty";
  message?: string;
  onRetry?: () => void;
  dark?: boolean;
}

const GLYPH: Record<ScreenStateProps["status"], string> = {
  loading: "⏳",
  error: "⚠️",
  empty: "🗺️",
};

export function ScreenState({ status, message, onRetry, dark }: ScreenStateProps) {
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      style={styles.container}
      accessibilityLiveRegion="polite"
    >
      {status === "loading" ? (
        <>
          <ActivityIndicator color={dark ? colors.neon : colors.primary} size="large" />
          <Text style={[styles.label, dark && styles.labelDark]}>
            {message ?? t("common.loading")}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.glyph}>{GLYPH[status]}</Text>
          <Text style={[styles.label, dark && styles.labelDark]}>
            {message ??
              (status === "error" ? t("common.error") : t("common.empty"))}
          </Text>
          {status === "error" && onRetry ? (
            <Button
              label={t("common.retry")}
              onPress={onRetry}
              variant={dark ? "neon" : "secondary"}
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
  labelDark: {
    color: colors.nightMuted,
  },
});
