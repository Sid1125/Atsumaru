import { useCallback } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card } from "../ui/Card";
import { usersApi } from "../../services/api/users";
import { colors, sectionHeader, spacing, type } from "../../theme";
import type { NotificationPrefs, NotificationType } from "../../types/api";

/**
 * Per-type push opt-outs.
 *
 * Order is deliberate: the two the member asked for by joining a meetup sit above the two
 * they never asked for, because those are the ones somebody actually comes here to switch
 * off. Copy says what each one *is*, not "get notified about…" — a member deciding whether
 * to mute something needs to know what arrives, not that something arrives.
 */
const ROWS: NotificationType[] = [
  "meetup_soon",
  "chat",
  "feedback",
  "nearby",
  "reengagement",
];

/** Absent preferences read as on, matching the server. */
const ALL_ON: NotificationPrefs = {
  feedback: true,
  meetup_soon: true,
  chat: true,
  nearby: true,
  reengagement: true,
};

export function NotificationPrefsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["users", "me", "notifications"],
    queryFn: () => usersApi.notificationPrefs(),
    staleTime: 60_000,
  });

  const prefs = query.data?.preferences ?? ALL_ON;

  const save = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) =>
      usersApi.updateNotificationPrefs(patch),
    // Optimistic: a toggle that waits for a round trip feels broken, and the worst case
    // is the switch snapping back on error.
    onMutate: async (patch) => {
      const key = ["users", "me", "notifications"];
      const previous = queryClient.getQueryData<{ preferences: NotificationPrefs }>(key);

      queryClient.setQueryData(key, {
        preferences: { ...(previous?.preferences ?? ALL_ON), ...patch },
      });

      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["users", "me", "notifications"], context.previous);
      }
    },
  });

  const toggle = useCallback(
    (notificationType: NotificationType, value: boolean) => {
      save.mutate({ [notificationType]: value } as Partial<NotificationPrefs>);
    },
    [save]
  );

  return (
    <Card style={styles.card}>
      <Text style={styles.groupLabel}>{t("settings.notifications")}</Text>

      {ROWS.map((notificationType) => (
        <View key={notificationType} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>
              {t(`settings.notify.${notificationType}.title`)}
            </Text>
            <Text style={styles.rowHint}>
              {t(`settings.notify.${notificationType}.hint`)}
            </Text>
          </View>
          <Switch
            value={prefs[notificationType]}
            onValueChange={(value) => toggle(notificationType, value)}
            // Disabled while the first read is in flight, so a toggle cannot be based on
            // the all-on placeholder.
            disabled={query.isPending}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t(`settings.notify.${notificationType}.title`)}
          />
        </View>
      ))}

      <Text style={styles.footnote}>{t("settings.quietHours")}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  groupLabel: { ...sectionHeader, color: colors.textMuted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.bodyEmphasized, color: colors.text },
  rowHint: { ...type.caption, color: colors.textMuted },
  footnote: { ...type.caption, color: colors.textMuted },
});
