import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Button } from "./Button";
import { IconMap, IconWarning } from "../ui/Icons";
import { colors, radius, spacing, type } from "../../theme";

interface ScreenStateProps {
  status: "loading" | "error" | "empty";
  message?: string;
  onRetry?: () => void;
  dark?: boolean;
}

export function ScreenState({ status, message, onRetry, dark }: ScreenStateProps) {
  const { t } = useTranslation();
  const tint = dark ? colors.nightMuted : colors.textMuted;

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
          <View style={[styles.badge, dark && styles.badgeDark]}>
            {status === "error" ? (
              <IconWarning size={26} color={dark ? colors.neon : colors.primary} />
            ) : (
              <IconMap size={26} color={dark ? colors.neon : colors.primary} />
            )}
          </View>
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
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDark: {
    backgroundColor: colors.nightRaised,
  },
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
