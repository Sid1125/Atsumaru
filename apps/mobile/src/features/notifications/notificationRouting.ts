import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Notification *routing*: turning a delivered notification into a screen.
 *
 * Registration (getting a token) lives in `usePushRegistration.ts`; this file is the other
 * half, and until it existed a delivered reminder sat in the tray and tapping it opened
 * whatever screen the user last had open (TRACKER.md, "Push in Expo Go").
 *
 * Same load discipline as `usePushRegistration.ts` and `components/map/mapbox.ts`, and for
 * the same reason: Expo Go dropped Android remote push in SDK 53 and `expo-notifications`
 * reports that through the global error handler rather than by throwing where a caller can
 * catch it, so a module-scope `import` kills the bundle. The environment is checked first
 * and the `require()` only runs where the native module actually exists.
 *
 * Everything here is best-effort. Routing that fails costs a tap, never a session.
 */
type NotificationsModule = typeof import("expo-notifications");

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Only ever called in a build that has the native module linked. */
function loadNotifications(): NotificationsModule | null {
  if (isExpoGo) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

/**
 * Reads the deep link out of a notification. `url` is what the server sends now
 * (`deepLink` in server/src/services/push.ts); the `data.type` fallback keeps a
 * notification minted by an older server build tappable instead of inert.
 */
export function urlFromNotificationData(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;

  if (typeof data.url === "string" && data.url.length > 0) return data.url;

  const eventId = typeof data.event_id === "string" ? data.event_id : null;
  const connectionId =
    typeof data.connection_id === "string" ? data.connection_id : null;

  if (eventId) return `atsumaru://meetup/${eventId}`;
  if (connectionId) return `atsumaru://dm/${connectionId}`;

  return null;
}

/**
 * Show notifications that arrive while the app is foregrounded. Without this the OS hands
 * them to the app and nothing is presented, so a reminder that arrives while someone is
 * looking at the app is silently dropped.
 *
 * Called once at module init from the navigation layer, not per render.
 */
export function configureNotificationHandler() {
  const Notifications = loadNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** The deep link of the notification that cold-started the app, if any. */
export async function initialNotificationUrl(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return urlFromNotificationData(
      response?.notification.request.content.data as
        | Record<string, unknown>
        | undefined
    );
  } catch {
    return null;
  }
}

/**
 * Calls `listener` with a deep link each time a notification is tapped. Returns an
 * unsubscribe, matching the shape of `onServerEvent` in services/socket.
 */
export function onNotificationTap(
  listener: (url: string) => void
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const url = urlFromNotificationData(
        response.notification.request.content.data as
          | Record<string, unknown>
          | undefined
      );

      if (url) listener(url);
    }
  );

  return () => subscription.remove();
}
