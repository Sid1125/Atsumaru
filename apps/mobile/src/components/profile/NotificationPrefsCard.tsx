import { useCallback } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card } from "../ui/Card";
import { usersApi } from "../../services/api/users";
import { colors, spacing, type } from "../../theme";
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
            /**
             * All three, not just the track. With only `trackColor` set, Android
             * keeps its **default blue thumb** — so every toggle on this card read
             * as a blue dot on an orange track, the one genuinely off-palette
             * colour left in the app. `ios_backgroundColor` is the off-state track
             * on iOS, which `trackColor.false` does not reach.
             */
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.border}
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
  groupLabel: { ...type.overline, color: colors.textMuted },
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
