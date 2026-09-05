import { View } from "react-native";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

import { AppProviders } from "./src/app/providers/AppProviders";
import { RootNavigator } from "./src/app/navigation/RootNavigator";
import { colors } from "./src/theme";

/**
 * `StatusBar` lives in `RootNavigator`, not here. It used to be rendered in both
 * places, and the copy here was stage-blind (`style="dark"`) while the navigator's
 * flips to `light` for the night-ground auth screens — so which one won on the
 * login screen came down to mount order.
 */
export default function App() {
  /**
   * Five faces, not nine: regular / medium / semibold / bold / extrabold. RN has no
   * synthetic weights — `fontWeight` is ignored once `fontFamily` names a concrete
   * face — so each weight the type scale uses has to be loaded by name, and each one
   * loaded costs bundle size. These five are exactly what `theme/typography.ts`
   * references.
   *
   * The keys must match `fonts` in that file character for character. A mismatch
   * does not throw: RN silently falls back to the system face, so the app looks
   * *almost* right, which is worse than a crash.
   */
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  /**
   * Hold on the page ground rather than rendering text in the system face and
   * re-flowing it a frame later. Deliberately not `ScreenState` — a spinner that
   * appears and vanishes inside ~100ms of local asset loading is the "animation
   * that delays the user" docs/DESIGN.md §9 rules out, and it would itself be set
   * in the wrong face.
   */
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
