import { useRef, useState, useEffect } from "react";
import {
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
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { PressableScale } from "../../components/ui/PressableScale";
import { Chip } from "../../components/common/Chip";
import { IconSend, IconWave } from "../../components/ui/Icons";
import { onboardingApi } from "../../services/api/onboarding";
import {
  PERSONALITY_KEYS,
  type PersonalityKey,
} from "../../onboardingPersonality";
import { useOnboardingDraft, useUiStore } from "../../store";
import {
  colors,
  radius,
  spacing,
  type,
  useReducedMotion,
} from "../../theme";
import type { ChatTurn } from "../../types/api";
import type { OnboardingStackParamList } from "../../app/navigation/types";

type Nav = NativeStackNavigationProp<OnboardingStackParamList, "AIChat">;

// The server validates the full transcript on every turn and caps it at 30 messages
// (chatSchema in modules/onboarding/routes.ts). Past that the API 400s every send, so
// the client keeps the transcript inside the same limit.
const MAX_TRANSCRIPT = 30;

/**
 * Conversational onboarding. Bubbles enter from the side they belong to, which
 * is what makes a transcript read as a conversation rather than a list
 * (skill §7 — things emerge from where they came).
 *
 * Styled to feel like the website's AI section: editorial kickers, branded
 * bubbles, animated typing dots, and extracted-interest chips.
 */
export function AIChatScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const setExtracted = useOnboardingDraft((s) => s.setExtracted);
  const reducedMotion = useReducedMotion();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<PersonalityKey[]>([]);
  const [showTraits, setShowTraits] = useState(false);
  const listRef = useRef<ScrollView>(null);

  async function postTurn(content: string) {
    if (!content.trim() || sending) return;

    // The transcript before this send — a failed request must roll back to it, or the
    // unacknowledged bubble would be re-sent (and rejected) on every later attempt.
    const before = turns;
    const appended = [...before, { role: "user" as const, content: content.trim() }];
    const next =
      appended.length > MAX_TRANSCRIPT
        ? appended.slice(appended.length - MAX_TRANSCRIPT)
        : appended;
    setTurns(next);
    setSending(true);
    setError(null);

    try {
      const result = await onboardingApi.chat(next, language);
      setTurns([...next, { role: "assistant", content: result.reply }]);

      // The host chooses the language on the first turn — apply it to the whole app,
      // then re-render the transcript in it.
      if (result.language && result.language !== language) {
        setLanguage(result.language);
      }

      // The tray shows only while the host is actually asking the personality question.
      if (typeof result.showPersonality === "boolean") {
        setSelectedTraits([]);
        setShowTraits(result.showPersonality);
      }

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
      // The server rejected the payload (or it never got through): drop the turn we
      // optimistically added so the transcript only holds acknowledged messages, and
      // put the text back in the composer for a one-tap retry.
      setTurns(before);
      setDraft(content.trim());
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  function send() {
    if (!draft.trim() || sending) return;
    const content = draft.trim();
    setDraft("");
    postTurn(content);
  }

  function toggleTrait(key: PersonalityKey) {
    setSelectedTraits((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function submitTraits() {
    if (selectedTraits.length === 0 || sending) return;
    const labels = selectedTraits.map((key) => t(`onboarding.traits.${key}`));
    const content = t("onboarding.personalitySend", {
      traits: labels.join(", "),
    });
    setSelectedTraits([]);
    postTurn(content);
  }

  const progress = Math.min(3, turns.filter((x) => x.role === "user").length);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <View style={styles.head}>
        <Text style={styles.kicker}>{t("onboarding.title")}</Text>
        <Text style={styles.title}>{t("onboarding.chatTitle")}</Text>
        {/**
          * Progress is stated in words as well as fill. Three coral bars alone
          * communicated the state by colour only, which docs/DESIGN.md §10 rules
          * out — and DESIGN.md §3's own layout sketch shows the counter as text
          * ("Atsumaru    1/3"). The role and value also make it legible to a
          * screen reader, which previously got nothing at all from this.
          */}
        <View style={styles.progressRow}>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 3, now: progress }}
          >
            {[0, 1, 2].map((step) => (
              <View
                key={step}
                style={[
                  styles.progressFill,
                  step < progress && styles.progressFillDone,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressLabel}>
            {t("onboarding.step", { current: progress, total: 3 })}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={listRef}
        contentContainerStyle={styles.list}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(320)}
            style={styles.opener}
          >
            <IconWave size={36} color={colors.primary} />
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
            {item.role === "assistant" ? (
              <Text style={styles.aiLabel}>AI</Text>
            ) : null}
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
          <View
            style={[styles.bubble, styles.aiBubble, styles.typing]}
            accessibilityLiveRegion="polite"
            // Motion is never the only signal: the dots are decoration, and this
            // label is what actually announces the state.
            accessibilityLabel={t("common.loading")}
          >
            <Text style={styles.aiLabel}>AI</Text>
            <View style={styles.typingDots}>
              <TypingDot index={0} />
              <TypingDot index={1} />
              <TypingDot index={2} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {showTraits ? (
        <View style={styles.traitTray}>
          <View style={styles.traitHeader}>
            <Text style={styles.traitPrompt}>{t("onboarding.personalityPrompt")}</Text>
            {selectedTraits.length > 0 ? (
              <PressableScale
                accessibilityLabel={t("onboarding.personalityAdd")}
                onPress={submitTraits}
                disabled={sending}
                scaleTo={0.94}
                style={[
                  styles.traitSubmit,
                  sending && styles.traitSubmitDisabled,
                ]}
              >
                <Text style={styles.traitSubmitText}>
                  {t("onboarding.personalityAdd")}
                </Text>
              </PressableScale>
            ) : null}
          </View>
          <View style={styles.traitRow}>
            {PERSONALITY_KEYS.map((key) => (
              <Chip
                key={key}
                label={t(`onboarding.traits.${key}`)}
                selected={selectedTraits.includes(key)}
                onPress={() => toggleTrait(key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          { paddingBottom: insets.bottom + spacing.sm },
        ]}
      >
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
          <IconSend size={22} color={colors.primaryText} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * One dot of the "the host is thinking" indicator.
 *
 * These were three static `View`s at fixed opacities 0.4 / 0.6 / 0.8, sitting under
 * a file docblock that described "animated typing dots" — the app claimed a
 * behaviour it did not have. They now actually pulse.
 *
 * Staggered by a third of the cycle each so the group reads as a travelling wave
 * rather than three things blinking together. `withRepeat(..., -1, true)` reverses
 * on each pass, so the sequence is continuous with no jump back to the start.
 *
 * This is a loop, which the guidance generally rules out — permitted here because
 * it is a *progress* indicator bound to an in-flight request: it exists only while
 * `sending` is true and unmounts the moment the reply lands, so it cannot become
 * ambient motion with no end. Under reduced motion it settles to a static opacity
 * and the `accessibilityLabel` above carries the meaning instead.
 */
function TypingDot({ index }: { index: number }) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;

    pulse.value = withDelay(
      index * (DOT_CYCLE / 3),
      withRepeat(withTiming(1, { duration: DOT_CYCLE }), -1, true)
    );

    return () => cancelAnimation(pulse);
  }, [pulse, index, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.6 : 0.3 + pulse.value * 0.6,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

/** One dot's full pulse, in ms. Slow enough to read as breathing, not blinking. */
const DOT_CYCLE = 560;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  head: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  kicker: {
    ...type.overline,
    color: colors.primaryInk,
  },
  title: {
    ...type.title1,
    color: colors.text,
    maxWidth: 320,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressLabel: { ...type.overline, color: colors.textMuted },
  progressTrack: {
    // Shares its row with the "1/3" label now, so it must claim the slack
    // rather than collapsing to its content width.
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  progressFill: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  progressFillDone: {
    backgroundColor: colors.primary,
  },

  list: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  opener: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  openerText: {
    ...type.callout,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },

  bubble: {
    maxWidth: "82%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xs,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.xs,
  },
  aiLabel: {
    ...type.overline,
    color: colors.primaryInk,
    marginBottom: spacing.xxs,
  },
  bubbleText: { ...type.body, color: colors.text },
  userBubbleText: { color: colors.textOnColor },
  typing: {
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  typingDots: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },

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
    paddingHorizontal: spacing.page,
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
  traitTray: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.background,
  },
  traitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  traitPrompt: { ...type.caption, color: colors.textMuted },
  traitRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  traitSubmit: {
    minHeight: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  traitSubmitDisabled: { backgroundColor: colors.border },
  traitSubmitText: { ...type.subhead, color: colors.textOnColor, fontWeight: "600" },
});
