import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button } from "../../components/common/Button";
import { Avatar } from "../../components/common/Avatar";
import { ScreenState } from "../../components/common/ScreenState";
import { Card } from "../../components/ui/Card";
import { Material } from "../../components/ui/Material";
import { NightCard } from "../../components/ui/NightCard";
import { Sticker } from "../../components/ui/Sticker";
import { Tape } from "../../components/ui/Tape";
import { IconSparkle } from "../../components/ui/Icons";
import { categoryIcon, categorySticker } from "../../categoryMeta";
import { GroupChatCard } from "../../components/meetup/GroupChatCard";
import { WrapUpRow } from "../../components/meetup/WrapUpRow";
import { VibeRecapCard } from "../../components/recap/VibeRecapCard";
import {
  useEvent,
  useEventMembers,
  useMatchPreview,
} from "../../features/events/hooks/useEvents";
import { eventsApi } from "../../services/api/events";
import { onServerEvent } from "../../services/socket";
import { useAuthStore } from "../../store";
import {
  colors,
  radius,

  spacing,
  springs,
  timings,
  type,
  useReducedMotion,
} from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Connection, GroupMember } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Meetup">;

function MemberAvatar({ member }: { member: GroupMember }) {
  return (
    <View style={styles.member}>
      <Avatar
        id={member.user_id}
        label={member.user.handle.slice(0, 1)}
        uri={member.user.avatar_url}
        size="md"
      />
      <Text style={styles.memberHandle} numberOfLines={1}>
        @{member.user.handle}
      </Text>
    </View>
  );
}

