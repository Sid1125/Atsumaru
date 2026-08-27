import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";

import { Chip } from "../../components/common/Chip";
import { ScreenState } from "../../components/common/ScreenState";
import { EventCard } from "../../components/events/EventCard";
import { EventMap } from "../../components/events/EventMap";
import { useNearbyEvents } from "../../features/events/hooks/useEvents";
import { useAuthStore, useUiStore } from "../../store";
import { colors, spacing, typography } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Coords } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Discover">;

const CATEGORIES = ["food", "gaming", "arts", "outdoor"] as const;

// Shibuya fallback so the demo still shows something without a location grant.
const FALLBACK_COORDS: Coords = { lat: 35.6595, lng: 139.7005 };

export function DiscoverScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const category = useUiStore((s) => s.selectedCategory);
  const setCategory = useUiStore((s) => s.setSelectedCategory);

  const [coords, setCoords] = useState<Coords | null>(null);

  // One-shot location read for discovery only — no background tracking (docs/RULES.md §11).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        if (!cancelled) setCoords(FALLBACK_COORDS);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      if (!cancelled) {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      }
    })().catch(() => {
      if (!cancelled) setCoords(FALLBACK_COORDS);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const query = useNearbyEvents(coords, category);
  const events = query.data?.events ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.handle}>@{user?.handle ?? "you"}</Text>
      <Text style={styles.subtitle}>{t("discover.subtitle")}</Text>

      <EventMap
        events={events}
        onSelect={(eventId) => navigation.navigate("Meetup", { eventId })}
      />

      <View style={styles.filters}>
        <Chip
          label={t("discover.categories.all")}
          selected={category === null}
          onPress={() => setCategory(null)}
        />
        {CATEGORIES.map((key) => (
          <Chip
            key={key}
            label={t(`discover.categories.${key}`)}
            selected={category === key}
            onPress={() => setCategory(key)}
          />
        ))}
      </View>

      <Text style={styles.section}>{t("discover.forYou")}</Text>

      {query.isPending ? (
        <ScreenState status="loading" />
      ) : query.isError ? (
        <ScreenState status="error" onRetry={() => query.refetch()} />
      ) : events.length === 0 ? (
        <ScreenState status="empty" />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => navigation.navigate("Meetup", { eventId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  handle: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { ...typography.heading, color: colors.text },
  list: { gap: spacing.sm, paddingBottom: spacing.lg },
});
