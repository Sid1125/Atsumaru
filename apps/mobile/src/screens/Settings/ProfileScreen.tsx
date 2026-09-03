import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../../components/common/Avatar";
import { Chip } from "../../components/common/Chip";
import { ProfileEditModal } from "../../components/profile/ProfileEditModal";
import { NotificationPrefsCard } from "../../components/profile/NotificationPrefsCard";
import { Card } from "../../components/ui/Card";
import { IconChevronRight, IconGlobe } from "../../components/ui/Icons";
import { Marker } from "../../components/ui/Marker";
import { PressableScale } from "../../components/ui/PressableScale";
import { traitLabel } from "../../onboardingPersonality";
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
  const [editing, setEditing] = useState(false);

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
  const personality = user?.personality ?? [];

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
          uri={user?.avatar_url}
          size="lg"
        />
        <Text style={styles.heroKicker}>{t("profile.heroKicker")}</Text>
        {/* The handle wears the highlighter mark — the loudest move in the
            vocabulary, reserved for the one word that is the person. */}
        <Marker style={styles.handle}>@{user?.handle}</Marker>
        <Text style={styles.name}>{user?.display_name}</Text>
      </View>

      {/* Stats — one lime vinyl strip, not three figures on hairline rules */}
      <View style={styles.statsWrap}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          style={styles.statsShadow}
        />
        <View style={styles.stats}>
          <Stat value={`${rep}`} label={t("settings.repLabel")} />
          <View style={styles.statRule} />
          <Stat value={`${connections}`} label={t("profile.statConnections")} />
          <View style={styles.statRule} />
          <Stat value={`${meetups}`} label={t("profile.statMeetups")} />
        </View>
      </View>

      {/* Edit profile — the one door into the edit modal. */}
      <Card style={styles.blockCard}>
        <PressableScale
          onPress={() => setEditing(true)}
          scaleTo={0.98}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t("profile.edit")}
        >
          <Text style={styles.rowLabel}>{t("profile.edit")}</Text>
          <IconChevronRight size={18} color={colors.textMuted} />
        </PressableScale>
      </Card>

      {/* Interests — numbered editorial index on a card */}
      {interests.length > 0 ? (
        <Card style={styles.blockCard}>
          <Text style={styles.groupLabel}>{t("onboarding.interests")}</Text>
          {interests.map((interest, index) => (
            <View key={interest} style={styles.interestRow}>
              <Text style={styles.interestIndex}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Personality — tags read in the caller's language when they match the
          vocabulary, raw otherwise (an out-of-vocab tag is never rewritten). */}
      {personality.length > 0 ? (
        <Card style={styles.blockCard}>
          <Text style={styles.groupLabel}>{t("onboarding.personality")}</Text>
          <View style={styles.personalityChips}>
            {personality.map((tag) => (
              <Chip key={tag} label={traitLabel(tag, language)} />
            ))}
          </View>
        </Card>
      ) : null}

      {/* Apps prefs — language as a segmented control, not a list */}
      <Card style={styles.blockCard}>
        <View style={styles.groupHeader}>
          <IconGlobe size={14} color={colors.textMuted} />
          <Text style={styles.groupLabel}>{t("profile.prefsGroup")}</Text>
        </View>
        <View style={styles.segmented}>
          {LANGUAGES.map((item) => {
            const selected = language === item.code;
            return (
              <PressableScale
                key={item.code}
                onPress={() => chooseLanguage(item.code)}
                scaleTo={0.96}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                style={[styles.segment, selected && styles.segmentSelected]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    selected && styles.segmentLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </Card>

      <NotificationPrefsCard />

      {/* Account */}
      <Card style={styles.blockCard}>
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
      </Card>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Text style={styles.privacy}>{t("settings.privacyNote")}</Text>

      {user && editing ? (
        <ProfileEditModal user={user} onClose={() => setEditing(false)} />
      ) : null}
    </ScrollView>
  );
}

function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
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
  handle: { ...type.display, marginTop: spacing.sm },
  name: { ...type.callout, color: colors.nightMuted },

  statsWrap: {
    position: "relative",
    marginHorizontal: spacing.page,
    marginTop: -spacing.sm,
  },
  statsShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: "rgba(9,9,11,0.9)",
  },
  stats: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.lime,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    transform: [{ rotate: "-0.8deg" }],
  },
  stat: { flex: 1, alignItems: "center", gap: spacing.xxs },
  statRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.limeInk,
    opacity: 0.25,
  },
  statValue: { ...type.title2, color: colors.limeInk, fontWeight: "800" },
  statLabel: { ...type.overline, color: colors.limeInk, opacity: 0.62 },

  blockCard: { marginHorizontal: spacing.page, gap: spacing.sm },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  groupLabel: { ...sectionHeader, color: colors.textMuted },

  interestRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  interestIndex: { ...type.overline, color: colors.primary },
  interestText: { ...type.callout, color: colors.text },
  personalityChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md - 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowLabel: { ...type.callout, color: colors.text },

  segmented: {
    flexDirection: "row",
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  segmentSelected: { backgroundColor: colors.lime },
  segmentLabel: { ...type.subhead, color: colors.textMuted, fontWeight: "600" },
  segmentLabelSelected: { color: colors.limeInk },

  signOutLabel: { color: colors.danger },

  error: {
    ...type.footnote,
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.page,
  },
  privacy: {
    ...type.overline,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.page,
  },
});