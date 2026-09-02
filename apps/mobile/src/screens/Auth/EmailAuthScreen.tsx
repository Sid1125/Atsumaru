import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Button } from "../../components/common/Button";
import { useEmailAuth, type EmailAuthMode } from "../../features/auth/hooks/useEmailAuth";
import { colors, radius, spacing, type } from "../../theme";

type Mode = EmailAuthMode;

/**
 * Email/password auth (docs/TRD.md §17). One screen, three modes — login, signup, and
 * password reset — switched in place so the Auth stack stays flat. Sign-up emails a
 * confirmation link (no local session until the user confirms, then logs in); login
 * mints a handoff code redeemed through the shared POST /auth/session path.
 */
export function EmailAuthScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { pending, error, info, login, signup, requestReset } = useEmailAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submitting = pending !== null;

  const onSubmit = () => {
    if (mode === "signup") void signup(email.trim(), password);
    else if (mode === "reset") void requestReset(email.trim());
    else void login(email.trim(), password);
  };

  const title =
    mode === "reset"
      ? t("auth.resetTitle")
      : mode === "signup"
        ? t("auth.signup")
        : t("auth.emailTitle");

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{title}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t("auth.emailLabel")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            editable={!submitting}
            style={styles.input}
          />
        </View>

        {mode !== "reset" ? (
          <View style={styles.field}>
            <Text style={styles.label}>{t("auth.passwordLabel")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              editable={!submitting}
              style={styles.input}
            />
          </View>
        ) : null}

        {info ? (
          <Text style={styles.info} accessibilityLiveRegion="polite">
            {info}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Button
          label={
            mode === "reset"
              ? t("auth.sendReset")
              : mode === "signup"
                ? t("auth.signup")
                : t("auth.login")
          }
          onPress={onSubmit}
          loading={submitting}
          disabled={!email.trim() || (mode !== "reset" && !password)}
          size="large"
        />

        {mode === "login" ? (
          <Button
            label={t("auth.forgotPassword")}
            variant="plain"
            onPress={() => {
              setMode("reset");
              setPassword("");
            }}
            disabled={submitting}
          />
        ) : null}

        {mode === "login" ? (
          <Button
            label={t("auth.noAccount")}
            variant="secondary"
            onPress={() => setMode("signup")}
            disabled={submitting}
          />
        ) : (
          <Button
            label={mode === "reset" ? t("auth.backToLogin") : t("auth.hasAccount")}
            variant="plain"
            onPress={() => setMode("login")}
            disabled={submitting}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  title: {
    ...type.title2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  field: { gap: spacing.xs },
  label: {
    ...type.caption,
    color: colors.textMuted,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  info: {
    ...type.footnote,
    color: colors.accent,
  },
  error: {
    ...type.footnote,
    color: colors.danger,
  },
});
