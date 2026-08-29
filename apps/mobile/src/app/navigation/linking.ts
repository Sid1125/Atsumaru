import type { LinkingOptions } from "@react-navigation/native";

import type { AppStackParamList } from "./types";

/**
 * `atsumaru://` is declared as the app scheme in app.json. Two things arrive on it:
 * the OAuth handoff (`atsumaru://auth?code=…`, consumed by useOAuthLogin before
 * navigation sees it) and the feedback notification's deep link into a meetup.
 */
export const linking: LinkingOptions<AppStackParamList> = {
  prefixes: ["atsumaru://"],
  config: {
    screens: {
      Discover: "discover",
      Meetup: "meetup/:eventId",
      Connections: "connections",
      Dm: "dm/:connectionId",
      Settings: "settings",
    },
  },
};
