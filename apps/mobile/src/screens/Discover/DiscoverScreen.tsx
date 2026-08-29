import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueries } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { Chip } from "../../components/common/Chip";
import { ScreenState } from "../../components/common/ScreenState";
import { EventCard } from "../../components/events/EventCard";
import { InteractiveMap } from "../../components/map/InteractiveMap";
import {
  BottomSheet,
  type BottomSheetHandle,
} from "../../components/ui/BottomSheet";
import { Material } from "../../components/ui/Material";
import { PressableScale } from "../../components/ui/PressableScale";
import {
  useMyEvents,
  useNearbyEvents,
} from "../../features/events/hooks/useEvents";
import { eventsApi } from "../../services/api/events";
import { useAuthStore, useUiStore } from "../../store";
import {
  colors,
  elevation,
  radius,
  sectionHeader,
  spacing,
  type,
} from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Coords, MeetupEvent } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Discover">;

const CATEGORIES = [
  { key: "food", icon: "🍜" },
  { key: "gaming", icon: "🎮" },
  { key: "arts", icon: "🎨" },
  { key: "outdoor", icon: "🥾" },
] as const;

const FALLBACK_COORDS: Coords = { lat: 35.6595, lng: 139.7005 };

/**
 * Map-first discovery.
 *
 * The map is the screen and the list rides on a detented sheet over it, so
 * browsing is a spatial act rather than scrolling a feed with a thumbnail on top.
 * Floating chrome is translucent with the map moving underneath (skill §12)
 * instead of an opaque bar eating a strip of the viewport.
 */
