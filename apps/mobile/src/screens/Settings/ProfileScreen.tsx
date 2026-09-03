import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../../components/common/Avatar";
import { IconChevronRight } from "../../components/ui/Icons";
import { PressableScale } from "../../components/ui/PressableScale";
import { authApi } from "../../services/api/auth";
import { usersApi } from "../../services/api/users";
import { useConnections } from "../../features/connections/hooks/useConnections";
import { useMyEvents } from "../../features/events/hooks/useEvents";
import { disconnectSocket } from "../../services/socket";
import { useAuthStore, useUiStore } from "../../store";
import { colors, radius, sectionHeader, spacing, type } from "../../theme";
import type { Language } from "../../types/api";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "zh", label: "简体中文" },
];

export function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const queryClient = useQueryClient();
  const connectionsQuery = useConnections();
  const meetupsQuery = useMyEvents();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connections = connectionsQuery.data?.connections?.length ?? 0;
  const meetups = meetupsQuery.data?.events?.length ?? 0;
  const rep = user?.reputation_score ?? 0;

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

  const interests = user?.interests ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile hero — an edge-to-edge night block, not a floating card */}
      <View style={styles.hero}>
        <Avatar
          id={user?.id ?? ""}
          label={(user?.handle ?? "?").slice(0, 1)}
          size="lg"
        />
        <Text style={styles.heroKicker}>{t("profile.heroKicker")}</Text>
        <Text style={styles.handle}>@{user?.handle}</Text>
        <Text style={styles.name}>{user?.display_name}</Text>
      </View>

      {/* Stats — three figures separated by hairlines, no boxes */}
      <View style={styles.stats}>
        <Stat value={`${rep}`} label={t("settings.repLabel")} accent />
        <View style={styles.statRule} />
        <Stat value={`${connections}`} label={t("profile.statConnections")} />
        <View style={styles.statRule} />
        <Stat value={`${meetups}`} label={t("profile.statMeetups")} />
      </View>

      {/* Interests — numbered editorial index */}
      {interests.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.groupLabel}>{t("onboarding.interests")}</Text>
          {interests.map((interest, index) => (
            <View key={interest} style={styles.interestRow}>
              <Text style={styles.interestIndex}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Apps prefs */}
      <View style={styles.block}>
        <Text style={styles.groupLabel}>{t("profile.prefsGroup")}</Text>
        <Text style={styles.rowLabel}>{t("settings.language")}</Text>
        <View style={styles.languageMenu}>
          {LANGUAGES.map((item, index) => (
            <PressableScale
              key={item.code}
              onPress={() => chooseLanguage(item.code)}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: language === item.code }}
              style={styles.languageRow}
            >
              <Text
                style={[
                  styles.languageIndex,
                  { color: colors.textMuted },
                ]}
              >
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text
                style={[
                  styles.languageLabel,
                  language === item.code && styles.languageSelected,
                ]}
              >
                {item.label}
              </Text>
              {language === item.code ? <View style={styles.languageDot} /> : null}
            </PressableScale>
          ))}
        </View>
      </View>

      {/* Account */}
      <View style={styles.block}>
        <Text style={styles.groupLabel}>{t("profile.accountGroup")}</Text>
        <PressableScale
          onPress={handleSignOut}
          disabled={busy}
          scaleTo={0.98}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t("auth.signOut")}
        >
          <Text style={[styles.rowLabel, styles.signOutLabel]}>
            {t("auth.signOut")}
          </Text>
          <IconChevronRight size={18} color={colors.danger} />
        </PressableScale>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Text style={styles.privacy}>{t("settings.privacyNote")}</Text>
    </ScrollView>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xl },

  hero: {
    backgroundColor: colors.night,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  heroKicker: { ...type.overline, color: colors.neon },
  handle: { ...type.display, color: colors.nightText, marginTop: spacing.sm },
  name: { ...type.callout, color: colors.nightMuted },

  stats: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  stat: { flex: 1, alignItems: "center", gap: spacing.xxs },
  statRule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  statValue: { ...type.title2, color: colors.text, fontWeight: "700" },
  statValueAccent: { color: colors.primary },
  statLabel: { ...type.overline, color: colors.textMuted },

  block: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  groupLabel: { ...sectionHeader, color: colors.textMuted },

  interestRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  interestIndex: { ...type.overline, color: colors.primary, fontSize: 9 },
  interestText: { ...type.callout, color: colors.text },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...type.callout, color: colors.text },

  languageMenu: { gap: spacing.xs },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  languageIndex: { ...type.overline },
  languageLabel: { ...type.body, color: colors.textSecondary },
  languageSelected: { color: colors.primary, fontWeight: "700" },
  languageDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginLeft: "auto",
  },

  signOutLabel: { color: colors.danger },

  error: {
    ...type.footnote,
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  privacy: {
    ...type.overline,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
