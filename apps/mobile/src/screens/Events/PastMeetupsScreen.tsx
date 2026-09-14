import { FlatList, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { EventCard } from "../../components/events/EventCard";
import { ScreenState } from "../../components/common/ScreenState";
import { colors, spacing } from "../../theme";
import { useMyPastEvents } from "../../features/events/hooks/useEvents";
import type { AppStackParamList } from "../../app/navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList, "PastMeetups">;

/**
 * Past Meetups — completed meetups the user hosted or joined.
 *
 * Reached from the clock button on the Discover top chrome. Completed meetups are
 * removed from Discover's "Your Meetups" section (which now only shows outstanding
 * feedback), so this screen is their home.
 *
 * ## The header is the navigator's, not this screen's
 *
 * This used to render its own `ScreenHeader` *in addition to* the `title` the stack
 * already sets, so the screen printed "Past meetups" twice — and it repeated that
 * header in all four branches. The native header is kept because it is the one that
 * carries the back chevron; a screen reached by a push must never be a dead end.
 */
export function PastMeetupsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const query = useMyPastEvents();

  const events = query.data?.events ?? [];

  /**
   * `ScreenState`, not bare `<Text>`.
   *
   * The four branches hand-rolled their own loading and error copy, so a failed
   * fetch showed an unstyled "Something went wrong" with **no way to retry** — on a
   * free-tier API that cold-boots after idling, that is the state a user is most
   * likely to hit and the one least able to recover from. Every network-backed view
   * in this app renders `ScreenState` (docs/RULES.md); this one had opted out.
   */
  if (query.isPending) return <ScreenState status="loading" />;
  if (query.isError) {
    return <ScreenState status="error" onRetry={() => query.refetch()} />;
  }
  if (events.length === 0) {
    return <ScreenState status="empty" message={t("pastMeetups.empty")} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            // Was `() => {}` — a row with a chevron that did nothing when tapped.
            // A past meetup still has a detail screen worth reaching: its recap,
            // its roster, and the feedback it may still be waiting on.
            onPress={() => navigation.navigate("Meetup", { eventId: item.id })}
            variant="standard"
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.page, paddingBottom: spacing.xxl },
});
