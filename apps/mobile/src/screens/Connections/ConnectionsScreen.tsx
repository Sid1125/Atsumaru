import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { ScreenState } from "../../components/common/ScreenState";
import { useConnections } from "../../features/connections/hooks/useConnections";
import { usersApi } from "../../services/api/users";
import { useAuthStore } from "../../store";
import { colors, elevation, radius, spacing, type } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Connection } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Connections">;

/** The other participant's id — a connection stores the pair, not a direction. */
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={handle ? `@${handle}` : t("connection.title")}
      onPress={() => onOpen(handle)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(handle ?? "?").slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.handle}>{handle ? `@${handle}` : "…"}</Text>
        <Text style={styles.meta}>
          {profile.data?.user.display_name ?? t("common.loading")}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function ConnectionsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user);
  const query = useConnections();

  if (query.isPending) return <ScreenState status="loading" />;
  if (query.isError)
    return <ScreenState status="error" onRetry={() => query.refetch()} />;

  const connections = query.data?.connections ?? [];

  if (connections.length === 0) {
    return <ScreenState status="empty" message={t("connection.empty")} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.note}>{t("connection.subtitle")}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  note: { ...type.footnote, color: colors.textMuted, marginBottom: spacing.sm },
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.9 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...type.title3, color: colors.primaryText },
  rowBody: { flex: 1 },
  handle: { ...type.body, fontWeight: "600", color: colors.text },
  meta: { ...type.footnote, color: colors.textMuted },
  chevron: { ...type.title1, color: colors.textMuted },
});
