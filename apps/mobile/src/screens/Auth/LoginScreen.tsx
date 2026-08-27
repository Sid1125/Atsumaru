import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/common/Button";
import { colors, spacing, typography } from "../../theme";

/**
 * OAuth is LINE + Google only — no phone OTP (docs/TRD.md §5).
 * TODO: wire Supabase signInWithOAuth + Expo redirect URI, then
 * store the returned access_token via useAuthStore.signIn().
 */
export function LoginScreen() {
  const { t } = useTranslation();

  const notWired = (provider: string) =>
    Alert.alert("Not connected yet", `${provider} OAuth is not wired up yet.`);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>{t("common.appName")}</Text>
      <Text style={styles.tagline}>{t("auth.tagline")}</Text>

      <View style={styles.actions}>
        <Button
          label={t("auth.continueWithLine")}
          onPress={() => notWired("LINE")}
        />
        <Button
          label={t("auth.continueWithGoogle")}
          variant="secondary"
          onPress={() => notWired("Google")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  brand: { ...typography.title, fontSize: 40, color: colors.text },
  tagline: { ...typography.body, color: colors.textMuted },
  actions: { marginTop: spacing.xl, gap: spacing.md },
});
