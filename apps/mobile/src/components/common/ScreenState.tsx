import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "./Button";
import { colors, spacing, type } from "../../theme";

interface ScreenStateProps {
  status: "loading" | "error" | "empty";
  message?: string;
  onRetry?: () => void;
}

const GLYPH: Record<ScreenStateProps["status"], string> = {
  loading: "",
  error: "⚠",
  empty: "🗺",
};

/**
 * Loading / error / empty in one place so no screen ever renders blank
 * (docs/RULES.md §14). Each state answers "what happened" and, where there is
 * one, "what can I do" — feedback with a path forward rather than a dead end.
 */
export function ScreenState({ status, message, onRetry }: ScreenStateProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {status === "loading" ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.text}>{message ?? t("common.loading")}</Text>
        </>
      ) : (
        <>
          <Text style={styles.glyph}>{GLYPH[status]}</Text>
          <Text style={styles.title}>
            {message ??
              (status === "error" ? t("common.error") : t("common.empty"))}
          </Text>
          {status === "error" && onRetry ? (
            <Button
              label={t("common.retry")}
              onPress={onRetry}
              variant="secondary"
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    minHeight: 180,
  },
  glyph: { fontSize: 30, opacity: 0.5 },
  title: { ...type.callout, color: colors.textMuted, textAlign: "center" },
  text: { ...type.footnote, color: colors.textMuted, textAlign: "center" },
});
