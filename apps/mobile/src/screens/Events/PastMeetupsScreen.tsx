import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { EventCard } from "../../components/events/EventCard";
import { ScreenHeader } from "../../components/common/ScreenHeader";
import { colors, spacing, type } from "../../theme";
import { useMyPastEvents } from "../../features/events/hooks/useEvents";

/**
 * Past Meetups — completed meetups the user hosted or joined.
 *
 * Reached from the clock button on the Discover top chrome. Shows meetups
 * in chronological order (newest first) with a compact EventCard each.
 * Completed meetups are removed from the Discover "Your Meetups" section
 * (which now only shows outstanding feedback) — this screen is their home.
 */
export function PastMeetupsScreen() {
  const { t } = useTranslation();
  const query = useMyPastEvents();

  const events = query.data?.events ?? [];

  if (query.isPending) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          kicker={t("discover.titleKicker")}
          title={t("pastMeetups.title")}
          tone="light"
        />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("common.loading")}</Text>
        </View>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          kicker={t("discover.titleKicker")}
          title={t("pastMeetups.title")}
          tone="light"
        />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("common.error")}</Text>
        </View>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          kicker={t("discover.titleKicker")}
          title={t("pastMeetups.title")}
          tone="light"
        />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("pastMeetups.empty")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        kicker={t("discover.titleKicker")}
        title={t("pastMeetups.title")}
        tone="light"
      />
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => {}}
            dark={false}
            variant="standard"
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.page },
  list: { gap: spacing.sm },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { ...type.body, color: colors.textMuted },
});
