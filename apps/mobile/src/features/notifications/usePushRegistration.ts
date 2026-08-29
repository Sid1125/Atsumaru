import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

import { DEMO_MODE } from "../../config/env";
import { authApi } from "../../services/api/auth";
import { useAuthStore } from "../../store";

/**
 * Registers this device for the post-meetup feedback reminder (docs/TRD.md §14),
 * which the sweep sends ~1h after `start_time`.
 *
 * Expo Go dropped Android remote push in SDK 53 and `expo-notifications` reports the
 * failure through the global error handler rather than by throwing where a caller can
 * catch it — a `try/catch` around `require()` does *not* contain it. So the module is
 * never loaded there: the environment is checked first, and the require only happens
 * in a dev/production build where the native module actually exists.
 *
 * Everything here is best-effort. A missing push token costs the user a notification,
 * never a broken session.
 */
type NotificationsModule = typeof import("expo-notifications");

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Only ever called in a build that has the native module linked. */
function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

export function usePushRegistration() {
  const user = useAuthStore((s) => s.user);
  const registered = useRef<string | null>(null);

  useEffect(() => {
    // No profile yet means no row to attach the token to.
    if (!user || registered.current === user.id) return;

    let cancelled = false;

    (async () => {
      try {
        // Demo mode has no Expo push service behind it. Register a placeholder so the
        // endpoint is still exercised, without touching the native module.
        if (DEMO_MODE) {
          await authApi.registerPushToken(
            "ExponentPushToken[demo-device]",
            Platform.OS === "ios" ? "ios" : "android"
          );
          registered.current = user.id;
          return;
        }

        // Expo Go cannot deliver remote push on Android; a dev build is required.
        if (isExpoGo && Platform.OS === "android") return;

        const Notifications = loadNotifications();
        if (!Notifications || cancelled) return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const existing = await Notifications.getPermissionsAsync();
        const granted =
          existing.granted ||
          (await Notifications.requestPermissionsAsync()).granted;

        if (!granted || cancelled) return;

        const token = (await Notifications.getExpoPushTokenAsync()).data;
        if (cancelled) return;

        await authApi.registerPushToken(
          token,
          Platform.OS === "ios" ? "ios" : "android"
        );
        registered.current = user.id;
      } catch {
        // A denied prompt, a missing EAS project id, or no native module at all.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}
