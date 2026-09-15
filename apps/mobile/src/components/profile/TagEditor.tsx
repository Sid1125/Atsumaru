import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Chip } from "../common/Chip";
import { TextField } from "../common/TextField";
import { tagLabel } from "../../tagLabel";
import { IconClose } from "../ui/Icons";
import { PressableScale } from "../ui/PressableScale";
import { IconPlus } from "../ui/Icons";
import {
  PERSONALITY_KEYS,
  traitKeyFor,
  type PersonalityKey,
} from "../../onboardingPersonality";
import { colors, radius, spacing, type } from "../../theme";

const MAX_INTERESTS = 30;
const MAX_PERSONALITY = 8;

/**
 * A chip whose tap REMOVES the tag.
 *
 * The close glyph is the only visual signal of that, so it cannot be the only
 * signal full stop: without an explicit label a screen reader announces
 * "Ramen, selected, button", which reads as "choose this" — the opposite of what
 * tapping does (docs/DESIGN.md §10).
 */
function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation();

  return (
    <Chip
      label={label}
      selected
      onPress={onRemove}
      accessibilityLabel={t("profile.removeTag", { tag: label })}
      icon={<IconClose size={12} />}
    />
  );
}

/**
 * Editable interests: the AI's extraction as removable chips, plus a free-text
 * add field. Shared by the onboarding confirm screen and the profile edit modal
 * so both surfaces behave identically (docs/RULES.md — one way to edit a thing).
 */
export function InterestEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;

    const exists = tags.some(
      (tag) => tag.toLowerCase() === value.toLowerCase()
    );
    if (!exists && tags.length < MAX_INTERESTS) {
      onChange([...tags, value]);
    }
    setDraft("");
  }

  return (
    <View style={styles.editor}>
      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <RemovableChip
              key={tag}
              // The stored slug stays the value; only the label is humanized.
              label={tagLabel(tag)}
              onRemove={() => onChange(tags.filter((existing) => existing !== tag))}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{t("profile.noInterests")}</Text>
      )}

      <View style={styles.addRow}>
        <TextField
          accessibilityLabel={t("profile.addInterest")}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("profile.addInterestPlaceholder")}
          onSubmitEditing={add}
          returnKeyType="done"
          containerStyle={styles.addField}
        />
        <PressableScale
          accessibilityLabel={t("profile.addInterest")}
          onPress={add}
          disabled={!draft.trim()}
          scaleTo={0.94}
          style={[styles.addButton, !draft.trim() && styles.addButtonDisabled]}
        >
          <IconPlus
            size={22}
            color={draft.trim() ? colors.primaryText : colors.textMuted}
          />
        </PressableScale>
      </View>
    </View>
  );
}

/**
 * Editable personality: the fixed vocabulary as toggle chips (a stored tag is
 * matched across all three locales, because the AI returns it in the user's chat
 * language), plus any out-of-vocabulary tags the AI invented as removable chips
 * so nothing is silently dropped.
 */
export function PersonalityEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();

  const matchedKeys = new Set<PersonalityKey>();
  for (const tag of tags) {
    const key = traitKeyFor(tag);
    if (key) matchedKeys.add(key);
  }

  const strays = tags.filter((tag) => traitKeyFor(tag) === null);

  function toggle(key: PersonalityKey) {
    const label = t(`onboarding.traits.${key}`);

    if (matchedKeys.has(key)) {
      // Remove every stored spelling of this trait (the tag may be a ja label
      // while the app is in en, etc.).
      onChange(
        tags.filter(
          (tag) => traitKeyFor(tag) !== key && tag.toLowerCase() !== label.toLowerCase()
        )
      );
    } else if (tags.length < MAX_PERSONALITY) {
      onChange([...tags, label]);
    }
  }

  return (
    <View style={styles.editor}>
      <View style={styles.chips}>
        {PERSONALITY_KEYS.map((key) => {
          const selected = matchedKeys.has(key);
          return (
            <Chip
              key={key}
              label={t(`onboarding.traits.${key}`)}
              selected={selected}
              onPress={() => toggle(key)}
            />
          );
        })}
      </View>

      {strays.length > 0 ? (
        <View style={styles.chips}>
          {strays.map((tag) => (
            <RemovableChip
              key={tag}
              // The stored slug stays the value; only the label is humanized.
              label={tagLabel(tag)}
              onRemove={() => onChange(tags.filter((existing) => existing !== tag))}
            />
          ))}
        </View>
      ) : null}

      {/* Speak the cap in words when it is actually near (docs/DESIGN.md §10). */}
      {tags.length >= MAX_PERSONALITY ? (
        <Text style={styles.cap}>{t("profile.personalityCap", { max: MAX_PERSONALITY })}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  empty: { ...type.caption, color: colors.textMuted },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  addField: { flex: 1, minWidth: 0, minHeight: 44 },
  /**
   * A fixed 44pt square, not a label.
   *
   * As a text button ("+ Add") its width came from a translated string, so the row
   * was only ever as correct as the longest locale — and it already overflowed in
   * English, pushing the control off the right edge of the screen where it could
   * not be tapped at all (U6). A square removes the variable: the field takes
   * whatever is left, and the target is exactly 44pt in every language.
   *
   * The glyph is not the only signal — `accessibilityLabel` still carries
   * "Add interest", which is what a screen reader announces.
   */
  addButton: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: { backgroundColor: colors.border },
  cap: { ...type.caption, color: colors.textMuted },
});