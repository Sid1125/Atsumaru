import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { PinBody, PIN_BOX, PIN_POINT_Y } from "./PinBody";
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

/**
 * A pin on the hand-authored vector city: absolutely positioned in world units
 * inside the container the gesture layer transforms.
 *
 * Everything visual lives in `PinBody`, which the Mapbox map renders too, so the
 * two surfaces cannot drift. All this adds is the offset that lands the stem's
 * point on the coordinate, and a raised z-index for the selected pin so its label
 * is not covered by a neighbour's bubble.
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
  return (
    <View
      style={[
        styles.anchor,
        {
          left: x - PIN_BOX.width / 2,
          top: y - PIN_POINT_Y,
          zIndex: selected ? 20 : 10,
        },
      ]}
      pointerEvents="box-none"
    >
      <PinBody
        event={event}
        selected={selected}
        onPress={onPress}
        onOpen={onOpen}
        counterScale={mapScale}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute" },
});
