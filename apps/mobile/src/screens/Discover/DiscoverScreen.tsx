import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import {
  CATEGORY_ORDER,
  categoryIcon,
  categorySticker,
} from "../../categoryMeta";
import { Chip } from "../../components/common/Chip";
import { Avatar } from "../../components/common/Avatar";
import { ScreenState } from "../../components/common/ScreenState";
import { EventCard } from "../../components/events/EventCard";
import { MapSurface } from "../../components/map/MapSurface";
import {
  IconConnections,
  IconLocate,
} from "../../components/ui/Icons";
import {
  BottomSheet,
  type BottomSheetHandle,
  useBottomSheetScrollable,
} from "../../components/ui/BottomSheet";
import { PressableScale } from "../../components/ui/PressableScale";
import { Material } from "../../components/ui/Material";
import { EditorialRow } from "../../components/common/EditorialRow";
import { ScreenHeader } from "../../components/common/ScreenHeader";
import { ScrollEdge } from "../../components/ui/ScrollEdge";
import { VinylShadow } from "../../components/ui/VinylShadow";
import {
  useMyEvents,
  useNearbyEvents,
} from "../../features/events/hooks/useEvents";
import { eventsApi } from "../../services/api/events";
import { usePersistLocation } from "../../features/location/usePersistLocation";
import { EXPOSED_FRACTION } from "../../components/map/framing";
import type { MapSurfaceHandle } from "../../components/map/MapSurface";
import { useAuthStore, useLocationStore, useUiStore } from "../../store";
import {
  colors,
  radius,
  spacing,
  STAGGER_STEP,
  timings,
  type,
  useReducedMotion,
} from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Coords, MeetupEvent } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Discover">;

const FALLBACK_COORDS: Coords = { lat: 35.6595, lng: 139.7005 };

/**
 * The radius the ring draws, in kilometres.
 *
 * It is 5 because that is what the query actually asks for — `eventsApi.nearby` sends
 * `radius: 5000` and the server defaults to the same. The ring is only honest while those
 * three agree, so changing one means changing all three.
 */
