import { NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { ScreenState } from "../../components/common/ScreenState";
import { useSession } from "../../features/auth/hooks/useSession";
import { usePushRegistration } from "../../features/notifications/usePushRegistration";
import { configureNotificationHandler } from "../../features/notifications/notificationRouting";
import { LoginScreen } from "../../screens/Auth/LoginScreen";
import { EmailAuthScreen } from "../../screens/Auth/EmailAuthScreen";
import { AIChatScreen } from "../../screens/Onboarding/AIChatScreen";
import { ProfileConfirmScreen } from "../../screens/Onboarding/ProfileConfirmScreen";
import { DiscoverScreen } from "../../screens/Discover/DiscoverScreen";
import { MeetupScreen } from "../../screens/Meetup/MeetupScreen";
import { GroupChatScreen } from "../../screens/Meetup/GroupChatScreen";
import { FeedbackScreen } from "../../screens/Meetup/FeedbackScreen";
import { ConnectionsScreen } from "../../screens/Connections/ConnectionsScreen";
import { DmScreen } from "../../screens/Connections/DmScreen";
import { ConnectionProfileScreen } from "../../screens/Connections/ConnectionProfileScreen";
import { CreateEventScreen } from "../../screens/Events/CreateEventScreen";
import { PastMeetupsScreen } from "../../screens/Events/PastMeetupsScreen";
import { ProfileScreen } from "../../screens/Settings/ProfileScreen";
import { useAuthStore } from "../../store";
import { colors, fonts, type } from "../../theme";
import { linking } from "./linking";
import type {
  AppStackParamList,
  AuthStackParamList,
  OnboardingStackParamList,
} from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

/** Navigation's own surfaces must use the app palette, not its stock greys. */
const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: "transparent",
    notification: colors.primary,
  },
  // React Navigation renders a few strings of its own (the iOS back-button label,
  // fallback titles). Left on "System" they would be the one place in the app still
  // set in the platform face.
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: "400" },
    medium: { fontFamily: fonts.medium, fontWeight: "500" },
    bold: { fontFamily: fonts.bold, fontWeight: "700" },
    heavy: { fontFamily: fonts.extrabold, fontWeight: "800" },
  },
};

/**
 * Editorial headers: left-aligned title (modern native feel), no hard divider,
 * headline-weight text on the cream ground. `headerTitleAlign` is iOS-only
 * (Android already left-aligns), so the bar reads the same on both.
 */
const headerOptions = {
  headerTintColor: colors.text,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  /**
   * Left-aligned on iOS only.
   *
   * Android's native stack header already places the title immediately after the
   * back button, which is both the platform convention and — crucially — laid out
   * so the two cannot collide. Forcing `"left"` there puts the title view at the
   * container's left edge instead, and a long title ("Log in or sign up", "How was
   * Ramen Night?", "Host a meetup") starts underneath the chevron. Short titles
   * ("Connections") happen to clear it, which is why this looked inconsistent
   * across screens rather than like one broken setting.
   *
   * iOS defaults to centred and has no such collision, so the editorial left
   * alignment is kept there.
   */
  headerTitleAlign: Platform.OS === "ios" ? ("left" as const) : undefined,
  headerTitleStyle: {
    ...type.headline,
    color: colors.text,
  },
  contentStyle: { backgroundColor: colors.background },
} as const;

/**
 * How every modal in this stack arrives and leaves.
 *
 * ## Why not `slide_from_bottom`
 *
 * Both modals used it. On Android it resolves to `rns_slide_in_from_bottom.xml`,
 * which is a bare `<translate fromYDelta="100%">` with **no interpolator declared**
 * — a linear, full-screen-height slide. Linear motion is the one thing that always
 * reads as mechanical, and moving the whole viewport height makes a modal feel like
 * a page swap that happens to travel upward.
 *
 * ## Why `fade_from_bottom`
 *
 * It resolves to AOSP's own activity-open animation: alpha 0 → 1 over **210ms** on
 * `decelerate_quint`, with a translate of only **8% of the height** over 350ms on
 * the same curve. Opacity-led, a short rise, decelerating into rest — the same
 * shape as the app's own `FadeIn` + 8pt entrances, so a modal now arrives the way
 * everything else in the app does. The close animation is asymmetric and shorter
 * (250ms, `accelerate_quint`), which is the enter/exit asymmetry `theme/motion.ts`
 * models and no preset gave us before.
 *
 * `animationDuration` is deliberately absent: it is iOS-only, and these are fixed
 * XML durations on Android, so writing one would imply a control that does not exist.
 *
 * ## Why not `formSheet`
 *
 * A `formSheet` was built, shipped to the emulator and measured — rounded corners,
 * the map dimmed to 70% behind it, a 250ms decelerating settle, drag-to-dismiss. It
 * was better than this in every way except one that disqualifies it: on Android the
 * sheet is a `BottomSheetBehavior`, and it cannot share the vertical gesture with
 * the form's `ScrollView`. **Scroll the form down, then drag down to scroll back up,
 * and the sheet dismisses instead — discarding everything typed.** Verified from a
 * freshly mounted sheet, with `nestedScrollEnabled` set on the ScrollView, at three
 * drag speeds. `sheetExpandsWhenScrolledToEdge`, which exists for exactly this, is
 * `@platform ios` in react-native-screens 4.26 — `Screen.kt` stores the field and
 * nothing on Android reads it. A form you can lose by scrolling is not worth a
 * nicer entrance.
 */
