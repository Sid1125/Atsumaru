import { NavigationContainer, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import { ScreenState } from "../../components/common/ScreenState";
import { useSession } from "../../features/auth/hooks/useSession";
import { usePushRegistration } from "../../features/notifications/usePushRegistration";
import { LoginScreen } from "../../screens/Auth/LoginScreen";
import { AIChatScreen } from "../../screens/Onboarding/AIChatScreen";
import { ProfileConfirmScreen } from "../../screens/Onboarding/ProfileConfirmScreen";
import { DiscoverScreen } from "../../screens/Discover/DiscoverScreen";
import { MeetupScreen } from "../../screens/Meetup/MeetupScreen";
import { ConnectionsScreen } from "../../screens/Connections/ConnectionsScreen";
import { DmScreen } from "../../screens/Connections/DmScreen";
import { CreateEventScreen } from "../../screens/Events/CreateEventScreen";
import { SettingsScreen } from "../../screens/Settings/SettingsScreen";
import { useAuthStore } from "../../store";
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

/** Large-ish, tightly tracked titles with no hard divider under the bar. */
const headerOptions = {
  headerTintColor: colors.text,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
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
      {stage === "auth" ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
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
            name="Settings"
            component={SettingsScreen}
            options={{ title: t("settings.title") }}
          />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}
