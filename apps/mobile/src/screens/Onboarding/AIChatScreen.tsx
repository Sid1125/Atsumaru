import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Button } from "../../components/common/Button";
import { onboardingApi } from "../../services/api/onboarding";
import { useOnboardingDraft, useUiStore } from "../../store";
import { colors, radius, spacing, typography } from "../../theme";
import type { ChatTurn } from "../../types/api";
import type { OnboardingStackParamList } from "../../app/navigation/types";

type Nav = NativeStackNavigationProp<OnboardingStackParamList, "AIChat">;

export function AIChatScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const language = useUiStore((s) => s.language);
  const setExtracted = useOnboardingDraft((s) => s.setExtracted);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatTurn>>(null);

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;

    const next = [...turns, { role: "user" as const, content }];
    setTurns(next);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const result = await onboardingApi.chat(next, language);
      setTurns([...next, { role: "assistant", content: result.reply }]);

      // AI output is untrusted data — validate before using it (docs/RULES.md §13).
      if (result.done && Array.isArray(result.extracted?.interests)) {
        setExtracted(
          result.extracted.interests.filter((i) => typeof i === "string"),
          (result.extracted.personality ?? []).filter(
            (p) => typeof p === "string"
          )
        );
        navigation.navigate("ProfileConfirm");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>{t("onboarding.title")}</Text>

      <FlatList
        ref={listRef}
        data={turns}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === "user" ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                item.role === "user" && styles.userBubbleText,
              ]}
            >
              {item.content}
            </Text>
          </View>
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={t("onboarding.placeholder")}
          placeholder={t("onboarding.placeholder")}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          style={styles.input}
          multiline
        />
        <Button label={t("common.next")} onPress={send} loading={sending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  bubble: {
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  aiBubble: { alignSelf: "flex-start", backgroundColor: colors.surface },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.accent },
  bubbleText: { ...typography.body, color: colors.text },
  userBubbleText: { color: colors.primaryText },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  composer: { gap: spacing.sm },
  input: {
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
});
