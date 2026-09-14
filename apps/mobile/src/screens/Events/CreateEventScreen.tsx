import { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";

import { Button } from "../../components/common/Button";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/common/Chip";
import { TextField } from "../../components/common/TextField";
import { VenuePicker } from "../../components/events/VenuePicker";
import { ScreenHeader } from "../../components/common/ScreenHeader";
import { IconCalendar, IconClock, IconClose, IconPencil } from "../../components/ui/Icons";
import { PressableScale } from "../../components/ui/PressableScale";
import {
  CATEGORY_ORDER,
  categoryIcon,
  categorySticker,
} from "../../categoryMeta";
import { eventsApi } from "../../services/api/events";
import type { ResolvedPlace } from "../../services/places";
import { useLocationStore } from "../../store";
import { colors, radius, spacing, type } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList, "CreateEvent">;

const SIZES = [4, 5, 6] as const;

/**
 * Where a meetup lands when no place was picked — Shibuya, matching the discovery fallback.
 *
 * It used to be the *only* possibility: hosting posted this point no matter what venue name
 * was typed, so the name and the pin could describe different cities. `VenuePicker` is the
 * way out of that, and this is now just the floor for when place search is unavailable.
 */
const DEFAULT_LOCATION = { lat: 35.6595, lng: 139.7005 };

/** FR-13. `POST /events` already existed with nothing calling it. */
export function CreateEventScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // The one-shot fix Discover already took (shared via the store), so the venue search
  // looks around the member's district/province rather than Japan-wide. Null on a
  // denied/no-fix device keeps the Japan baseline.
  const near = useLocationStore((s) => s.lastFix);

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  /** Set once a searched place is resolved; null means the fallback point is in use. */
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("food");
  /**
   * When "Other" is selected, this holds the custom category text. The submitted
   * value is `otherCategory.trim()` (falling back to the "other" key if empty),
   * so the server always receives a non-empty category string.
   */
  const [otherCategory, setOtherCategory] = useState("");
  const [maxSize, setMaxSize] = useState<number>(6);
  /**
   * Exact start date+time, built from separate date and time picks. The old
   * "starts in N hours" text field could not express a meeting at 7pm on
   * Saturday — only "24 hours from now".
   */
  const [startDateTime, setStartDateTime] = useState(twelveHoursAhead());
  /** Android uses a single shared picker that toggles between date and time modes. */
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  /** iOS uses modal overlays that dismiss themselves. */
  const [showIOSDate, setShowIOSDate] = useState(false);
  const [showIOSTime, setShowIOSTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategory = category === "other" ? otherCategory.trim() || "other" : category;

  const canSubmit =
    title.trim().length > 0 &&
    venue.trim().length > 0 &&
    startDateTime.getTime() > Date.now() + 30_000; // at least 30s in the future

  /**
   * `onValueChange` / `onDismiss`, **not** `onChange`.
   *
   * `@react-native-community/datetimepicker` 9 deprecated `onChange` and splits it
   * into `onValueChange` (a value was chosen), `onDismiss` (cancelled) and
   * `onNeutralButtonPress`. The screen was still on `onChange`, which logs
   * "DateTimePicker: `onChange` is deprecated" at runtime and — the reported
   * symptom — did not reliably deliver the confirmed value: the clock dialog
   * closed on OK and the field kept its old time, so no same-day future meetup
   * could be published through the UI at all.
   *
   * The two callbacks also remove the guesswork the old handler needed: a dismiss
   * can no longer be mistaken for a confirm, because it arrives on a different
   * function.
   */
  function commitDate(_: DateTimePickerChangeEvent, selected: Date) {
    closePickers();
    // Keep the time the user already set; only the calendar day moves.
    const merged = new Date(selected);
    merged.setHours(startDateTime.getHours(), startDateTime.getMinutes(), 0, 0);
    setStartDateTime(merged);
  }

  function commitTime(_: DateTimePickerChangeEvent, selected: Date) {
    closePickers();
    // Keep the day; only the clock moves.
    const merged = new Date(startDateTime);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setStartDateTime(merged);
  }

  function closePickers() {
    setPickerMode(null);
    setShowIOSDate(false);
    setShowIOSTime(false);
  }

  function openPicker(mode: "date" | "time") {
    if (Platform.OS === "ios") {
      if (mode === "date") setShowIOSDate(true);
      else setShowIOSTime(true);
    } else {
      setPickerMode(mode);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);

    try {
      const { event } = await eventsApi.create({
        title: title.trim(),
        category: effectiveCategory,
        description: description.trim(),
        venue_name: venue.trim(),
        location: place?.location ?? DEFAULT_LOCATION,
        start_time: startDateTime.toISOString(),
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          // The route runs with `headerShown: false`, so nothing above this screen
          // reserves the status bar any more — without `insets.top` the title sits
          // under the clock. The page padding is added on top of the inset rather
          // than replacing it, so the header keeps the same optical gap from the
          // bar that every other screen has from its navigation header.
          paddingTop: insets.top + spacing.page,
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        {/*
          The screen's own header, because the route runs with `headerShown: false`.

          A modal is dismissed rather than popped, so the way out is a close control
          on the title's own row — not a back chevron in a bar that implies there is
          a page behind this one to return to. It also puts the title in the
          editorial tier the rest of the app uses.
        */}
        <ScreenHeader
          title={t("createEvent.title")}
          subtitle={t("createEvent.hostHint")}
          trailing={
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              onPress={() => navigation.goBack()}
              style={styles.close}
              scaleTo={0.92}
            >
              <IconClose size={18} color={colors.textMuted} />
            </PressableScale>
          }
          style={styles.header}
        />

        {/* Details card */}
        <Card style={styles.card}>
          <Text style={styles.cardKicker}>{t("createEvent.detailsKicker")}</Text>
          <TextField
            accessibilityLabel={t("createEvent.name")}
            value={title}
            onChangeText={setTitle}
            placeholder={t("createEvent.namePlaceholder")}
          />
          <VenuePicker
            value={venue}
            onChangeText={setVenue}
            picked={place}
            onPick={(next) => {
              setPlace(next);
              setVenue(next.name);
            }}
            onClearPick={() => setPlace(null)}
            near={near}
          />
          <TextField
            accessibilityLabel={t("createEvent.description")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("createEvent.descriptionPlaceholder")}
            multiline
            style={{ minHeight: 88 }}
          />
        </Card>

        {/* Category card */}
        <Card style={styles.card}>
          <Text style={styles.cardKicker}>{t("createEvent.category")}</Text>
          <View style={styles.chips}>
            {CATEGORY_ORDER.map((key) => {
              const s = categorySticker(key);
              const Mark = categoryIcon(key);
              return (
                <Chip
                  key={key}
                  icon={<Mark size={14} />}
                  label={t(`discover.categories.${key}`)}
                  selected={category === key}
                  onPress={() => setCategory(key)}
                  sticker={s}
                />
              );
            })}
            <Chip
              key="other"
              icon={<IconPencil size={14} />}
              label={t("createEvent.categoryOther")}
              selected={category === "other"}
              onPress={() => setCategory("other")}
            />
          </View>
          {category === "other" ? (
            <TextField
              accessibilityLabel={t("createEvent.categoryOther")}
              value={otherCategory}
              onChangeText={setOtherCategory}
              placeholder={t("createEvent.categoryOtherPlaceholder")}
              style={styles.otherField}
            />
          ) : null}
        </Card>

        {/* Group size + timing card */}
        <Card style={styles.card}>
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

          <Text style={styles.fieldLabel}>{t("createEvent.when")}</Text>
          <PressableScale
            accessibilityLabel={t("createEvent.pickDate")}
            accessibilityHint={t("createEvent.pickDateHint")}
            onPress={() => openPicker("date")}
            style={styles.dateButton}
            scaleTo={0.97}
          >
            <View style={styles.dateButtonContent}>
              <IconCalendar size={16} color={colors.primaryInk} />
              <Text style={styles.dateButtonText} numberOfLines={1}>
                {startDateTime.toLocaleDateString(i18n.language, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          </PressableScale>

          <PressableScale
            accessibilityLabel={t("createEvent.pickTime")}
            accessibilityHint={t("createEvent.pickTimeHint")}
            onPress={() => openPicker("time")}
            style={styles.timeButton}
            scaleTo={0.97}
          >
            <View style={styles.timeButtonContent}>
              <IconClock size={16} color={colors.primaryInk} />
              <Text style={styles.timeButtonText} numberOfLines={1}>
                {startDateTime.toLocaleTimeString(i18n.language, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </PressableScale>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={t("createEvent.submit")}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
          style={styles.cta}
        />
      </View>

      {/* Android: a single native picker that toggles between date and time modes. */}
      {Platform.OS === "android" && pickerMode ? (
        <DateTimePicker
          value={startDateTime}
          mode={pickerMode}
          is24Hour={false}
          display="default"
          onValueChange={pickerMode === "date" ? commitDate : commitTime}
          onDismiss={closePickers}
        />
      ) : null}

      {/* iOS: spinner pickers rendered inline with a Done button. */}
      {Platform.OS === "ios" && showIOSDate ? (
        <View style={styles.iosPickerWrapper}>
          <DateTimePicker
            value={startDateTime}
            mode="date"
            display="spinner"
            onValueChange={commitDate}
            onDismiss={closePickers}
          />
          <PressableScale
            accessibilityLabel={t("common.submit")}
            onPress={() => setShowIOSDate(false)}
            style={styles.iosDoneButton}
            scaleTo={0.97}
          >
            <Text style={styles.iosDoneText}>{t("common.submit")}</Text>
          </PressableScale>
        </View>
      ) : null}
      {Platform.OS === "ios" && showIOSTime ? (
        <View style={styles.iosPickerWrapper}>
          <DateTimePicker
            value={startDateTime}
            mode="time"
            display="spinner"
            onValueChange={commitTime}
            onDismiss={closePickers}
          />
          <PressableScale
            accessibilityLabel={t("common.submit")}
            onPress={() => setShowIOSTime(false)}
            style={styles.iosDoneButton}
            scaleTo={0.97}
          >
            <Text style={styles.iosDoneText}>{t("common.submit")}</Text>
          </PressableScale>
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * Default start time: 12 hours from now. The member can move the date and time
 * independently via the date and time pickers below.
 */
function twelveHoursAhead(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 12);
  return d;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.page, gap: spacing.md },
  header: { marginBottom: spacing.sm },
  /**
   * 44pt, not the 18pt glyph. The icon is small because a close control should be
   * quiet; the target is full size because a mis-tap here loses a filled-in form.
   */
  close: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    // Pulled toward the edge so the *glyph* lines up with the page margin while
    // the target still overhangs it.
    marginRight: -spacing.sm,
  },

  card: { gap: spacing.sm },
  cardKicker: { ...type.overline, color: colors.textMuted },
  fieldLabel: { ...type.footnote, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { ...type.footnote, color: colors.danger },
  cta: { marginTop: spacing.sm },

  otherField: {
    marginTop: spacing.xs,
  },

  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  dateButtonText: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  timeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  timeButtonText: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  iosPickerWrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  iosDoneButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  iosDoneText: {
    ...type.subhead,
    color: colors.primary,
    fontWeight: "600",
  },
});
