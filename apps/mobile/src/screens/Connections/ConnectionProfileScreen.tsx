import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { PressableScale } from "../../components/ui/PressableScale";

import { Avatar } from "../../components/common/Avatar";
import { ScreenState } from "../../components/common/ScreenState";
import { connectionsApi } from "../../services/api/connections";
import { colors, spacing, type } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";

export function ConnectionProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList, "ConnectionProfile">>();
  const { connectionId } = useRoute<RouteProp<AppStackParamList, "ConnectionProfile">>().params;
  const query = useQuery({
    queryKey: ["connections", connectionId, "profile"],
    queryFn: () => connectionsApi.profile(connectionId),
  });

  if (query.isPending) return <ScreenState status="loading" />;
  if (query.isError) return <ScreenState status="error" onRetry={() => query.refetch()} />;

  const user = query.data!.profile;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.header}>
        <Avatar id={user.id} label={(user.handle || "?").slice(0, 1)} uri={user.avatar_url} size="lg" />
        <Text style={styles.name}>{user.display_name || `@${user.handle}`}</Text>
        <Text style={styles.handle}>@{user.handle}</Text>
        <PressableScale
          accessibilityLabel={t("connection.openDm")}
          onPress={() => navigation.navigate("Dm", { connectionId, handle: user.handle })}
          style={styles.dmBtn}
          scaleTo={0.98}
        >
          <Text style={styles.dmText}>{t("connection.openDm")}</Text>
        </PressableScale>
      </View>
      {user.interests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.kicker}>{t("profile.interests")}</Text>
          <View style={styles.chips}>
            {user.interests.map((v) => (
              <View key={v} style={styles.chip}><Text style={styles.chipText}>{v}</Text></View>
            ))}
          </View>
        </View>
      )}
      {user.personality.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.kicker}>{t("profile.personality")}</Text>
          <View style={styles.chips}>
            {user.personality.map((v) => (
              <View key={v} style={styles.chip}><Text style={styles.chipText}>{v}</Text></View>
            ))}
          </View>
        </View>
      )}
      <Text style={styles.meta}>{t("connection.compatibility")}: {user.reputation_score}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.page, gap: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  header: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md },
  name: { ...type.headline, color: colors.text },
  handle: { ...type.footnote, color: colors.textMuted },
  dmBtn: { marginTop: spacing.sm, backgroundColor: colors.citrus, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  dmText: { ...type.footnote, color: colors.citrusInk, fontWeight: "700" },
  section: { gap: spacing.xs },
  kicker: { ...type.overline, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { ...type.caption, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted, marginTop: spacing.sm },
});