export function DiscoverScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const category = useUiStore((s) => s.selectedCategory);
  const setCategory = useUiStore((s) => s.setSelectedCategory);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheet = useRef<BottomSheetHandle>(null);

  // One-shot location read for discovery only — no background tracking.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        if (!cancelled) setCoords(FALLBACK_COORDS);
        return;
      }

      /**
       * `getCurrentPositionAsync` hangs rather than rejects when the device has
       * no fix, so a plain `.catch()` never fires and the screen would spin
       * forever. Race it and fall back.
       */
      const position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (cancelled) return;

      setCoords(
        position
          ? { lat: position.coords.latitude, lng: position.coords.longitude }
          : FALLBACK_COORDS
      );
    })().catch(() => {
      if (!cancelled) setCoords(FALLBACK_COORDS);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const query = useNearbyEvents(coords, category);
  const events = query.data?.events ?? [];

  const mine = useMyEvents();
  const myEvents = mine.data?.events ?? [];
  const needsFeedback = myEvents.filter((e) => e.status === "completed");

  const previews = useQueries({
    queries: events.map((event) => ({
      queryKey: ["events", event.id, "match-preview"],
      queryFn: () => eventsApi.matchPreview(event.id),
      staleTime: 60_000,
    })),
  });

  const scoreFor = (index: number) => previews[index]?.data?.match_score;

  const open = useCallback(
    (eventId: string) => navigation.navigate("Meetup", { eventId }),
    [navigation]
  );

  /** Selecting a pin drops the sheet to peek so the map has room to breathe. */
  const selectPin = useCallback((eventId: string) => {
    setSelectedId(eventId);
    sheet.current?.snapTo("peek");
  }, []);

  const selectFromList = useCallback((eventId: string) => {
    setSelectedId(eventId);
    sheet.current?.snapTo("half");
  }, []);

  return (
    <View style={styles.root}>
      <InteractiveMap
        events={events}
        selectedId={selectedId}
        onSelect={selectPin}
        onOpen={open}
      />

      {/* Floating chrome — the map scrolls underneath it */}
      <View
        style={[styles.topChrome, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <Material weight="regular" style={styles.identity}>
          <View style={styles.identityInner}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.handle ?? "?").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.handle} numberOfLines={1}>
                @{user?.handle ?? "you"}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {t("discover.subtitle")}
              </Text>
            </View>
          </View>
        </Material>

        <View style={styles.chromeActions}>
          <PressableScale
            accessibilityLabel={t("connection.title")}
            onPress={() => navigation.navigate("Connections")}
            style={styles.iconButton}
            scaleTo={0.9}
          >
            <Text style={styles.iconGlyph}>♥</Text>
          </PressableScale>
          <PressableScale
            accessibilityLabel={t("settings.title")}
            onPress={() => navigation.navigate("Settings")}
            style={styles.iconButton}
            scaleTo={0.9}
          >
            <Text style={styles.iconGlyph}>⚙</Text>
          </PressableScale>
        </View>
      </View>

      {/* Category filters float over the map, below the identity chrome */}
      <View
        style={[styles.filterRail, { top: insets.top + 78 }]}
        pointerEvents="box-none"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Chip
            label={t("discover.categories.all")}
            selected={category === null}
            onPress={() => setCategory(null)}
            tone="neutral"
          />
          {CATEGORIES.map((item) => (
            <Chip
              key={item.key}
              icon={item.icon}
              label={t(`discover.categories.${item.key}`)}
              selected={category === item.key}
              onPress={() => setCategory(item.key)}
              tone="neutral"
            />
          ))}
        </ScrollView>
      </View>

      <BottomSheet
        ref={sheet}
        initial="half"
        header={
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("discover.forYou")}</Text>
            <PressableScale
              accessibilityLabel={t("createEvent.title")}
              onPress={() => navigation.navigate("CreateEvent")}
              style={styles.hostButton}
              scaleTo={0.93}
            >
              <Text style={styles.hostLabel}>+ {t("createEvent.short")}</Text>
            </PressableScale>
          </View>
        }
      >
        <ScrollView
          contentContainerStyle={[
            styles.sheetBody,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {needsFeedback.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>
                {t("discover.yourMeetups")}
              </Text>
              {needsFeedback.map((event) => (
                <FeedbackRow key={event.id} event={event} onPress={() => open(event.id)} />
              ))}
            </View>
          ) : null}

          {query.isPending ? (
            <ScreenState status="loading" />
          ) : query.isError ? (
            <ScreenState status="error" onRetry={() => query.refetch()} />
          ) : events.length === 0 ? (
            <ScreenState status="empty" />
          ) : (
            <View style={styles.section}>
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  matchScore={scoreFor(index)}
                  selected={event.id === selectedId}
                  onPress={() => selectFromList(event.id)}
                  onOpen={() => open(event.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function FeedbackRow({
  event,
  onPress,
}: {
  event: MeetupEvent;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  return (
    <PressableScale
      accessibilityLabel={`${event.title} — ${t("discover.leaveFeedback")}`}
      onPress={onPress}
      style={styles.feedbackRow}
      scaleTo={0.98}
    >
      <View style={styles.feedbackDot} />
      <View style={styles.feedbackBody}>
        <Text style={styles.feedbackTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.feedbackMeta}>{t("discover.leaveFeedback")}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  topChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  identity: { flex: 1, ...elevation.medium },
  identityInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...type.captionEmphasized, color: colors.textOnColor, fontSize: 15 },
  identityText: { flex: 1 },
  handle: { ...type.headline, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted },

  chromeActions: { flexDirection: "row", gap: spacing.sm },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.medium,
  },
  iconGlyph: { fontSize: 18, color: colors.text },

  filterRail: { position: "absolute", left: 0, right: 0 },
  filterRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sheetTitle: { ...type.title2, color: colors.text },
  hostButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  hostLabel: { ...type.footnote, color: colors.primary, fontWeight: "700" },

  sheetBody: { paddingHorizontal: spacing.md, gap: spacing.md },
  section: { gap: spacing.sm },
  sectionHeader: { ...sectionHeader, color: colors.textMuted, marginBottom: spacing.xxs },

  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md - 2,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  feedbackDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  feedbackBody: { flex: 1 },
  feedbackTitle: { ...type.bodyEmphasized, color: colors.text },
  feedbackMeta: { ...type.caption, color: colors.primary, fontWeight: "600" },
  chevron: { ...type.title3, color: colors.textMuted },
});
