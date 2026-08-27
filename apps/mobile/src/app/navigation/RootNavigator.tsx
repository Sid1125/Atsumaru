import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import { ScreenState } from "../../components/common/ScreenState";
import { useSession } from "../../features/auth/hooks/useSession";
import { LoginScreen } from "../../screens/Auth/LoginScreen";
import { AIChatScreen } from "../../screens/Onboarding/AIChatScreen";
import { ProfileConfirmScreen } from "../../screens/Onboarding/ProfileConfirmScreen";
import { DiscoverScreen } from "../../screens/Discover/DiscoverScreen";
import { MeetupScreen } from "../../screens/Meetup/MeetupScreen";
import { useAuthStore } from "../../store";
import { colors } from "../../theme";
import type {
  AppStackParamList,
  AuthStackParamList,
  OnboardingStackParamList,
} from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();
  const session = useSession();
  const user = useAuthStore((s) => s.user);
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);

  if (!isBootstrapped && session.isPending) {
    return <ScreenState status="loading" />;
  }

  // A signed-in user without a handle has not finished AI onboarding yet.
  const needsOnboarding = !!user && !user.handle;

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      ) : needsOnboarding ? (
        <OnboardingStack.Navigator
          screenOptions={{ headerTintColor: colors.text, title: "" }}
        >
          <OnboardingStack.Screen name="AIChat" component={AIChatScreen} />
          <OnboardingStack.Screen
            name="ProfileConfirm"
            component={ProfileConfirmScreen}
          />
        </OnboardingStack.Navigator>
      ) : (
        <AppStack.Navigator screenOptions={{ headerTintColor: colors.text }}>
          <AppStack.Screen
            name="Discover"
            component={DiscoverScreen}
            options={{ title: t("common.appName") }}
          />
          <AppStack.Screen
            name="Meetup"
            component={MeetupScreen}
            options={{ title: "" }}
          />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}
