import { NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";

import { ScreenState } from "../../components/common/ScreenState";
import { useSession } from "../../features/auth/hooks/useSession";
import { usePushRegistration } from "../../features/notifications/usePushRegistration";
import { LoginScreen } from "../../screens/Auth/LoginScreen";
import { EmailAuthScreen } from "../../screens/Auth/EmailAuthScreen";
import { AIChatScreen } from "../../screens/Onboarding/AIChatScreen";
import { ProfileConfirmScreen } from "../../screens/Onboarding/ProfileConfirmScreen";
import { DiscoverScreen } from "../../screens/Discover/DiscoverScreen";
import { MeetupScreen } from "../../screens/Meetup/MeetupScreen";
import { ConnectionsScreen } from "../../screens/Connections/ConnectionsScreen";
import { DmScreen } from "../../screens/Connections/DmScreen";
import { CreateEventScreen } from "../../screens/Events/CreateEventScreen";
import { ProfileScreen } from "../../screens/Settings/ProfileScreen";import { useAuthStore } from "../../store";
import { colors, type } from "../../theme";
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
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "800" },
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
  headerTitleAlign: "left",
  headerTitleStyle: {
    ...type.headline,
    color: colors.text,
  },
  contentStyle: { backgroundColor: colors.background },
} as const;

export function RootNavigator() {
  const { t } = useTranslation();
  const session = useSession();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);

  usePushRegistration();

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
      {/* The auth stage sits on the night ground, everything else on cream — the
          status bar icons must flip with the surface or the login screen reads
          as broken chrome on a dark background. */}
      <StatusBar style={stage === "auth" ? "light" : "dark"} />
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
        <AppStack.Navigator screenOptions={headerOptions}>
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
            name="Connections"
            component={ConnectionsScreen}
            options={{ title: t("connection.title") }}
          />
          <AppStack.Screen
            name="Dm"
            component={DmScreen}
            options={({ route }) => ({
              title: route.params.handle ? `@${route.params.handle}` : "",
            })}
          />
          <AppStack.Screen
            name="CreateEvent"
            component={CreateEventScreen}
            options={{ title: t("createEvent.title"), presentation: "modal" }}
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
