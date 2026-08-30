import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../../components/common/Avatar";
import { Button } from "../../components/common/Button";
import { Chip } from "../../components/common/Chip";
import { authApi } from "../../services/api/auth";
import { usersApi } from "../../services/api/users";
import { disconnectSocket } from "../../services/socket";
import { useAuthStore, useUiStore } from "../../store";
import { colors, elevation, radius, spacing, type, useReducedMotion } from "../../theme";
import type { Language } from "../../types/api";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "zh", label: "简体中文" },
];

export function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(280)}>
        {/* Profile hero — night card with avatar + identity */}
        <View style={styles.profile}>
          <Avatar id={user?.id ?? ""} label={(user?.handle ?? "?").slice(0, 1)} size="lg" />
          <View style={styles.profileText}>
            <Text style={styles.handle}>@{user?.handle}</Text>
            <Text style={styles.name}>{user?.display_name}</Text>
          </View>
          <View style={styles.repBadge}>
            <Text style={styles.repValue}>{user?.reputation_score ?? 0}</Text>
            <Text style={styles.repLabel}>rep</Text>
          </View>
        </View>

        {/* Language card */}
        <View style={styles.card}>
          <Text style={styles.cardKicker}>{t("settings.language")}</Text>
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
        </View>

        {/* Interests card */}
        <View style={styles.card}>
          <Text style={styles.cardKicker}>{t("onboarding.interests")}</Text>
          <View style={styles.chips}>
            {(user?.interests ?? []).map((interest) => (
              <Chip key={interest} label={interest} />
            ))}
          </View>
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
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },

  /* Profile hero */
  profile: {
    backgroundColor: colors.night,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...elevation.medium,
  },
  profileText: { flex: 1, gap: 2 },
  handle: { ...type.title2, color: colors.nightText },
  name: { ...type.callout, color: colors.nightMuted },
  repBadge: {
    alignItems: "center",
    backgroundColor: colors.nightRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  repValue: { ...type.title3, color: colors.neon, fontWeight: "700" },
  repLabel: { ...type.overline, color: colors.nightMuted, fontSize: 8 },

  /* Section cards */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevation.low,
  },
  cardKicker: { ...type.kicker, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  error: { ...type.footnote, color: colors.danger },
  signOut: { marginTop: spacing.sm },
  privacy: {
    ...type.overline,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
