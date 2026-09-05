import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";

import { colors, spacing } from "../../theme";

/**
 * The chrome every full-screen chat sits in — group thread and DM alike.
 *
 * This exists because of a specific, reported bug (TRACKER §5j): on the release
 * build the composer rendered **behind the Android navigation bar**, so the text
 * input and Send button dispatched Home instead of focusing. The primary chat
 * action was unreachable. Two independent defects stacked:
 *
 *   1. **No bottom inset.** Expo SDK 54+/RN 0.86 force Android edge-to-edge, so
 *      the app draws under the nav bar. Nothing on the chat surface accounted
 *      for it — `DmScreen` used a flat `padding: spacing.page` (20pt), which
 *      does not clear a 48dp three-button nav bar.
 *   2. **No working keyboard handling.** `KeyboardAvoidingView` is unreliable
 *      under Android edge-to-edge, because the window is no longer resized — the
 *      IME arrives as an *inset*. `DmScreen`'s
 *      `behavior={Platform.OS === "ios" ? "padding" : undefined}` was therefore
 *      a literal no-op on the exact platform where the bug was found.
 *
 * `useAnimatedKeyboard` reads that inset directly and drives the padding on the
 * UI thread — one code path for both platforms, no new dependency, and no
 * `KeyboardAvoidingView` to mis-tune. The bottom padding is the *larger* of the
 * keyboard and the safe-area inset, so the composer clears the nav bar when the
 * keyboard is down and sits on the keyboard when it is up.
 *
 * Every full-screen chat must go through here. Do not re-add a bare `padding:`
 * shorthand to a chat container.
 */
export function ChatScreenShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();

  const padding = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom, spacing.sm),
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.body, padding]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    // Per-edge, never the `padding` shorthand — the bottom edge is owned by the
    // animated style above and a shorthand would silently overwrite it.
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
  },
});
