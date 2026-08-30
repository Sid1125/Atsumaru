import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { radius } from "../../theme";

/**
 * The site's vinyl sticker: a solid coloured shape sitting on a hard offset
 * "3px 4px 0" shadow (site/globals.css `.sticker-badge`). React Native's
 * `elevation` only does soft shadows and only on Android, so the shadow is a
 * plain underlay shifted by the offset — it renders identically on both
 * platforms and in Expo Go. Optional tilt, like the site decals.
 *
 * Colour/text decisions stay with the caller (see `colors.sticker`); this
 * component owns the physicality only.
 */
export function Sticker({
  color,
  on,
  rotate = 0,
  borderRadius = radius.md,
  shadow = true,
  offset = 3,
  style,
  children,
}: {
  color: string;
  on?: string;
  rotate?: number;
  borderRadius?: number;
  shadow?: boolean;
  /** Offset depth in points — the harder the shadow, the louder the sticker. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        style,
        rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
      ]}
    >
      {shadow ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          style={[
            styles.underlay,
            { borderRadius, top: offset, left: offset },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.body,
          { backgroundColor: color, borderRadius },
          on ? { borderColor: on, borderWidth: 1.5 } : null,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  underlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(9,9,11,0.9)",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});