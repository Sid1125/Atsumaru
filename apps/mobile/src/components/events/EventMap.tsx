import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../theme";
import { MAPBOX_PUBLIC_TOKEN } from "../../config/env";
import type { MeetupEvent } from "../../types/api";

interface EventMapProps {
  events: MeetupEvent[];
  onSelect: (eventId: string) => void;
}

// @rnmapbox/maps needs a native dev build plus a public token. In Expo Go (or
// without a token) we render a placeholder instead of crashing the screen.
// ponytail: require-in-try keeps the fallback in one file; swap for a static
// import once the dev build is the only way the app runs.
function loadMapbox() {
  if (!MAPBOX_PUBLIC_TOKEN) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Mapbox = require("@rnmapbox/maps");
    Mapbox.default.setAccessToken(MAPBOX_PUBLIC_TOKEN);
    return Mapbox;
  } catch {
    return null;
  }
}

const Mapbox = loadMapbox();

export function EventMap({ events, onSelect }: EventMapProps) {
  if (!Mapbox) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Map needs a dev build + EXPO_PUBLIC_MAPBOX_TOKEN
        </Text>
        <Text style={styles.placeholderText}>
          {events.length} nearby meetup(s) loaded
        </Text>
      </View>
    );
  }

  const { MapView, Camera, PointAnnotation } = Mapbox;
  const first = events[0];

  return (
    <MapView style={styles.map} styleURL={Mapbox.default.StyleURL?.Street}>
      <Camera
        zoomLevel={12}
        centerCoordinate={
          first ? [first.location.lng, first.location.lat] : [139.7, 35.68]
        }
      />
      {events.map((event) => (
        <PointAnnotation
          key={event.id}
          id={event.id}
          coordinate={[event.location.lng, event.location.lat]}
          onSelected={() => onSelect(event.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 220, borderRadius: radius.md, overflow: "hidden" },
  placeholder: {
    height: 220,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.md,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
});
