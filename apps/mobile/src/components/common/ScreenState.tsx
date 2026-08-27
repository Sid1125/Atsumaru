import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "./Button";
import { colors, spacing, typography } from "../../theme";

interface ScreenStateProps {
  status: "loading" | "error" | "empty";
  message?: string;
  onRetry?: () => void;
}

/** Loading / error / empty in one place so no screen ever renders blank (docs/RULES.md §14). */
export function ScreenState({ status, message, onRetry }: ScreenStateProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {status === "loading" ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.text}>{message ?? t("common.loading")}</Text>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            {message ??
              (status === "error" ? t("common.error") : t("common.empty"))}
          </Text>
          {status === "error" && onRetry ? (
            <Button label={t("common.retry")} onPress={onRetry} variant="secondary" />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  text: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});
