import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/common/Button";
import { Chip } from "../../components/common/Chip";
import { CATEGORY_ORDER, categorySticker } from "../../categoryMeta";
import { eventsApi } from "../../services/api/events";
import { colors, elevation, radius, spacing, type, useReducedMotion } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList, "CreateEvent">;

const SIZES = [4, 5, 6] as const;

/** Shibuya, matching the discovery fallback — hosting a meetup elsewhere needs a picker. */
const DEFAULT_LOCATION = { lat: 35.6595, lng: 139.7005 };

/** FR-13. `POST /events` already existed with nothing calling it. */
export function CreateEventScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("food");
  const [maxSize, setMaxSize] = useState<number>(6);
  const [hoursAhead, setHoursAhead] = useState("24");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && venue.trim().length > 0;

  async function submit() {
    setBusy(true);
    setError(null);

    try {
      const offset = Number(hoursAhead);
      const startsIn = Number.isFinite(offset) && offset > 0 ? offset : 24;

      const { event } = await eventsApi.create({
        title: title.trim(),
        category,
        description: description.trim(),
        venue_name: venue.trim(),
        location: DEFAULT_LOCATION,
        start_time: new Date(Date.now() + startsIn * 3600_000).toISOString(),
        max_size: maxSize,
      });

      await queryClient.invalidateQueries({ queryKey: ["events"] });
      navigation.replace("Meetup", { eventId: event.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const sticker = categorySticker(category);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(280)}>
        <Text style={styles.kicker}>{t("createEvent.hostKicker")}</Text>
        <Text style={styles.kickerHint}>{t("createEvent.hostHint")}</Text>

        {/* Details card */}
        <View style={styles.card}>
          <Text style={styles.cardKicker}>{t("createEvent.detailsKicker")}</Text>
          <TextInput
            accessibilityLabel={t("createEvent.name")}
            value={title}
            onChangeText={setTitle}
            placeholder={t("createEvent.namePlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel={t("createEvent.venue")}
            value={venue}
            onChangeText={setVenue}
            placeholder={t("createEvent.venuePlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel={t("createEvent.description")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("createEvent.descriptionPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.multiline]}
            multiline
          />
        </View>

        {/* Category card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardKicker}>{t("createEvent.category")}</Text>
            <Text style={[styles.cardSticker, { color: sticker.bg }]}>
              {categorySticker(category).bg === sticker.bg ? "●" : ""}
            </Text>
          </View>
          <View style={styles.chips}>
            {CATEGORY_ORDER.map((key) => {
              const s = categorySticker(key);
              return (
                <Chip
                  key={key}
                  icon={categorySticker(key).bg === sticker.bg ? "●" : undefined}
                  label={t(`discover.categories.${key}`)}
                  selected={category === key}
                  onPress={() => setCategory(key)}
                  sticker={s}
                />
              );
            })}
          </View>
        </View>

        {/* Group size + timing card */}
        <View style={styles.card}>
          <Text style={styles.cardKicker}>{t("createEvent.groupKicker")}</Text>
          <Text style={styles.fieldLabel}>{t("createEvent.size")}</Text>
          <View style={styles.chips}>
            {SIZES.map((size) => (
              <Chip
                key={size}
                label={String(size)}
                selected={maxSize === size}
                onPress={() => setMaxSize(size)}
              />
            ))}
          </View>
          <Text style={styles.fieldLabel}>{t("createEvent.startsIn")}</Text>
          <TextInput
            accessibilityLabel={t("createEvent.startsIn")}
            value={hoursAhead}
            onChangeText={setHoursAhead}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={t("createEvent.submit")}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
          style={styles.cta}
        />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  kicker: { ...type.overline, color: colors.primary },
  kickerHint: { ...type.footnote, color: colors.textMuted, marginTop: -spacing.xs },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevation.low,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardKicker: { ...type.kicker, color: colors.textMuted },
  cardSticker: { fontSize: 10 },
  fieldLabel: { ...type.footnote, color: colors.textMuted },
  input: {
    minHeight: 48,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...type.callout,
  },
  multiline: { minHeight: 88, paddingTop: spacing.sm, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { ...type.footnote, color: colors.danger },
  cta: { marginTop: spacing.sm },
});
