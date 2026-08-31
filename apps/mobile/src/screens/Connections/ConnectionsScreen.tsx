import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Avatar } from "../../components/common/Avatar";
import { ScreenState } from "../../components/common/ScreenState";
import { PressableScale } from "../../components/ui/PressableScale";
import { useConnections } from "../../features/connections/hooks/useConnections";
import { usersApi } from "../../services/api/users";
import { useAuthStore } from "../../store";
import { colors, elevation, radius, spacing, type, useReducedMotion } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Connection } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Connections">;

function otherUserId(connection: Connection, me: string): string {
  return connection.user_a === me ? connection.user_b : connection.user_a;
}

function ConnectionRow({
  connection,
  meId,
  onOpen,
}: {
  connection: Connection;
  meId: string;
  onOpen: (handle?: string) => void;
}) {
  const { t } = useTranslation();
  const otherId = otherUserId(connection, meId);

  const profile = useQuery({
    queryKey: ["users", otherId],
    queryFn: () => usersApi.byId(otherId),
  });

  const handle = profile.data?.user.handle;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={handle ? `@${handle}` : t("connection.title")}
      onPress={() => onOpen(handle)}
      style={styles.row}
    >
      <Avatar
        id={otherId}
        label={(handle ?? "?").slice(0, 1)}
        size="md"
      />
      <View style={styles.rowBody}>
        <Text style={styles.handle}>{handle ? `@${handle}` : "…"}</Text>
        <Text style={styles.meta}>
          {profile.data?.user.display_name ?? t("common.loading")}
        </Text>
      </View>
      <View style={styles.chevronWrap}>
        <Text style={styles.chevron}>›</Text>
      </View>
    </PressableScale>
  );
}

export function ConnectionsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user);
  const query = useConnections();
  const reducedMotion = useReducedMotion();

  if (query.isPending) return <ScreenState status="loading" />;
  if (query.isError)
    return <ScreenState status="error" onRetry={() => query.refetch()} />;

  const connections = query.data?.connections ?? [];

  if (connections.length === 0) {
    return <ScreenState status="empty" message={t("connection.empty")} />;
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(280)} style={{ flex: 1 }}>
        <Text style={styles.kicker}>{t("connection.titleKicker")}</Text>
        <Text style={styles.subtitle}>{t("connection.subtitle")}</Text>
        <FlatList
          data={connections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ConnectionRow
              connection={item}
              meId={me?.id ?? ""}
              onOpen={(handle) =>
                navigation.navigate("Dm", { connectionId: item.id, handle })
              }
            />
          )}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  kicker: { ...type.overline, color: colors.primary, marginBottom: spacing.xxs },
  subtitle: { ...type.footnote, color: colors.textMuted, marginBottom: spacing.sm },
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    ...elevation.low,
  },
  rowBody: { flex: 1, gap: spacing.xxs },
  handle: { ...type.bodyEmphasized, color: colors.text },
  meta: { ...type.footnote, color: colors.textMuted },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: { ...type.headline, color: colors.textMuted },
});
