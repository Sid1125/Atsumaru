import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { TextField } from "../common/TextField";
import { IconCamera, IconClose } from "../ui/Icons";
import { PressableScale } from "../ui/PressableScale";
import { InterestEditor, PersonalityEditor } from "./TagEditor";
import { onboardingApi } from "../../services/api/onboarding";
import { usersApi } from "../../services/api/users";
import { useAuthStore } from "../../store";
import { colors, radius, sectionHeader, spacing, type } from "../../theme";
import type { User } from "../../types/api";

/**
 * The one place a signed-in user edits their profile: photo, display name,
 * handle (with the same live availability the onboarding screen uses),
 * interests and personality. Saving goes through `PATCH /users/me`, which
 * re-embeds the preference vector server-side when the tags change.
 */
export function ProfileEditModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const setUser = useAuthStore((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user.display_name);
  const [handle, setHandle] = useState(user.handle);
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [personality, setPersonality] = useState<string[]>(user.personality);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The handle is checked live exactly like onboarding — but only when it differs
  // from the current one, since the owner's own handle is legitimately "taken".
  const handleChanged = handle.trim().toLowerCase() !== user.handle.toLowerCase();

  useEffect(() => {
    if (!handleChanged) {
      setAvailable(null);
      setChecking(false);
      return;
    }

    setChecking(true);

    const timer = setTimeout(() => {
      onboardingApi
        .checkHandle(handle)
        .then((r) => setAvailable(r.available))
        .catch(() => setAvailable(null))
        .finally(() => setChecking(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [handle, handleChanged]);

  async function pickPhoto() {
    setError(null);
    setUploading(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.base64) return;

      const dataUrl = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
      const { user: updated } = await usersApi.uploadAvatar(dataUrl);
      setUser(updated);
      setAvatarUrl(updated.avatar_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("profile.photoError"));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (checking || available === false) return;

    setSaving(true);
    setError(null);

    try {
      const { user: updated } = await usersApi.updateMe({
        handle,
        display_name: displayName || handle,
        interests,
        personality,
      });
      setUser(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.kicker}>{t("profile.editKicker")}</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t("profile.edit")}</Text>
            <PressableScale
              accessibilityLabel={t("common.cancel")}
              onPress={onClose}
              scaleTo={0.92}
              style={styles.closeButton}
            >
              <IconClose size={18} color={colors.text} />
            </PressableScale>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo — the avatar itself is the button. */}
          <View style={styles.photoRow}>
            <PressableScale
              accessibilityLabel={t("profile.changePhoto")}
              onPress={pickPhoto}
              disabled={uploading}
              scaleTo={0.96}
              accessibilityRole="button"
            >
              <Avatar
                id={user.id}
                label={handle.slice(0, 1)}
                uri={avatarUrl}
                size="lg"
              />
            </PressableScale>
            <PressableScale
              accessibilityLabel={t("profile.changePhoto")}
              onPress={pickPhoto}
              disabled={uploading}
              scaleTo={0.96}
              style={styles.photoButton}
            >
              <IconCamera size={14} color={colors.textOnColor} />
              <Text style={styles.photoButtonText}>
                {uploading ? t("profile.uploading") : t("profile.changePhoto")}
              </Text>
            </PressableScale>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>{t("onboarding.displayName")}</Text>
            <TextField
              accessibilityLabel={t("onboarding.displayName")}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t("onboarding.displayNamePlaceholder")}
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>{t("onboarding.handle")}</Text>
            <TextField
              accessibilityLabel={t("onboarding.handle")}
              prefix="@"
              autoCapitalize="none"
              autoCorrect={false}
              value={handle}
              onChangeText={setHandle}
              placeholder={t("onboarding.handle")}
            />
            {handleChanged && !checking && available != null ? (
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

          <View style={styles.group}>
            <Text style={styles.groupLabel}>{t("onboarding.interests")}</Text>
            <InterestEditor tags={interests} onChange={setInterests} />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>{t("onboarding.personality")}</Text>
            <PersonalityEditor tags={personality} onChange={setPersonality} />
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <Button
            label={t("profile.save")}
            onPress={save}
            loading={saving}
            disabled={!handle.trim() || checking || available === false}
            size="large"
            haptic="success"
            style={styles.cta}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  head: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.sm,
    gap: spacing.xxs,
  },
  kicker: { ...type.overline, color: colors.primary },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...type.title1, color: colors.text },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: spacing.page, gap: spacing.xl },
  photoRow: { alignItems: "center", gap: spacing.sm },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xs,
    backgroundColor: colors.primary,
  },
  photoButtonText: {
    ...type.footnote,
    color: colors.textOnColor,
    fontWeight: "700",
  },
  group: { gap: spacing.sm },
  groupLabel: { ...sectionHeader, color: colors.textMuted },
  ok: { ...type.caption, color: colors.accent, fontWeight: "600" },
  taken: { ...type.caption, color: colors.danger, fontWeight: "600" },
  error: { ...type.footnote, color: colors.danger, textAlign: "center" },
  cta: { marginTop: spacing.sm },
});