import { StyleSheet, Text, TextInput, View } from "react-native";
import type { StyleProp, TextInputProps, TextStyle } from "react-native";

import { colors, radius, spacing, type } from "../../theme";

interface TextFieldProps extends Omit<TextInputProps, "style"> {
  /** Leading prefix inside the field, e.g. "@" for a handle. */
  prefix?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * The one form-input surface. Before this, every screen hand-rolled its input
 * chrome and they drifted — border width (1 vs hairline), height (46/48/52),
 * corner radius (md vs lg), field background (surface vs background). This is
 * the single source: 48pt field on white paper with a hairline border.
 *
 * Chat composers are intentionally not this component — they are rounder and
 * tighter because they live in a composer row, not a form.
 */
export function TextField({
  prefix,
  style,
  multiline,
  ...inputProps
}: TextFieldProps) {
  return (
    <View
      style={[
        styles.field,
        multiline && styles.fieldMultiline,
      ]}
    >
      {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
      <TextInput
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        {...inputProps}
      />
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
});