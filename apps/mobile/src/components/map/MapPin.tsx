import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { colors, elevation, radius, spacing, springs, type } from "../../theme";
import type { MeetupEvent } from "../../types/api";

interface MapPinProps {
  event: MeetupEvent;
  x: number;
  y: number;
  selected: boolean;
  /** The map's live zoom, so the pin can hold its own size. */
  mapScale: SharedValue<number>;
  onPress: () => void;
  onOpen: () => void;
}

const CATEGORY_GLYPH: Record<string, string> = {
  food: "🍜",
  gaming: "🎮",
  arts: "🎨",
  outdoor: "🥾",
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A map annotation.
 *
 * The detail that sells it: the pin **counter-scales against the map's zoom**, so
 * it stays a readable, tappable object at every zoom level instead of ballooning
 * with the artwork — the behaviour every real map app has and hand-rolled ones
 * usually miss.
 *
 * Selection grows the pin *up and out* toward the finger, telegraphing where the
 * interaction is heading rather than merely interpolating to a new state
 * (skill §8).
 */
export function MapPin({
  event,
  x,
  y,
  selected,
  mapScale,
  onPress,
  onOpen,
}: MapPinProps) {
  const selection = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    selection.value = withSpring(selected ? 1 : 0, springs.sheet);
  }, [selected, selection]);

  const containerStyle = useAnimatedStyle(() => {
    // Hold apparent size as the map zooms, easing off so pins still feel
    // attached to the ground rather than floating free of it.
    const counter = 1 / Math.pow(mapScale.value, 0.82);
    const lift = interpolate(selection.value, [0, 1], [0, -10]);
    const grow = interpolate(selection.value, [0, 1], [1, 1.18]);
    const press = 1 - pressed.value * 0.08;

    return {
      transform: [
        { translateX: -0 },
        { translateY: lift },
        { scale: counter * grow * press },
      ],
      zIndex: selected ? 20 : 10,
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

  const full = event.current_size >= event.max_size;

  return (
    <View style={[styles.anchor, { left: x, top: y }]} pointerEvents="box-none">
      <Animated.View style={[styles.stack, containerStyle]} pointerEvents="box-none">
        {/* Selection halo — spatial context for which pin is active */}
        <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />

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
          style={[styles.bubble, selected && styles.bubbleSelected]}
        >
          <Text style={styles.glyph}>
            {CATEGORY_GLYPH[event.category] ?? "📍"}
          </Text>
        </AnimatedPressable>

        {/* Stem grounds the bubble to its coordinate */}
        <View style={[styles.stem, selected && styles.stemSelected]} />

        <Animated.View style={[styles.label, labelStyle]} pointerEvents="none">
          <Text style={styles.labelTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.labelMeta}>
            {full ? "Full" : `${event.current_size}/${event.max_size}`} ·{" "}
            {event.venue_name}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const SIZE = 44;

const styles = StyleSheet.create({
  anchor: { position: "absolute", width: 0, height: 0 },
  stack: {
    position: "absolute",
    // Centre the bubble on the coordinate and sit the stem on the point.
    left: -SIZE / 2,
    top: -(SIZE + 10),
    alignItems: "center",
  },
  halo: {
    position: "absolute",
    top: 2,
    width: SIZE * 2.4,
    height: SIZE * 2.4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...elevation.medium,
  },
  bubbleSelected: {
    backgroundColor: colors.primary,
    borderColor: "#FFFFFF",
  },
  glyph: { fontSize: 20, lineHeight: 24 },
  stem: {
    width: 3,
    height: 10,
    backgroundColor: colors.surface,
    marginTop: -1,
    borderRadius: 2,
  },
  stemSelected: { backgroundColor: colors.primary },
  label: {
    marginTop: spacing.xs,
    maxWidth: 190,
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
