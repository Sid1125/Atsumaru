import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/common/Button";
import { Chip } from "../../components/common/Chip";
import { onboardingApi } from "../../services/api/onboarding";
import { useAuthStore, useOnboardingDraft, useUiStore } from "../../store";
import { colors, radius, spacing, typography } from "../../theme";

export function ProfileConfirmScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const language = useUiStore((s) => s.language);
  const setUser = useAuthStore((s) => s.setUser);

  const [handles, setHandles] = useState<string[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
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

    const timer = setTimeout(() => {
      onboardingApi
        .checkHandle(draft.handle)
        .then((r) => setAvailable(r.available))
        .catch(() => setAvailable(null));
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.section}>{t("onboarding.interests")}</Text>
      <View style={styles.chips}>
        {draft.interests.map((interest) => (
          <Chip key={interest} label={interest} selected />
        ))}
      </View>

      <Text style={styles.section}>{t("onboarding.personality")}</Text>
      <View style={styles.chips}>
        {draft.personality.map((trait) => (
          <Chip key={trait} label={trait} />
        ))}
      </View>

      <Text style={styles.section}>{t("onboarding.handle")}</Text>
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
      <TextInput
        accessibilityLabel={t("onboarding.handle")}
        autoCapitalize="none"
        value={draft.handle}
        onChangeText={draft.setHandle}
        placeholder="@handle"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      {available != null ? (
        <Text style={available ? styles.ok : styles.error}>
          {available ? t("onboarding.handleAvailable") : t("onboarding.handleTaken")}
        </Text>
      ) : null}

      <Text style={styles.section}>{t("onboarding.displayName")}</Text>
      <TextInput
        accessibilityLabel={t("onboarding.displayName")}
        value={draft.displayName}
        onChangeText={draft.setDisplayName}
        placeholder={t("onboarding.displayName")}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={t("onboarding.cta")}
        onPress={complete}
        loading={submitting}
        disabled={!draft.handle || available === false}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  section: { ...typography.heading, color: colors.text, marginTop: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  ok: { ...typography.caption, color: colors.accent },
  error: { ...typography.caption, color: colors.danger },
  cta: { marginTop: spacing.lg },
});
