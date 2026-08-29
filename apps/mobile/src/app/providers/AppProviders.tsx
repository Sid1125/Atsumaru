import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import i18n, { setLanguage } from "../../i18n";
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
  root: { flex: 1 },
});

export { queryClient };
