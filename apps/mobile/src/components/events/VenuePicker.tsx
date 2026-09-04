import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { TextField } from "../common/TextField";
import { PressableScale } from "../ui/PressableScale";
import { IconLocate, IconSearch } from "../ui/Icons";
import { usePlaceSearch } from "../../features/places/usePlaceSearch";
import type { ResolvedPlace } from "../../services/places";
import { colors, radius, spacing, type } from "../../theme";
import type { Coords } from "../../types/api";

/** `venue_name` is capped at 80 characters server-side; a long POI name would 400. */
const VENUE_NAME_MAX = 80;

interface VenuePickerProps {
  value: string;
  onChangeText: (value: string) => void;
  /** A place was chosen and resolved to real coordinates. */
  onPick: (place: ResolvedPlace) => void;
  /** The member edited the name again, so the previously picked coordinates are stale. */
  onClearPick: () => void;
  picked: ResolvedPlace | null;
  /** Ranks results near the member, when a fix exists. */
  near?: Coords | null;
}

/**
 * Venue name plus a place search.
 *
 * Hosting used to post a hardcoded Shibuya point regardless of what was typed, so the venue
 * name and the pin on the map could disagree completely. Picking a real place is what makes
 * them agree — and what makes the "meetup near you" notice mean anything.
 *
 * Degrades rather than blocks. With no Mapbox token there is no search, the field stays a
 * plain text input, and hosting still works from the fallback coordinate — the same posture
 * the map takes when it cannot load Mapbox. The screen says which of the two it is instead of
 * leaving the member to guess.
 */
export function VenuePicker({
  value,
  onChangeText,
  onPick,
  onClearPick,
  picked,
  near,
}: VenuePickerProps) {
  const { t } = useTranslation();
  const { results, searching, available, resolve, clear } = usePlaceSearch(value, near);

  const choose = useCallback(
    async (id: string, name: string) => {
      // Collapse the list immediately: the tap has been registered, and leaving results up
      // while the coordinates resolve reads as the tap not having landed.
      clear();
      onChangeText(name.slice(0, VENUE_NAME_MAX));

      const place = await resolve(id);

      if (place) {
        onPick({ ...place, name: (place.name || name).slice(0, VENUE_NAME_MAX) });
      }
    },
    [clear, onChangeText, onPick, resolve]
  );

  const handleText = useCallback(
    (next: string) => {
      // Typing after a pick means the coordinates no longer describe what the field says.
      if (picked) onClearPick();
      onChangeText(next);
    },
    [onChangeText, onClearPick, picked]
  );

  const showResults = available && !picked && results.length > 0;

  return (
    <View style={styles.host}>
      <TextField
        accessibilityLabel={t("createEvent.venue")}
        value={value}
        onChangeText={handleText}
        placeholder={
          available
            ? t("createEvent.venueSearchPlaceholder")
            : t("createEvent.venuePlaceholder")
        }
        autoCorrect={false}
      />

      {/* State in words, never colour or a spinner alone (docs/DESIGN.md §10). */}
      {available && searching ? (
        <View style={styles.statusRow}>
          <IconSearch size={13} color={colors.textMuted} />
          <Text style={styles.status}>{t("createEvent.venueSearching")}</Text>
        </View>
      ) : null}

      {showResults ? (
        <View style={styles.results}>
          {results.map((place) => (
            <PressableScale
              key={place.id}
              accessibilityLabel={place.name}
              onPress={() => void choose(place.id, place.name)}
              style={styles.row}
              scaleTo={0.98}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {place.name}
                </Text>
                {place.address ? (
                  <Text style={styles.rowAddress} numberOfLines={1}>
                    {place.address}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}

      {picked ? (
        <View style={styles.statusRow}>
          <IconLocate size={13} color={colors.primary} />
          <Text style={styles.picked} numberOfLines={1}>
            {picked.address || t("createEvent.venuePicked")}
          </Text>
        </View>
      ) : null}

      {/* Honest about the fallback: without a token the pin is Shibuya whatever is typed. */}
      {!available ? (
        <Text style={styles.status}>{t("createEvent.venueSearchUnavailable")}</Text>
      ) : null}

      {available && !picked && value.trim().length >= 2 && !searching && results.length === 0 ? (
        <Text style={styles.status}>{t("createEvent.venueNoResults")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { gap: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  status: { ...type.caption, color: colors.textMuted },
  picked: { ...type.caption, color: colors.text, flex: 1 },
  results: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    overflow: "hidden",
  },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { gap: 2 },
  rowName: { ...type.bodyEmphasized, color: colors.text },
  rowAddress: { ...type.caption, color: colors.textMuted },
});
