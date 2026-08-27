import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </QueryClientProvider>
  );
}

export { queryClient };
