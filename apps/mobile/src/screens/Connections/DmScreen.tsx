import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";

import { ChatThread } from "../../components/chat/ChatThread";
import { useAuthStore } from "../../store";
import { colors, spacing } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";

/**
 * The 1:1 thread that only exists after a mutual unlock. Access is enforced
 * server-side (`requireConnection`) — this screen is simply the surface.
 */
export function DmScreen() {
  const { connectionId, handle } =
    useRoute<RouteProp<AppStackParamList, "Dm">>().params;
  const currentUser = useAuthStore((s) => s.user);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ChatThread
        scope="dm"
        id={connectionId}
        currentUserId={currentUser?.id}
        handle={handle}
        fill
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
});