export function MeetupScreen() {
  const { t } = useTranslation();
  const { eventId } = useRoute<RouteProp<AppStackParamList, "Meetup">>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const eventQuery = useEvent(eventId);
  const membersQuery = useEventMembers(eventId);
  const matchQuery = useMatchPreview(eventId);

  const [joining, setJoining] = useState(false);

  /**
   * Scroll position, for the collapsing hero.
   *
   * This is the one motion `open-design/animation-discipline.md` endorses without
   * reservation: the research it cites finds animation does *not* beat static for
   * teaching a system, and the surviving use case is real spatial or temporal
   * reorientation — which is exactly what a header collapsing into a bar is. It
   * tells you where the top of the page went.
   *
   * Transform and opacity only, driven on the UI thread, and no layout property is
   * animated — animating height here would re-lay-out the whole scroll content
   * every frame.
   */
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const [joinError, setJoinError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Connection | null>(null);

  const members = membersQuery.data?.members ?? [];
  const isMember = members.some((m) => m.user_id === currentUser?.id);

  /**
   * The mutual match is the emotional payoff, and the one place DESIGN.md §9
   * explicitly allows motion to be emphasised. It is driven from a shared value
   * rather than a layout-animation builder so it can use `springs.celebrate`
   * exactly: the builder exposes damping/stiffness but not `energyThreshold`, so
   * it can only ever approximate a preset. The previous
   * `ZoomIn.springify().damping(9)` was an ad-hoc constant — the thing CLAUDE.md
   * rules out — and `springs.celebrate` had no callers at all.
   */
  const celebration = useSharedValue(0);

  const celebrationStyle = useAnimatedStyle(() => ({
    opacity: celebration.value,
    // Lands rather than inflates: ZoomIn scaled from 0, which reads as generic.
    transform: [{ scale: reducedMotion ? 1 : 0.92 + celebration.value * 0.08 }],
  }));

  useEffect(() => {
    const off = onServerEvent("match:unlocked", (connection) => {
      setUnlocked(connection);
      void queryClient.invalidateQueries({ queryKey: ["connections"] });

      // Fires on the frame the payoff ARRIVES, not one beat later when the CTA
      // is tapped. Genuinely rare, which is where the haptics budget belongs.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reduced motion gets a gentler equivalent, not nothing. This branch was
      // `undefined` before — and since the Android emulator reports reduce-motion
      // ON, that meant this animation had never actually been seen in development.
      celebration.value = reducedMotion
        ? withTiming(1, timings.base)
        : withSpring(1, springs.celebrate);
    });

    return off;
  }, [queryClient, celebration, reducedMotion]);

  async function toggleMembership() {
    setJoining(true);
    setJoinError(null);

    try {
      if (isMember) await eventsApi.leave(eventId);
      else await eventsApi.join(eventId);

      await queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setJoining(false);
    }
  }

  /**
   * The bold move: the category sticker lifts and counter-rotates as the hero
   * collapses, then settles.
   *
   * The die-cut sticker is this product's one distinctive object, and it was
   * static everywhere. Giving it a single moment of physicality — it peels up as
   * you scroll past it — is what makes the screen identifiable in a screenshot
   * without adding a second visual language.
   *
   * `COLLAPSE` is the scroll distance over which it happens. Short: the whole
   * gesture is one flick, and a long ramp would leave the sticker mid-lift for most
   * of the page.
   */
  const heroMark = useAnimatedStyle(() => {
    if (reducedMotion) return {};

    const t = interpolate(scrollY.value, [0, COLLAPSE], [0, 1], Extrapolation.CLAMP);

    return {
      // Rotation here is a *delta* on top of the sticker's own resting tilt, which
      // it applies to an inner view. Nested transforms compose, so the two do not
      // fight — and the resting tilt survives reduced motion, where this whole
      // style collapses to `{}`. A static design choice is not motion.
      transform: [
        { translateY: -14 * t },
        { scale: 1 - 0.18 * t },
        { rotate: `${-5 * t}deg` },
      ],
    };
  });

  /**
   * The title fades and rises out as the page scrolls, handing off to the nav bar.
   * Opacity leads: it is gone by the time it has moved far enough for the movement
   * itself to be noticeable.
   */
  const heroTitle = useAnimatedStyle(() => {
    if (reducedMotion) return {};

    const t = interpolate(scrollY.value, [0, COLLAPSE], [0, 1], Extrapolation.CLAMP);

    return { opacity: 1 - t, transform: [{ translateY: -10 * t }] };
  });

  /**
   * The other half of the collapse: the title arriving in the nav bar as it leaves
   * the hero.
   *
   * Without this the hero title simply faded to nothing, which is information loss
   * dressed as motion — the thing `animation-discipline.md` means when it says
   * motion should *confirm* a change, never *perform* one. With it the two are one
   * hand-off: the name of the meetup is continuously on screen, it just moves from
   * being the subject to being the label.
   *
   * Fades in over the back half of the collapse so the two never both read as the
   * title at once.
   */
  const navBar = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [COLLAPSE * 0.45, COLLAPSE],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  if (eventQuery.isPending) return <ScreenState status="loading" />;
  if (eventQuery.isError)
    return <ScreenState status="error" onRetry={() => eventQuery.refetch()} />;

  const event = eventQuery.data.event;
  const isCompleted = event.status === "completed";
  const score = matchQuery.data
    ? Math.round(matchQuery.data.match_score * 100)
    : null;
  const sticker = categorySticker(event.category);
  const CategoryMark = categoryIcon(event.category);

  function openConnection(connection: Connection) {
    const otherId =
      connection.user_a === currentUser?.id ? connection.user_b : connection.user_a;
    const other = members.find((m) => m.user_id === otherId);

    navigation.navigate("Dm", {
      connectionId: connection.id,
      handle: other?.user.handle,
    });
  }

  return (
    <View style={styles.container}>
      {/*
        `pointerEvents="none"` throughout: this is a label, and the native header's
        back chevron sits above it. Making it touchable would swallow that tap.
      */}
      <Animated.View
        pointerEvents="none"
        style={[styles.navBar, { paddingTop: insets.top }, navBar]}
      >
        <Material tone="light" weight="regular" edge={false} style={StyleSheet.absoluteFill} />
        <Text style={styles.navTitle} numberOfLines={1}>
          {event.title}
        </Text>
      </Animated.View>

    <Animated.ScrollView
      style={styles.scroll}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 52, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — the site's night card: category sticker anchors identity, a
          mono status tape sits on the corner */}
      <View style={styles.hero}>
        <View style={styles.heroHead}>
          <Animated.View style={heroMark}>
            <Sticker
              color={sticker.bg}
              borderRadius={radius.lg}
              rotate={-1.5}
              offset={4}
              style={styles.heroSticker}
            >
              <CategoryMark size={30} color={sticker.on} />
            </Sticker>
          </Animated.View>
          {/* Status rides on a tape badge — open wears the electric band,
              ongoing the action register, finished sits quiet on the ink. */}
          <Tape
            label={t(
              event.status === "completed"
                ? "discover.status.completed"
                : event.status === "ongoing"
                  ? "discover.status.ongoing"
                  : "discover.status.open"
            )}
            tone={
              event.status === "ongoing"
                ? "action"
                : event.status === "completed"
                  ? "night"
                  : "citrus"
            }
            rotate={1}
            style={styles.statusTape}
          />
        </View>
        {/* See EventCard: the category colour lives on the sticker, which has
            an AA-checked ink pair. As text it fails contrast. */}
        <Text style={styles.categoryKicker}>
          {t(`discover.categories.${event.category}`)}
        </Text>
        <Animated.Text style={[styles.title, heroTitle]}>{event.title}</Animated.Text>
        <Text style={styles.meta}>
          {event.venue_name} ·{" "}
          {new Date(event.start_time).toLocaleString(undefined, {
            weekday: "long",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {/* The door to the thread sits immediately under the hero. Moving the
          affordance without moving it UP would have left it exactly where the
          embedded thread was — ~780pt down a ~740pt viewport. */}
      {isMember && !isCompleted ? (
        <GroupChatCard
          eventId={eventId}
          members={Object.fromEntries(
            members.map((m) => [m.user_id, m.user.handle])
          )}
          onPress={() =>
            navigation.navigate("GroupChat", { eventId, title: event.title })
          }
        />
      ) : null}

      {event.description ? (
        <Text style={styles.description}>{event.description}</Text>
      ) : null}

      {/* Match — the AI's answer, stated plainly with its reasons. Hidden once
          the meetup is over: a group-fit *prediction* is dead information after
          the fact, and it cost ~150pt at the top of the wrap-up. */}
      {score != null && !isCompleted ? (
        <View style={styles.matchCard}>
          <View style={styles.matchHead}>
            {/* The score is the loudest number on the page — it wears the
                sticker, the way the site stamps its payoff figures. */}
            <Sticker color={colors.citrus} borderRadius={radius.md} rotate={-1.5} offset={2}>
              <Text style={styles.matchScore}>{score}%</Text>
            </Sticker>
            <Text style={styles.matchLabel}>{t("meetup.groupFitLabel")}</Text>
          </View>
          <View style={styles.matchReasons}>
            {matchQuery.data!.why.map((reason) => (
              <View key={reason} style={styles.reasonRow}>
                <Text style={styles.reasonBullet}>•</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Group */}
      <Card style={styles.groupCard}>
        <Text style={styles.groupKicker}>
          {t("meetup.yourGroup")} ·{" "}
          {t("discover.size", {
            current: event.current_size,
            max: event.max_size,
          })}
        </Text>
        <View style={styles.members}>
          {members.map((member) => (
            <MemberAvatar key={member.id} member={member} />
          ))}
        </View>
      </Card>

      {joinError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {joinError}
        </Text>
      ) : null}

      {!isCompleted ? (
        <Button
          label={isMember ? t("meetup.leave") : t("meetup.join")}
          variant={isMember ? "secondary" : "primary"}
          onPress={toggleMembership}
          loading={joining}
          size="large"
        />
      ) : null}

      {/* The emotional payoff — the one place extra life is earned (skill §4) */}
      {unlocked ? (
        <Animated.View style={celebrationStyle}>
          <NightCard emphasis="payoff" style={styles.celebration}>
            <IconSparkle size={40} color={colors.citrus} />
            <Text style={styles.celebrationTitle}>
              {t("connection.mutualTitle")}
            </Text>
            <Button
              label={t("connection.startChatting")}
              onPress={() => openConnection(unlocked)}
              haptic="light"
            />
          </NightCard>
        </Animated.View>
      ) : null}

      {isMember && isCompleted ? (
        <>
          {/* The recap stays here rather than moving with the form: it renders
              nothing until feedback exists, and then it is the payoff for having
              submitted — so dismissing the feedback modal returns you to the
              screen now showing the reward. */}
          <VibeRecapCard eventId={eventId} enabled={isMember && isCompleted} />
          <WrapUpRow
            label={t("discover.leaveFeedback")}
            onPress={() => navigation.navigate("Feedback", { eventId })}
          />
        </>
      ) : null}
    </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  /**
   * Transparent, so the grain layer behind it shows through. The scroll view used
   * to carry `backgroundColor` as well, which painted an opaque champagne fill
   * straight over the texture — the ground measured 0.00 variance with the grain
   * mounted and rendering correctly underneath it.
   */
  scroll: { flex: 1 },
  /**
   * 32pt between regions, not 24 everywhere.
   *
   * Every child of this scroll view is a separate region — hero, chat door,
   * description, match, roster, CTA — and they were all one `gap: spacing.lg`
   * apart, which is the "uniform spacing reads as nothing being grouped" failure.
   * Internal spacing belongs to each region (the hero's own parts sit 4–8pt apart).
   */
  content: { paddingHorizontal: spacing.page, gap: spacing.xl },

  /**
   * Above the scroll content, below the native header's chevron. The chevron is
   * inset ~56pt, so the title starts after it rather than under it.
   */
  navBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingLeft: 56,
    paddingRight: spacing.page,
    paddingBottom: spacing.sm,
    justifyContent: "flex-end",
    minHeight: 52,
  },
  navTitle: { ...type.headline, color: colors.text },

  hero: {
    backgroundColor: colors.night,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    // The sticker lifts out of the hero's top edge as it collapses; clipping would
    // cut the move in half, and it would clip the vinyl offset too.
    overflow: "visible",
  },
  heroHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  heroSticker: {
    width: 64,
    height: 64,
  },
  statusTape: { marginTop: spacing.xxs },
  // Had no `color` at all, so it fell through to the platform default — near-black
  // ink on the near-black hero, at 9pt. `nightMuted` clears 7.8:1 there.
  categoryKicker: { ...type.overline, color: colors.nightMuted },

  title: { ...type.display, color: colors.nightText },
  meta: { ...type.subhead, color: colors.nightMuted },
  // No negative margin: the parent gap is now the right size on its own.
  description: { ...type.body, color: colors.textSecondary },

  matchCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  matchHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  matchScore: {
    ...type.title1,
    color: colors.citrusInk,
    paddingHorizontal: spacing.sm + 2,
  },
  matchLabel: { ...type.subhead, color: colors.accentInk, flex: 1 },
  matchReasons: { gap: spacing.xs },
  reasonRow: { flexDirection: "row", gap: spacing.sm },
  reasonBullet: { ...type.footnote, color: colors.accentInk },
  reasonText: { ...type.footnote, color: colors.textSecondary, flex: 1 },

  section: { gap: spacing.sm },
  groupCard: { gap: spacing.sm },
  groupKicker: { ...type.overline, color: colors.textMuted },
  members: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  member: { alignItems: "center", gap: spacing.xs, width: 62 },
  memberHandle: { ...type.caption, color: colors.textMuted },

  error: { ...type.footnote, color: colors.danger },

  // The night surface, the citrus edge and the elevation now live in
  // `NightCard emphasis="payoff"` — this card, the recap card and the feedback
  // celebration were three hand-rolled versions of the same idea.
  celebration: { alignItems: "center", gap: spacing.sm },
  celebrationTitle: {
    ...type.title3,
    color: colors.nightText,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
});/**
 * How far the page scrolls before the hero has fully collapsed, in points.
 *
 * Deliberately short. The collapse is meant to happen inside the first flick, so
 * the sticker is either resting or settled and rarely caught mid-lift; stretched
 * over a longer distance it stops reading as a hand-off and starts reading as an
 * effect the user is dragging.
 */
const COLLAPSE = 120;