const MODAL_ANIMATION = {
  animation: "fade_from_bottom",
} as const;

export function RootNavigator() {
  const { t } = useTranslation();
  const session = useSession();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);

  usePushRegistration();

  // Present notifications that arrive while the app is foregrounded. Registered once,
  // not per render; a no-op in Expo Go, where the native module does not exist.
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  if (!isBootstrapped && session.isPending) {
    return <ScreenState status="loading" />;
  }

  /**
   * Three states, not two. A signed-in account has no profile row until
   * onboarding completes, so `user === null` is ambiguous on its own — pairing it
   * with `isAuthenticated` is what makes the onboarding stack reachable at all.
   */
  const stage = !isAuthenticated ? "auth" : !user ? "onboarding" : "app";

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      {/*
        Dark icons, because almost every surface in the app is the champagne
        ground. The exception opts out for itself: `LoginScreen` renders its own
        `<StatusBar style="light" />` for its night ground.

        This used to switch on the *stage* — `light` for the whole auth stage — but
        the auth stage holds two different grounds. Login is night and EmailAuth is
        champagne, so EmailAuth rendered white status-bar icons on a light ground
        and the clock was effectively invisible (B2). Ground colour is a property of
        a screen, not of a navigation stage.
      */}
      <StatusBar style="dark" animated />
      {stage === "auth" ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="EmailAuth" component={EmailAuthScreen} options={{ headerShown: true, title: "", ...headerOptions }} />
        </AuthStack.Navigator>
      ) : stage === "onboarding" ? (
        <OnboardingStack.Navigator screenOptions={{ ...headerOptions, title: "" }}>
          <OnboardingStack.Screen name="AIChat" component={AIChatScreen} />
          <OnboardingStack.Screen
            name="ProfileConfirm"
            component={ProfileConfirmScreen}
          />
        </OnboardingStack.Navigator>
      ) : (
        <AppStack.Navigator
          screenOptions={{
            ...headerOptions,
            /**
             * One animation for the whole stack rather than six per-route
             * overrides. `ios_from_right` is Android-only and resolves to
             * `default` on iOS, so iOS keeps its native parallax push and
             * Android gets a matching one instead of its flat co-slide — the
             * same felt transition on both platforms, for zero JS cost and with
             * the back gesture interruptible for free.
             *
             * Deliberately NOT gated on `useReducedMotion()`: the OS already
             * handles it (iOS converts pushes to a cross-dissolve, Android runs
             * them at zero duration), so a JS gate would double-handle and fight
             * the system setting.
             *
             * `animationDuration` is not set because it is iOS-only and ignored
             * for `default` — writing one would imply a control that does not exist.
             */
            animation: "ios_from_right",
            animationTypeForReplace: "push",
          }}
        >
          <AppStack.Screen
            name="Discover"
            component={DiscoverScreen}
            // The map is the screen; chrome floats over it instead of a bar
            // consuming a fixed strip (skill §12).
            options={{ headerShown: false }}
          />
          <AppStack.Screen
            name="Meetup"
            component={MeetupScreen}
            options={{ title: "", headerTransparent: true }}
          />
          <AppStack.Screen
            name="GroupChat"
            component={GroupChatScreen}
            // Title and the member stack are set from inside the screen, which
            // is the only place `useEventMembers` can be called.
            options={{ title: "" }}
          />
          <AppStack.Screen
            name="Feedback"
            component={FeedbackScreen}
            options={{
              title: t("feedback.title"),
              presentation: "modal",
              // Android has no native modal presentation, so without an explicit
              // animation the modal falls back to a push and the "a detour you can
              // abandon" reading is lost. Shared with CreateEvent so the app's two
              // modals arrive the same way.
              ...MODAL_ANIMATION,
            }}
          />
          <AppStack.Screen
            name="Connections"
            component={ConnectionsScreen}
            options={{ title: t("connection.title") }}
          />
          <AppStack.Screen
            name="PastMeetups"
            component={PastMeetupsScreen}
            options={{ title: t("pastMeetups.title") }}
          />
          <AppStack.Screen
            name="Dm"
            component={DmScreen}
            options={({ route }) => ({
              title: route.params.handle ? `@${route.params.handle}` : "",
            })}
          />
          <AppStack.Screen
            name="ConnectionProfile"
            component={ConnectionProfileScreen}
            options={{ title: "" }}
          />
          <AppStack.Screen
            name="CreateEvent"
            component={CreateEventScreen}
            options={{
              title: t("createEvent.title"),
              presentation: "modal",
              ...MODAL_ANIMATION,
              /**
               * The screen draws its own header.
               *
               * A modal is dismissed, not popped, so the affordance is a close
               * control on the right of the screen's own `ScreenHeader` rather
               * than a back chevron in a bar — and the title then sits in the
               * editorial tier the rest of the app uses instead of the 17pt
               * headline the native bar allows.
               */
              headerShown: false,
            }}
          />
          <AppStack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: t("profile.title") }}
          />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}
