import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { Avatar } from "../../components/common/Avatar";
import { ScreenState } from "../../components/common/ScreenState";
import { IconChevronRight } from "../../components/ui/Icons";
import { PressableScale } from "../../components/ui/PressableScale";
import { useConnections } from "../../features/connections/hooks/useConnections";
import { usersApi } from "../../services/api/users";
import { useAuthStore } from "../../store";
import { colors, elevation, radius, spacing, type } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { ConnectionWithProfile } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Connections">;

/** The other user of a connection row. */
function otherUser(connection: ConnectionWithProfile, me: string) {
  return connection.other_user;
}

function ConnectionRow({
  connection,
  meId,
  onOpen,
}: {
  connection: ConnectionWithProfile;
  meId: string;
  onOpen: (handle?: string) => void;
}) {
  const { t } = useTranslation();
  const user = otherUser(connection, meId);
  const handle = user.handle;
  const score = Math.round(connection.compatibility_score * 100);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={handle ? `@${handle}` : t("connection.title")}
      onPress={() => onOpen(handle)}
      style={styles.row}
    >
      <Avatar
        id={user.id}
        label={handle?.slice(0, 1) ?? "?"}
        uri={user.avatar_url}
        size="lg"
      />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.displayName}>
            {user.display_name || handle || "…"}
          </Text>
          <Text style={styles.score}>{score}%</Text>
        </View>
        <Text style={styles.handle}>{handle ? `@${handle}` : "…"}</Text>
        <CompatRow
          interests={user.interests}
          personality={user.personality}
        />
        {connection.compatibility_reasons.length > 0 && (
          <Text style={styles.reasons}>
            {connection.compatibility_reasons.join(" • ")}
          </Text>
        )}
      </View>
      <View style={styles.chevronWrap}>
        <IconChevronRight size={16} color={colors.textMuted} />
      </View>
    </PressableScale>
  );
}

/** Renders up to two tag-style chips for interests and personality. */
function CompatRow({
  interests,
  personality,
}: {
  interests: string[];
  personality: string[];
}) {
  const { t } = useTranslation();
  const chips: string[] = [];
  if (interests.length > 0) chips.push(interests[0]!);
  if (personality.length > 0) chips.push(personality[0]!);

  if (chips.length === 0) return null;

  return (
    <View style={styles.compatRow}>
      {chips.map((label, i) => (
        <View key={i} style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
      {interests.length > 1 && (
        <Text style={styles.moreText}>
          {t("connection.moreInterests", { count: interests.length - 1 })}
        </Text>
      )}
    </View>
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
      <View style={{ flex: 1 }}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.page },
  kicker: { ...type.overline, color: colors.primaryInk, marginBottom: spacing.xxs },
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
    ...elevation.card,
  },
  rowBody: { flex: 1, gap: spacing.xs },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  displayName: { ...type.bodyEmphasized, color: colors.text },
  handle: { ...type.footnote, color: colors.textMuted },
  score: { ...type.captionEmphasized, color: colors.accentInk },
  compatRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  chip: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  chipText: { ...type.caption, color: colors.textMuted },
  moreText: { ...type.caption, color: colors.textMuted },
  reasons: { ...type.caption, color: colors.textMuted },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
});