const NEARBY_RADIUS_KM = 5;

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
  const setLastFix = useLocationStore((s) => s.setLastFix);

  const [coords, setCoords] = useState<Coords | null>(null);
  /**
   * Discovery runs on a fallback area, and it is because the user denied the
   * location permission (as opposed to a one-off no-fix). Distinct from the
   * silent Shibuya fallback so a denied user gets a named, actionable nudge
   * instead of being quietly stranded in a city they may not be in.
   */
  const [permissionDenied, setPermissionDenied] = useState(false);
  /**
   * True only when `coords` came from the device rather than the Shibuya fallback. The
   * "meetup near you" notice is built on the saved point, and saving a fallback would make
   * it confidently wrong for everyone who denied the permission or got no fix.
   */
  const [hasRealFix, setHasRealFix] = useState(false);
  /**
   * Where the user has panned the map to, once they have. Held separately from the
   * location fix so the fix stays a genuine one-shot read (docs/RULES.md — no
   * background tracking): panning changes what is queried, never what the device
   * reported, which is also what lets discovery fall back to the fix.
   */
  const [pannedTo, setPannedTo] = useState<Coords | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bandBottom, setBandBottom] = useState(0);
  const map = useRef<MapSurfaceHandle>(null);
  const sheet = useRef<BottomSheetHandle>(null);

  // One-shot location read for discovery only — no background tracking.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        if (!cancelled) {
          setPermissionDenied(true);
          setCoords(FALLBACK_COORDS);
        }
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

      setPermissionDenied(false);
      setHasRealFix(!!position);
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

  // Saves the fix above once per session, so the "meetup near you" notice has a point to
  // work from. No new reading is taken.
  usePersistLocation(coords, hasRealFix);

  // Share the same single fix with create-event's venue search — covering the mount read
  // and the re-ask path in one place, and never the Shibuya fallback (hasRealFix gates).
  useEffect(() => {
    if (hasRealFix && coords) setLastFix(coords);
  }, [coords, hasRealFix, setLastFix]);

  const query = useNearbyEvents(pannedTo ?? coords, category);
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

  /**
   * The sheet list: the best-scoring meetup pulled to the top, everything else left
   * in the order the server returned (distance).
   *
   * This is `docs/DESIGN.md` §4's hierarchy — "4. Recommended meetup, 5. Nearby
   * meetup list" — which the screen had flattened into one distance-ordered list
   * while still printing a fit score on every row. The visible symptom was a
   * promoted card reading 30% sitting directly above a row reading 38%: a hierarchy
   * contradicted by the number inside it.
   *
   * Sorting the *whole* list by score would be the other wrong answer, because then
   * "nearby" would stop meaning anything. Only the recommendation moves.
   *
   * `events` itself is deliberately NOT reordered — the map pins and the
   * selection/`previews` indices are keyed to it, and shuffling it underneath them
   * would move pins around as scores arrive.
   */
  const rows = useMemo(() => {
    const scored = events.map((event, index) => ({
      event,
      score: scoreFor(index),
    }));

    let bestAt = -1;
    let bestScore = -Infinity;

    scored.forEach((row, index) => {
      if (row.score != null && row.score > bestScore) {
        bestScore = row.score;
        bestAt = index;
      }
    });

    // Nothing scored yet (previews still in flight) — a flat set of equals is the
    // honest render until one of them can claim to be best.
    if (bestAt < 0) return scored.map((row) => ({ ...row, featured: false }));

    const best = scored[bestAt]!;

    return [
      { ...best, featured: true },
      ...scored.filter((_, index) => index !== bestAt).map((row) => ({ ...row, featured: false })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, previews]);

  const open = useCallback(
    (eventId: string) => navigation.navigate("Meetup", { eventId }),
    [navigation]
  );

  /** The feedback form is one destination, reached from here and from the meetup. */
  const openFeedback = useCallback(
    (eventId: string) => navigation.navigate("Feedback", { eventId }),
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

  /**
   * The camera settled somewhere new, so query there. The map only reports moves
   * the user's own fingers caused, and only past a threshold, so this cannot loop
   * with the framing the map does when results arrive. TanStack Query keys on the
   * coordinates, so the previous area's results stay cached.
   */
  const searchHere = useCallback((center: Coords) => {
    setPannedTo(center);
  }, []);

  /**
   * The user re-tapped the location nudge after denying once. Re-prompt (iOS/
   * Android re-ask on a fresh request) and, if granted, read a fix and drop the
   * fallback — clearing the pan too, since the pan would override the real fix.
   */
  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    try {
      const position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (position) {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setHasRealFix(true);
        setPannedTo(null);
        setPermissionDenied(false);
      }
    } catch {
      /* keep the fallback and the nudge */
    }
  }, []);

  /**
   * Take the map back to the member.
   *
   * Clearing `pannedTo` is the part that matters. The nearby query reads
   * `pannedTo ?? coords`, so without it the camera would fly home while the results stayed
   * pinned to wherever the map was last dragged — the ring and the list would be describing
   * two different places. `requestLocation` above clears it for the same reason.
   *
   * With no fix yet there is nothing to return to, so the control asks for one instead of
   * quietly centring on the Shibuya fallback.
   */
  const recenter = useCallback(() => {
    if (!coords) return;

    setPannedTo(null);
    setSelectedId(null);
    map.current?.recenter(coords);
  }, [coords]);

  return (
    <View style={styles.root}>
      <MapSurface
        ref={map}
        events={events}
        selectedId={selectedId}
        onSelect={selectPin}
        onOpen={open}
        onRegionSettled={searchHere}
        // Only drawn around a real fix. Ringing the Shibuya fallback would draw a
        // confident 5 km circle around somewhere the member may never have been.
        userLocation={hasRealFix ? coords : null}
        radiusKm={NEARBY_RADIUS_KM}
      />

      {/*
        Floating chrome. One material rail, not two floating discs.

        This was two 44pt circular buttons with `nightRaised` fills — the exact
        shape docs/DESIGN.md §1b names when it says "kill the pill smell", and
        opaque, so the map did **not** scroll underneath the chrome the comment
        claimed it did. It also had nowhere for the member's own handle, which
        DESIGN §4 asks for in this slot.

        Now: a single `Material` bar the map genuinely shows through, carrying the
        handle on the left and the two destinations on the right with no per-button
        surface of their own. The avatar stays round because an avatar is a
        portrait, not a control shape.
      */}
      <View
        style={[styles.topChrome, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        {/*
          Two islands, not one bar. A full-width rail across the top of a map is
          heavy chrome that hides the thing the screen is about; splitting it lets
          the map read between them, which is the point of floating chrome at all.
        */}
        <View style={styles.identityRow}>
          <Material
            tone="night"
            weight="thin"
            style={styles.identityPill}
            // Measured on the rail itself, not on a child. The filter row below is
            // positioned from this, and reading it off an inner view gave a
            // near-zero offset — so the chips rendered on top of the handle.
            onLayout={(e) =>
              setBandBottom(
                e.nativeEvent.layout.height + insets.top + spacing.sm
              )
            }
          >
            <Text style={styles.identityHandle} numberOfLines={1}>
              @{user?.handle ?? ""}
            </Text>
          </Material>

          <Material tone="night" weight="thin" style={styles.identityActions}>
            <PressableScale
              accessibilityLabel={t("connection.title")}
              onPress={() => navigation.navigate("Connections")}
              style={styles.railAction}
              scaleTo={0.92}
            >
              <IconConnections size={22} color={colors.nightText} />
            </PressableScale>

            <PressableScale
              accessibilityLabel={t("profile.title")}
              onPress={() => navigation.navigate("Profile")}
              style={styles.railAction}
              scaleTo={0.92}
            >
              <Avatar
                id={user?.id ?? ""}
                label={(user?.handle ?? "?").slice(0, 1)}
                uri={user?.avatar_url}
                size="md"
              />
            </PressableScale>
          </Material>
        </View>
      </View>

      {/* Map controls — right-hand side, above the sheet's resting edge. Deliberately not
          bottom-left: that corner is where Mapbox pins its attribution and wordmark, which
          are a licence condition and cannot be covered. */}
      <View style={styles.mapControls} pointerEvents="box-none">
        <PressableScale
          accessibilityLabel={t("discover.recenter")}
          accessibilityState={{ disabled: !coords }}
          onPress={recenter}
          style={styles.mapControl}
          scaleTo={0.92}
        >
          <IconLocate
            size={20}
            // Disabled state is expressed in colour, never opacity (docs/DESIGN.md).
            color={coords ? colors.nightText : colors.nightMuted}
          />
        </PressableScale>
      </View>

      {/* Category filters float over the map, below the identity chrome */}
      <View
        style={[styles.filterRail, { top: bandBottom + spacing.xs }]}
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
          />
          {CATEGORY_ORDER.map((key) => {
            const sticker = categorySticker(key);
            const Mark = categoryIcon(key);
            return (
              <Chip
                key={key}
                icon={<Mark size={14} />}
                label={t(`discover.categories.${key}`)}
                selected={category === key}
                onPress={() => setCategory(key)}
                sticker={sticker}
              />
            );
          })}
        </ScrollView>
      </View>

      <BottomSheet
        ref={sheet}
        initial="half"
        dark
        header={<SheetHeader onHost={() => navigation.navigate("CreateEvent")} />}
      >
        <SheetBody
          permissionDenied={permissionDenied}
          requestLocation={requestLocation}
          needsFeedback={needsFeedback}
          openFeedback={openFeedback}
          open={open}
          query={query}
          rows={rows}
          selectedId={selectedId}
          selectFromList={selectFromList}
          insetsBottom={insets.bottom}
          onHostFromEmpty={() => navigation.navigate("CreateEvent")}
        />
      </BottomSheet>
    </View>
  );
}

/**
 * The sheet's own header, extracted so it can read the sheet's scroll position.
 *
 * It has to be a component rather than inline JSX: `useBottomSheetScrollable()`
 * reads a context that `BottomSheet` provides *inside* its own tree, and a hook
 * only sees that if it runs at the render position the header actually occupies.
 *
 * The point of it is the scroll edge. The header used to be a bare `View` on the
 * night ground, so a meetup row scrolling past it simply vanished under an
 * unmarked edge. Now the material fades in over the first 24pt of scroll — the
 * chrome announces "there is content above" only once that is true, which is what
 * Apple's guidance prefers to a permanently drawn divider.
 */
function SheetHeader({ onHost }: { onHost: () => void }) {
  const { t } = useTranslation();
  const { scrollOffset } = useBottomSheetScrollable();

  return (
    <ScrollEdge offset={scrollOffset} tone="night" weight="thin" style={styles.sheetEdge}>
      <View style={styles.sheetHeader}>
        <ScreenHeader
          kicker={t("discover.titleKicker")}
          title={t("discover.forYou")}
          tone="night"
          trailing={
            <View style={styles.hostWrap}>
              <VinylShadow offset={2} borderRadius={radius.pill} />
              <PressableScale
                accessibilityLabel={t("createEvent.title")}
                onPress={onHost}
                style={styles.hostButton}
                scaleTo={0.93}
              >
                <Text style={styles.hostLabel}>+ {t("createEvent.short")}</Text>
              </PressableScale>
            </View>
          }
        />
      </View>
    </ScrollEdge>
  );
}

/**
 * The sheet's scrollable body. Rendered as a child of `<BottomSheet>`, so it sits inside
 * the scroll-gesture provider: it adopts the sheet's shared native gesture and scroll
 * offset, letting the list scroll freely while the sheet only drags when it should.
 */
function SheetBody({
  permissionDenied,
  requestLocation,
  needsFeedback,
  open,
  openFeedback,
  query,
  rows,
  selectedId,
  selectFromList,
  insetsBottom,
  onHostFromEmpty,
}: {
  permissionDenied: boolean;
  requestLocation: () => void;
  needsFeedback: MeetupEvent[];
  open: (eventId: string) => void;
  openFeedback: (eventId: string) => void;
  query: UseQueryResult<{ events: MeetupEvent[] }>;
  rows: { event: MeetupEvent; score: number | undefined; featured: boolean }[];
  selectedId: string | null;
  selectFromList: (eventId: string) => void;
  insetsBottom: number;
  onHostFromEmpty: () => void;
}) {
  const { t } = useTranslation();
  const { nativeGesture, scrollHandler } = useBottomSheetScrollable();
  const reducedMotion = useReducedMotion();


  return (
    <GestureDetector gesture={nativeGesture}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.sheetBody,
          { paddingBottom: insetsBottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {permissionDenied ? (
          <EditorialRow
            tone="night"
            title={t("discover.locationDenied")}
            detail={t("discover.allowLocation")}
            onPress={requestLocation}
            accessibilityLabel={t("discover.allowLocation")}
          />
        ) : null}

        {needsFeedback.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>
              {t("discover.yourMeetups")}
            </Text>
            {needsFeedback.map((event) => (
              // Straight to the form, not to the meetup detail: this row exists
              // because feedback is outstanding, so making the user find the
              // form again on the next screen is a wasted tap.
              <FeedbackRow
                key={event.id}
                event={event}
                onPress={() => openFeedback(event.id)}
              />
            ))}
          </View>
        ) : null}

        {query.isPending ? (
          <ScreenState status="loading" dark />
        ) : query.isError ? (
          <ScreenState status="error" onRetry={() => query.refetch()} dark />
        ) : rows.length === 0 ? (
          // The one screen whose empty state has an obvious next move. A generic
          // "nothing here" on Discover is a dead end when the user could host.
          <ScreenState
            status="empty"
            dark
            message={t("discover.emptyNearby")}
            actionLabel={t("createEvent.title")}
            onAction={onHostFromEmpty}
          />
        ) : (
          <View style={styles.section}>
            {rows.map(({ event, score, featured }, index) => (
              <Animated.View
                key={event.id}
                // Opacity-led, 8pt of rise, 40ms apart. The whole run finishes
                // inside one perceived beat; a longer step turns a list into a
                // queue the user watches. First paint only — React Query serves
                // cached results instantly afterwards, and re-animating a list the
                // user has already seen is the classic doubled-transition smell.
                entering={
                  reducedMotion
                    ? undefined
                    : FadeInDown.duration(timings.enter.duration)
                        .delay(index * STAGGER_STEP)
                        .withInitialValues({ transform: [{ translateY: 8 }] })
                }
              >
                <EventCard
                  event={event}
                  matchScore={score}
                  // The top match is the reason this screen exists.
                  variant={featured ? "featured" : "standard"}
                  selected={event.id === selectedId}
                  onPress={() => selectFromList(event.id)}
                  onOpen={() => open(event.id)}
                  dark
                />
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

/**
 * An outstanding-feedback prompt. `EditorialRow` rather than the hand-rolled
 * dot + chevron this used to be: the same shape now carries "open a destination"
 * on the meetup screen and in the connections list, and the three had drifted
 * apart while doing one job.
 *
 * The detail line is the emphasised one, not the title — the meetup name is
 * context, and the thing being offered is the action.
 */
function FeedbackRow({
  event,
  onPress,
}: {
  event: MeetupEvent;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  return (
    <EditorialRow
      tone="night"
      title={event.title}
      detail={t("discover.leaveFeedback")}
      onPress={onPress}
      accessibilityLabel={`${event.title}, ${t("discover.leaveFeedback")}`}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  topChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  identityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    flexShrink: 1,
  },
  identityHandle: { ...type.kicker, color: colors.citrus },
  identityActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.pill,
  },
  /**
   * No fill and no border. The rail behind these is the surface; giving each one
   * its own would stack a light material on a light material, which Apple's
   * materials guidance rules out outright — legibility collapses.
   *
   * Still 44pt, so the target survives losing its visible shape.
   */
  railAction: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  /**
   * The recenter control keeps its circle: it is a *map* control, not navigation,
   * and a round target over a map is the convention everywhere. Its own constant so
   * that it and the nav chrome can no longer drift into looking like one family.
   */
  mapControl: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.materialNightRegular,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.nightSeparator,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  mapControls: {
    position: "absolute",
    right: spacing.md,
    // Just above where the sheet rests at its default detent, so the control never sits
    // under it and never fights the meetup list for the same pixels.
    bottom: `${(1 - EXPOSED_FRACTION) * 100}%`,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  filterRail: { position: "absolute", left: 0, right: 0 },
  filterRow: {
    paddingHorizontal: spacing.page,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },

  // The edge clips its material to the sheet's own top corners rather than
  // painting a square block across them.
  sheetEdge: {
    overflow: "hidden",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheetHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  hostWrap: { position: "relative" },
  hostButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.citrus,
  },
  hostLabel: { ...type.footnote, color: colors.citrusInk, fontWeight: "800" },

  sheetBody: { paddingHorizontal: spacing.page, gap: spacing.md },
  section: { gap: spacing.sm },
  // `overline`, not a screen kicker: this labels the group under it. The screen's
  // one kicker is already spent on the sheet header above.
  sectionKicker: { ...type.overline, color: colors.nightMuted, marginBottom: spacing.xxs },

});
