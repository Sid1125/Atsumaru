import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { colors, elevation, radius, spacing, springs, type } from "../../theme";
import { categoryGlyph, categorySticker } from "../../categoryMeta";
import type { MeetupEvent } from "../../types/api";

/** Bubble diameter. */
const BUBBLE = 44;
/** Stem length — the pin's point sits this far below the bubble. */
const STEM = 10;

/**
 * Reserved height for the selection label below the point. Fixed rather than
 * content-sized so the box has stable dimensions: a Mapbox `MarkerView` is a
 * native view annotation, and a child drawn outside its measured bounds is
 * clipped on Android. Sized for the two-line card (6+16+16+1+6) plus its gap.
 */
const LABEL_SLOT = 52;

/**
 * The pin's laid-out box, identical on both maps. Wide enough for the widest
 * label and tall enough for bubble + stem + label, so nothing overflows.
 */
export const PIN_BOX = { width: 190, height: BUBBLE + STEM + LABEL_SLOT };

/**
 * Distance from the top of the box to the coordinate it marks — the bottom of the
 * stem. Everything below that is label. Divided by the box height this is the
 * vertical anchor a `MarkerView` needs; subtracted from 0 it is the offset the
 * vector map positions by.
 */
export const PIN_POINT_Y = BUBBLE + STEM;

interface PinBodyProps {
  event: MeetupEvent;
  selected: boolean;
  onPress: () => void;
  onOpen: () => void;
  /**
   * The map's live zoom, when the host map scales its pins along with its artwork
   * (the hand-authored SVG city does; Mapbox positions screen-space annotations
   * itself and leaves their size alone). Supplying it makes the pin
   * counter-scale so it holds its apparent size.
   */
  counterScale?: SharedValue<number>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The map annotation itself — bubble, stem, selection halo and label — with no
 * opinion about how it is positioned. Both maps render this, so a pin looks and
 * behaves identically whether the surface underneath is Mapbox or the vector city.
 *
 * Selection grows the pin *up and out* toward the finger, telegraphing where the
 * interaction is heading rather than merely interpolating to a new state
 * (skill §8). Where a `counterScale` is supplied the pin **counter-scales against
 * the map's zoom**, so it stays a readable, tappable object at every zoom level
 * instead of ballooning with the artwork — the behaviour every real map app has
 * and hand-rolled ones usually miss.
 */
export function PinBody({
  event,
  selected,
  onPress,
  onOpen,
  counterScale,
}: PinBodyProps) {
  const selection = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    selection.value = withSpring(selected ? 1 : 0, springs.sheet);
  }, [selected, selection]);

  const stackStyle = useAnimatedStyle(() => {
    // Hold apparent size as the map zooms, easing off so pins still feel
    // attached to the ground rather than floating free of it.
    const counter = counterScale ? 1 / Math.pow(counterScale.value, 0.82) : 1;
    const lift = interpolate(selection.value, [0, 1], [0, -10]);
    const grow = interpolate(selection.value, [0, 1], [1, 1.18]);
    const press = 1 - pressed.value * 0.08;

    return {
      transform: [{ translateY: lift }, { scale: counter * grow * press }],
    };
  });

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selection.value, [0, 1], [0, 0.28]),
    transform: [{ scale: interpolate(selection.value, [0, 1], [0.6, 1]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [
      { translateY: interpolate(selection.value, [0, 1], [-6, 0]) },
      { scale: interpolate(selection.value, [0, 1], [0.9, 1]) },
    ],
  }));

  const { t } = useTranslation();
  const full = event.current_size >= event.max_size;
  const sticker = categorySticker(event.category);
  const glyph = categoryGlyph(event.category);

  return (
    // box-none throughout: the box is mostly empty space around a 44pt bubble,
    // and an opaque one would swallow pans meant for the map and taps meant for
    // the pin behind it.
    <View style={styles.box} pointerEvents="box-none">
      {/* Scaling is confined to the pin, so the label keeps its own size and
          stays legible while the bubble grows. */}
      <Animated.View style={[styles.stack, stackStyle]} pointerEvents="box-none">
        {/* Selection halo — spatial context for which pin is active */}
        <Animated.View
          style={[styles.halo, { backgroundColor: sticker.bg }, haloStyle]}
          pointerEvents="none"
        />

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={`${event.title}, ${event.venue_name}, ${event.current_size} of ${event.max_size} people`}
          accessibilityState={{ selected }}
          hitSlop={12}
          onPressIn={() => {
            pressed.value = withSpring(1, springs.snappy);
          }}
          onPressOut={() => {
            pressed.value = withSpring(0, springs.snappy);
          }}
          onPress={selected ? onOpen : onPress}
          style={[
            styles.bubble,
            { backgroundColor: sticker.bg },
            selected && styles.bubbleSelected,
          ]}
        >
          <Text style={styles.glyph}>{glyph}</Text>
        </AnimatedPressable>

        {/* Stem grounds the bubble to its coordinate */}
        <View
          style={[styles.stem, { backgroundColor: sticker.bg }]}
          pointerEvents="none"
        />
      </Animated.View>

      <View style={styles.labelSlot} pointerEvents="none">
        <Animated.View style={[styles.label, labelStyle]}>
          <Text style={styles.labelTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.labelMeta} numberOfLines={1}>
            {full ? t("discover.status.full") : `${event.current_size}/${event.max_size}`} ·{" "}
            {event.venue_name}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: PIN_BOX.width,
    height: PIN_BOX.height,
    alignItems: "center",
  },
  stack: { alignItems: "center" },
  halo: {
    position: "absolute",
    top: 2,
    width: BUBBLE * 2.4,
    height: BUBBLE * 2.4,
    borderRadius: radius.pill,
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.textOnColor,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleSelected: {
    borderWidth: 3,
  },
  glyph: { fontSize: 20, lineHeight: 24 },
  stem: {
    width: 3,
    height: STEM,
    marginTop: -1,
    borderRadius: 2,
  },
  labelSlot: {
    height: LABEL_SLOT,
    paddingTop: spacing.xs,
    alignItems: "center",
    alignSelf: "stretch",
  },
  label: {
    maxWidth: PIN_BOX.width,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    ...elevation.medium,
  },
  labelTitle: { ...type.captionEmphasized, color: colors.text },
  labelMeta: { ...type.caption, color: colors.textMuted, marginTop: 1 },
});
