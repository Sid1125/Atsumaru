import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Button } from "../../components/common/Button";
import { Chip } from "../../components/common/Chip";
import { onboardingApi } from "../../services/api/onboarding";
import { useAuthStore, useOnboardingDraft, useUiStore } from "../../store";
import {
  colors,
  radius,
  sectionHeader,
  spacing,
  type,
  useReducedMotion,
} from "../../theme";

/**
 * The extraction, made editable before it becomes a profile. Sections are
 * grouped and labelled so the user can see exactly what the AI concluded and
 * correct it — the model's output is a proposal, never a decision.
 */
export function ProfileConfirmScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const draft = useOnboardingDraft();
  const language = useUiStore((s) => s.language);
  const setUser = useAuthStore((s) => s.setUser);
  const reducedMotion = useReducedMotion();

  const [handles, setHandles] = useState<string[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onboardingApi
      .suggestHandles(draft.interests)
      .then((r) => setHandles(r.handles))
      .catch(() => setHandles([]));
  }, [draft.interests]);

  useEffect(() => {
    if (!draft.handle) {
      setAvailable(null);
      return;
    }

    setChecking(true);

    // Debounced so a handle is not checked on every keystroke.
    const timer = setTimeout(() => {
      onboardingApi
        .checkHandle(draft.handle)
        .then((r) => setAvailable(r.available))
        .catch(() => setAvailable(null))
        .finally(() => setChecking(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [draft.handle]);

  async function complete() {
    setSubmitting(true);
    setError(null);

    try {
      const { user } = await onboardingApi.complete({
        handle: draft.handle,
        display_name: draft.displayName || draft.handle,
        language,
        interests: draft.interests,
        personality: draft.personality,
      });
      setUser(user);
      draft.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(280)}>
        <Text style={styles.kicker}>{t("onboarding.confirmTitle")}</Text>
        <Text style={styles.title}>{t("onboarding.confirmLede")}</Text>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>{t("onboarding.interests")}</Text>
        <View style={styles.chips}>
          {draft.interests.map((interest) => (
            <Chip key={interest} label={interest} selected />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>{t("onboarding.personality")}</Text>
        <View style={styles.chips}>
          {draft.personality.map((trait) => (
            <Chip key={trait} label={trait} />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>{t("onboarding.handle")}</Text>
        <View style={styles.chips}>
          {handles.map((handle) => (
            <Chip
              key={handle}
              label={`@${handle}`}
              selected={draft.handle === handle}
              onPress={() => draft.setHandle(handle)}
            />
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.prefix}>@</Text>
          <TextInput
            accessibilityLabel={t("onboarding.handle")}
            autoCapitalize="none"
            autoCorrect={false}
            value={draft.handle}
            onChangeText={draft.setHandle}
            placeholder={t("onboarding.handle")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          {/* Availability is stated in words, not signalled by colour alone
              (docs/DESIGN.md §10). */}
          {draft.handle && !checking && available != null ? (
            <Text
              style={available ? styles.ok : styles.taken}
              accessibilityLiveRegion="polite"
            >
              {available
                ? `✓ ${t("onboarding.handleAvailable")}`
                : `✕ ${t("onboarding.handleTaken")}`}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>{t("onboarding.displayName")}</Text>
        <View style={styles.field}>
          <TextInput
            accessibilityLabel={t("onboarding.displayName")}
            value={draft.displayName}
            onChangeText={draft.setDisplayName}
            placeholder={t("onboarding.displayNamePlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
        <Text style={styles.hint}>{t("onboarding.privacyHint")}</Text>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button
        label={t("onboarding.cta")}
        onPress={complete}
        loading={submitting}
        disabled={!draft.handle || available === false}
        size="large"
        haptic="success"
        style={styles.cta}
      />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg },
  kicker: { ...type.overline, color: colors.primary },
  title: { ...type.title1, color: colors.text, marginTop: -spacing.sm },
  group: { gap: spacing.sm },
  groupLabel: { ...sectionHeader, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  prefix: { ...type.body, color: colors.textMuted },
  input: { flex: 1, ...type.body, color: colors.text, paddingVertical: spacing.sm },
  ok: { ...type.caption, color: colors.accent, fontWeight: "600" },
  taken: { ...type.caption, color: colors.danger, fontWeight: "600" },
  hint: { ...type.caption, color: colors.textMuted },
  error: { ...type.footnote, color: colors.danger },
  cta: { marginTop: spacing.sm },
});
