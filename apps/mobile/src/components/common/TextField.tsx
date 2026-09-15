import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { PressableScale } from "../ui/PressableScale";
import { IconEye, IconEyeOff } from "../ui/Icons";
import { colors, radius, spacing, type } from "../../theme";

interface TextFieldProps extends Omit<TextInputProps, "style"> {
  /** Leading prefix inside the field, e.g. "@" for a handle. */
  prefix?: string;
  /**
   * Styles the **inner `TextInput`** — text colour, alignment, height.
   *
   * Layout that positions the field inside a row (`flex`, `width`, `margin`) must
   * go to `containerStyle` instead: this one lands on the input, inside the
   * bordered wrapper, where a `flex: 1` has nothing to resolve against.
   */
  style?: StyleProp<TextStyle>;
  /**
   * Styles the bordered wrapper — this is the one that takes layout.
   *
   * It exists because passing `{ flex: 1 }` through `style` silently did nothing:
   * the wrapper kept sizing to its content, so in a row with a button beside it
   * the row overflowed and pushed the button off the right edge of the screen
   * (the "+ Add" control in `TagEditor`). The prop that looked like it should work
   * was reaching the wrong view.
   */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The one form-input surface. Before this, every screen hand-rolled its input
 * chrome and they drifted — border width (1 vs hairline), height (46/48/52),
 * corner radius (md vs lg), field background (surface vs background). This is
 * the single source: 48pt field on white paper with a hairline border.
 *
 * Chat composers are intentionally not this component — they are rounder and
 * tighter because they live in a composer row, not a form.
 *
 * ## Passwords
 *
 * Passing `secureTextEntry` gets a reveal toggle for free. It lives here rather
 * than in the auth screen so every password field in the app has it — a masked
 * field with no way to check what you typed is the single most common cause of a
 * failed sign-in on a phone keyboard, and the app had no toggle anywhere.
 */
export function TextField({
  prefix,
  style,
  containerStyle,
  multiline,
  onFocus,
  onBlur,
  secureTextEntry,
  ...inputProps
}: TextFieldProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Only a field that asked to be masked gets the control.
  const maskable = !!secureTextEntry;

  return (
    <View
      style={[
        styles.field,
        focused && styles.fieldFocused,
        multiline && styles.fieldMultiline,
        containerStyle,
      ]}
    >
      {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
      <TextInput
        multiline={multiline}
        secureTextEntry={maskable && !revealed}
        placeholderTextColor={colors.textMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        {...inputProps}
      />
      {maskable ? (
        <PressableScale
          // The label states the *action*, not the state, so a screen reader user
          // hears what the tap will do rather than having to infer it.
          accessibilityLabel={t(revealed ? "auth.hidePassword" : "auth.showPassword")}
          accessibilityState={{ selected: revealed }}
          onPress={() => setRevealed((value) => !value)}
          haptic="none"
          scaleTo={0.9}
          style={styles.reveal}
        >
          {revealed ? (
            <IconEyeOff size={20} color={colors.textMuted} />
          ) : (
            <IconEye size={20} color={colors.textMuted} />
          )}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  /** The field signals focus with the action colour — where your cursor is. */
  fieldFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  fieldMultiline: {
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
  },
  prefix: { ...type.body, color: colors.textMuted },
  input: {
    flex: 1,
    ...type.callout,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    textAlignVertical: "top",
  },
  // Sits inside the field's own padding. `PressableScale` already applies the
  // shared 8pt hit slop, which carries this to a comfortable target without
  // making the field taller.
  reveal: { alignItems: "center", justifyContent: "center", paddingLeft: spacing.xs },
});