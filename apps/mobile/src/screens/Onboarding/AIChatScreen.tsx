import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { PressableScale } from "../../components/ui/PressableScale";
import { onboardingApi } from "../../services/api/onboarding";
import { useOnboardingDraft, useUiStore } from "../../store";
import {
  colors,
  elevation,
  radius,
  spacing,
  type,
  useReducedMotion,
} from "../../theme";
import type { ChatTurn } from "../../types/api";
import type { OnboardingStackParamList } from "../../app/navigation/types";

type Nav = NativeStackNavigationProp<OnboardingStackParamList, "AIChat">;

/**
 * Conversational onboarding. Bubbles enter from the side they belong to, which
 * is what makes a transcript read as a conversation rather than a list
 * (skill §7 — things emerge from where they came).
 */
export function AIChatScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const language = useUiStore((s) => s.language);
  const setExtracted = useOnboardingDraft((s) => s.setExtracted);
  const reducedMotion = useReducedMotion();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<ScrollView>(null);

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

  const progress = Math.min(3, turns.filter((x) => x.role === "user").length);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <View style={styles.head}>
        <Text style={styles.title}>{t("onboarding.title")}</Text>
        {/* Three ticks: where am I in this, and how much is left */}
        <View style={styles.progress}>
          {[0, 1, 2].map((step) => (
            <View
              key={step}
              style={[styles.tick, step < progress && styles.tickDone]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        ref={listRef}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(320)}
            style={styles.opener}
          >
            <Text style={styles.openerGlyph}>👋</Text>
            <Text style={styles.openerText}>{t("onboarding.opener")}</Text>
          </Animated.View>
        ) : null}

        {turns.map((item, index) => (
          <Animated.View
            key={index}
            entering={
              reducedMotion ? undefined : FadeInDown.duration(260).springify()
            }
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
          </Animated.View>
        ))}

        {sending ? (
          <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
            <ActivityIndicator size="small" color={colors.textMuted} />
          </View>
        ) : null}
      </ScrollView>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          accessibilityLabel={t("onboarding.placeholder")}
          placeholder={t("onboarding.placeholder")}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          style={styles.input}
          multiline
          returnKeyType="send"
          blurOnSubmit
        />
        <PressableScale
          accessibilityLabel={t("common.send")}
          onPress={send}
          disabled={!draft.trim() || sending}
          scaleTo={0.9}
          style={[
            styles.sendButton,
            (!draft.trim() || sending) && styles.sendDisabled,
          ]}
        >
          <Text style={styles.sendGlyph}>↑</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  head: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  title: { ...type.title1, color: colors.text, maxWidth: 320 },
  progress: { flexDirection: "row", gap: spacing.xs + 2 },
  tick: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  tickDone: { backgroundColor: colors.primary },

  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  opener: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  openerGlyph: { fontSize: 34 },
  openerText: {
    ...type.callout,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },

  bubble: {
    maxWidth: "86%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xs,
    ...elevation.low,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
    borderBottomRightRadius: radius.xs,
  },
  bubbleText: { ...type.body, color: colors.text },
  userBubbleText: { color: colors.textOnColor },
  typing: { paddingVertical: spacing.md },

  error: {
    ...type.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    ...type.body,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    color: colors.text,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { backgroundColor: colors.border },
  sendGlyph: { fontSize: 22, color: colors.primaryText, fontWeight: "700" },
});
