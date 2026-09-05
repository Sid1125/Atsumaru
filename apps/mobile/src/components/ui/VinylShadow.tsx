import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "../../theme";

/**
 * The hard offset underlay beneath every vinyl surface — the site's
 * `box-shadow: 3px 4px 0` (site/globals.css `.sticker-badge`), which React Native
 * cannot express: `elevation` is Android-only and soft, and iOS `shadowRadius: 0`
 * still blurs at the corners. So it is a plain shifted `View`.
 *
 * It existed **five separate times** before this: inside `Sticker`, again inside
 * `Tape`, again in `Button`'s `vinyl` variant, and inline in both
 * `DiscoverScreen.hostShadow` and `ProfileScreen.statsShadow` — with three
 * different offsets between them. The offset *is* the brand's physicality, so five
 * implementations meant five slightly different depths for the same idea.
 *
 * Always absolutely positioned behind its sibling, so the parent needs
 * `position: relative` (the RN default) and the shadow must come first in the tree.
 *
 * ## The geometry, which every one of those five got wrong
 *
 * All five wrote `top: offset, left: offset, right: 0, bottom: 0`. That *insets* the
 * underlay from the top-left and leaves it flush at the bottom-right — entirely
 * inside the body, which is opaque and painted after it. **The result is that the
 * hard offset shadow never rendered, anywhere, on any surface.** Confirmed by
 * magnifying a rendered sticker: flat colour, no offset.
 *
 * An offset shadow has to extend *past* the body on the side it falls toward, so
 * the shifted rectangle is `top/left: +offset` **and** `right/bottom: -offset`.
 *
 * Consequence worth knowing: it now draws outside its parent's bounds, so any
 * ancestor with `overflow: "hidden"` will clip it back to invisible.
 */
export function VinylShadow({
  /** Depth in points. The harder the offset, the louder the surface. */
  offset = 3,
  borderRadius,
  style,
}: {
  offset?: number;
  borderRadius: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.underlay,
        { borderRadius, top: offset, left: offset, right: -offset, bottom: -offset },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  underlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.vinylShadow,
  },
});
