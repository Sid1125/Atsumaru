import { Linking } from "react-native";
import type { LinkingOptions } from "@react-navigation/native";

import {
  initialNotificationUrl,
  onNotificationTap,
} from "../../features/notifications/notificationRouting";
import type { AppStackParamList } from "./types";

/**
 * `atsumaru://` is declared as the app scheme in app.json. Three things arrive on it:
 * the OAuth handoff (`atsumaru://auth?code=…`, consumed by useOAuthLogin before
 * navigation sees it), a notification tap, and any ordinary deep link into a meetup.
 *
 * `getInitialURL` / `subscribe` are overridden because React Navigation's defaults only
 * read `Linking` — a notification's payload is invisible to them, so without this the
 * server's `url` would be delivered and then ignored. Overriding both is what makes cold
 * start, warm start and background behave identically; handling only the tap listener
 * would leave a notification that launched the app from cold routing nowhere.
 *
 * `auth` is deliberately absent from `config.screens`, so the OAuth URL still falls
 * through here without matching a route.
 */
export const linking: LinkingOptions<AppStackParamList> = {
  prefixes: ["atsumaru://"],
  config: {
    screens: {
      Discover: "discover",
      Meetup: "meetup/:eventId",
      Connections: "connections",
      Dm: "dm/:connectionId",
      Profile: "profile",
    },
  },

  /** A real launch URL wins; a notification that cold-started the app is the fallback. */
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) return url;

    return await initialNotificationUrl();
  },

  subscribe(listener) {
    // Replaces React Navigation's own Linking subscription, so it has to be re-created
    // here rather than added alongside.
    const link = Linking.addEventListener("url", ({ url }) => listener(url));
    const tap = onNotificationTap(listener);

    return () => {
      link.remove();
      tap();
    };
  },
};
