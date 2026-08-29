import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "../../components/common/Button";
import { Chip } from "../../components/common/Chip";
import { authApi } from "../../services/api/auth";
import { usersApi } from "../../services/api/users";
import { disconnectSocket } from "../../services/socket";
import { useAuthStore, useUiStore } from "../../store";
import { colors, elevation, radius, spacing, type } from "../../theme";
import type { Language } from "../../types/api";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "zh", label: "简体中文" },
];

export function SettingsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The chosen language also goes to the server so the AI replies in it. */
  async function chooseLanguage(next: Language) {
    setLanguage(next);
    setError(null);

    try {
      const { user: updated } = await usersApi.updateMe({ language: next });
      setUser(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);

    try {
      // Best-effort upstream revoke; the local session is cleared either way.
      await authApi.logout().catch(() => undefined);
      disconnectSocket();
      queryClient.clear();
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.handle}>@{user?.handle}</Text>
        <Text style={styles.meta}>{user?.display_name}</Text>
        <Text style={styles.meta}>
          {t("settings.reputation", { score: user?.reputation_score ?? 0 })}
        </Text>
      </View>

      <Text style={styles.section}>{t("settings.language")}</Text>
      <View style={styles.chips}>
        {LANGUAGES.map((item) => (
          <Chip
            key={item.code}
            label={item.label}
            selected={language === item.code}
            onPress={() => chooseLanguage(item.code)}
          />
        ))}
      </View>

      <Text style={styles.section}>{t("onboarding.interests")}</Text>
      <View style={styles.chips}>
        {(user?.interests ?? []).map((interest) => (
          <Chip key={interest} label={interest} />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={t("auth.signOut")}
        variant="secondary"
        onPress={handleSignOut}
        loading={busy}
        style={styles.signOut}
      />

      <Text style={styles.privacy}>{t("settings.privacyNote")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  handle: { ...type.title3, color: colors.text },
  meta: { ...type.footnote, color: colors.textMuted },
  section: { ...type.title3, color: colors.text, marginTop: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { ...type.footnote, color: colors.danger },
  signOut: { marginTop: spacing.lg },
  privacy: {
    ...type.footnote,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
