import { StyleSheet, Text, View } from "react-native";

import { Card } from "../ui/Card";
import { IconChevronRight } from "../ui/Icons";
import { PressableScale } from "../ui/PressableScale";
import { colors, radius, spacing, type } from "../../theme";

interface WrapUpRowProps {
  label: string;
  /** Optional second line — context for what the destination holds. */
  detail?: string;
  onPress: () => void;
  /** Draws the row in the action register, for the one thing still to do. */
  emphasis?: boolean;
}

/**
 * A row that opens a destination from the meetup detail.
 *
 * Shares the chevron-in-a-well treatment with `GroupChatCard` and the
 * connections list, so every "this opens somewhere else" affordance in the app
 * reads as one component family rather than three coincidences.
 */
export function WrapUpRow({ label, detail, onPress, emphasis }: WrapUpRowProps) {
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      haptic="none"
    >
      <Card style={styles.card}>
        <View style={styles.body}>
          <Text style={[styles.label, emphasis && styles.labelEmphasis]}>
            {label}
          </Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
        <View style={styles.chevron}>
          <IconChevronRight
            size={18}
            color={emphasis ? colors.primary : colors.textMuted}
          />
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  body: { flex: 1, gap: spacing.xxs },
  label: { ...type.bodyEmphasized, color: colors.text },
  labelEmphasis: { color: colors.primaryInk },
  detail: { ...type.footnote, color: colors.textMuted },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
});
