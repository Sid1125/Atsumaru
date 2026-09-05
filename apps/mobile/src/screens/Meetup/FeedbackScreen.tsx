import { ScrollView, StyleSheet } from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedbackPanel } from "../../components/feedback/FeedbackPanel";
import { colors, spacing } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Connection } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Feedback">;

/**
 * Post-meetup feedback, as a modal.
 *
 * The form runs 600–700pt for a five-person group, so inline it made the meetup
 * detail a different shape after a meetup than before one. As a modal the detail
 * keeps one shape in every state, and the form gets the "a detour you can
 * abandon" reading that its single Submit deserves.
 *
 * `VibeRecapCard` deliberately does NOT move here. It renders nothing until
 * feedback exists and then becomes the payoff for having submitted, so it stays
 * on the meetup screen — dismissing this modal returns you to the screen now
 * showing the reward.
 */
export function FeedbackScreen() {
  const { eventId } = useRoute<RouteProp<AppStackParamList, "Feedback">>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  function openConnection(connection: Connection, handle?: string) {
    // Replace rather than push: the modal has served its purpose, and the user
    // should land in the thread with the meetup behind them, not the form.
    navigation.replace("Dm", { connectionId: connection.id, handle });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <FeedbackPanel
        eventId={eventId}
        onOpenConnection={openConnection}
        onSubmitted={() =>
          // The recap is generated from the ratings that just landed, so the
          // query that 404'd a moment ago now has an answer waiting on the
          // screen behind this one.
          queryClient.invalidateQueries({
            queryKey: ["events", eventId, "recap"],
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.page, gap: spacing.lg },
});
