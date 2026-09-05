import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";

import { ChatScreenShell } from "../../components/chat/ChatScreenShell";
import { ChatThread } from "../../components/chat/ChatThread";
import { useAuthStore } from "../../store";
import type { AppStackParamList } from "../../app/navigation/types";

/**
 * The 1:1 thread that only exists after a mutual unlock. Access is enforced
 * server-side (`requireConnection`) — this screen is simply the surface.
 *
 * All safe-area and keyboard handling lives in `ChatScreenShell`. This screen
 * previously used a flat `padding: spacing.page` with a `KeyboardAvoidingView`
 * whose Android branch was `undefined`, which is the same latent defect that was
 * reported against the group composer on the release build (TRACKER §5j) — it
 * had simply never been driven there, because the test account had no
 * connections.
 */
export function DmScreen() {
  const { connectionId, handle } =
    useRoute<RouteProp<AppStackParamList, "Dm">>().params;
  const currentUser = useAuthStore((s) => s.user);

  return (
    <ChatScreenShell>
      <ChatThread
        scope="dm"
        id={connectionId}
        currentUserId={currentUser?.id}
        handle={handle}
      />
    </ChatScreenShell>
  );
}
