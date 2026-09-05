import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import i18n, { setLanguage } from "../../i18n";
import { colors } from "../../theme";
import { useUiStore } from "../../store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const language = useUiStore((s) => s.language);

  useEffect(() => {
    if (i18n.language !== language) {
      void setLanguage(language);
    }
  }, [language]);

  return (
    // Gesture handler must own the root view, or nothing below it receives the
    // pan/pinch gestures the map and sheet are built on.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  /**
   * The root paints the page ground rather than leaving the window showing
   * through wherever a screen has not painted its own.
   *
   * Note what this does **not** fix. Chat screens call Reanimated's
   * `useAnimatedKeyboard`, which switches the Android window to
   * `setDecorFitsSystemWindows(false)` so it can read the IME as an inset; the
   * native header then stops painting the strip behind the status bar, and the RN
   * root view is itself inset below it — so that band is outside the React tree
   * and no style here can reach it. It is `android:windowBackground`, set from
   * `app.json` `expo.android.backgroundColor`, and it therefore only takes effect
   * in a dev or release build. In Expo Go the host activity's white window shows
   * and the band stays; measured, not assumed (`#FFFFFF` at the status bar on the
   * chat routes, `#F5E5CC` everywhere else).
   */
  root: { flex: 1, backgroundColor: colors.background },
});

export { queryClient };
