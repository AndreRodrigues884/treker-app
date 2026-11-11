import { router } from 'expo-router';
import { ChevronRight, SearchX, Trophy, Waves } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Chip,
  EmptyState,
  ErrorNotice,
  Icon,
  Screen,
  TextField,
} from '@/components';
import { localDateOf } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { exerciseName, normalizeSearch } from '@/core/exercises';
import { formatLocalDate, formatWeight } from '@/core/format';
import { interpolate } from '@/core/i18n';
import type { Sport } from '@/core/onboarding';
import { isRecentRecord } from '@/core/progress';
import { fromKilograms } from '@/core/units';
import { setText, type DisplayUnits } from '@/features/activities/labels';
import { useAuth } from '@/features/auth/auth-provider';
import { useExercises } from '@/features/exercises/queries';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import { useGymRecords } from '@/features/records/queries';
import type { GymRecord } from '@/features/records/repository';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, opacity, radii, sizes, spacing } from '@/theme';

/**
 * Personal records, one tab per sport the athlete trains. Gym: the current record of each
 * exercise (estimated 1RM, the set that gave it and the date), the most recent first, with the
 * last 7 days highlighted, and a search by name. Swimming has its records later. Tapping a record
 * opens the exercise.
 */
export default function RecordsScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const sports: Sport[] = profile?.sports?.length ? profile.sports : ['gym'];
  const [tab, setTab] = useState<Sport>(sports[0] ?? 'gym');
  const shown = sports.includes(tab) ? tab : (sports[0] ?? 'gym');

  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <View style={styles.content}>
        {sports.length > 1 && (
          <View
            style={styles.tabs}
            accessibilityRole="tablist"
            accessibilityLabel={t.records.sport}
          >
            {sports.map((sport) => (
              <Chip
                key={sport}
                label={sport === 'gym' ? t.records.gym : t.records.swim}
                tone={sport}
                selected={shown === sport}
                onPress={() => setTab(sport)}
              />
            ))}
          </View>
        )}
        {shown === 'gym' ? (
          <GymRecords />
        ) : (
          <EmptyState
            icon={Waves}
            tone="swim"
            title={t.records.swimEmptyTitle}
            body={t.records.swimEmptyBody}
          />
        )}
      </View>
    </Screen>
  );
}

function GymRecords() {
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const records = useGymRecords();
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const today = localDateOf(new Date(), getDeviceTimezone());
  const units: DisplayUnits = {
    weight: profile?.weight_unit ?? 'kg',
    distance: profile?.pool_unit ?? 'm',
    language,
  };

  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );
  const nameOf = (record: GymRecord) => {
    const exercise = byId.get(record.exerciseId);
    return exercise ? exerciseName(exercise, language) : t.templateEditor.unknownExercise;
  };
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  const shown = (records.data ?? []).filter((record) => {
    const name = normalizeSearch(nameOf(record));
    return words.every((word) => name.includes(word));
  });

  if (records.isSuccess && records.data.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        tone="record"
        title={t.records.emptyTitle}
        body={t.records.emptyBody}
      />
    );
  }

  return (
    <View style={styles.list}>
      <TextField
        label={t.records.search}
        placeholder={t.records.searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {records.isError && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(records.error)]}
          network={classifyRequestError(records.error) === 'network'}
          onRetry={() => records.refetch()}
          retryLabel={t.common.retry}
          retrying={records.isFetching}
        />
      )}
      {records.isPending && <AppText color="muted">{t.common.loading}</AppText>}
      {records.isSuccess && shown.length === 0 && (
        <EmptyState icon={SearchX} title={t.records.noResults} body={t.exercises.emptyBody} />
      )}
      {shown.map((record) => (
        <RecordRow
          key={record.exerciseId}
          record={record}
          name={nameOf(record)}
          units={units}
          today={today}
        />
      ))}
    </View>
  );
}

function RecordRow({
  record,
  name,
  units,
  today,
}: {
  record: GymRecord;
  name: string;
  units: DisplayUnits;
  today: string;
}) {
  const { t } = useI18n();
  const recent = isRecentRecord(record.localDate, today);
  const value = interpolate(t.exercise.recordValue, {
    value: formatWeight(fromKilograms(record.valueKg, units.weight), units.weight, units.language),
  });
  const detail = interpolate(t.records.setOn, {
    set: setText({ weight_kg: record.weightKg, reps: record.reps, duration_s: null }, units),
    date: formatLocalDate(record.localDate, units.language, today),
  });

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: record.exerciseId } })}
      accessibilityRole="button"
      accessibilityLabel={[name, value, detail, recent ? t.records.recentLabel : null]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.row, recent && styles.recent, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Icon icon={Trophy} color="record" />
      </View>
      <View style={styles.text}>
        <View style={styles.title}>
          <AppText variant="heading" numberOfLines={2} style={styles.flex}>
            {name}
          </AppText>
          {recent && <Badge label={t.records.recent} tone="record" emphasis="solid" />}
        </View>
        <AppText variant="numeric">{value}</AppText>
        <AppText variant="caption" color="muted">
          {detail}
        </AppText>
      </View>
      <Icon icon={ChevronRight} size="sm" color="dim" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  list: {
    gap: spacing[3],
  },
  row: {
    minHeight: sizes.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: sizes.border,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  recent: {
    borderColor: colors.record,
    backgroundColor: colors[accentTints.record],
  },
  pressed: {
    opacity: opacity.pressed,
  },
  icon: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors[accentTints.record],
  },
  text: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  flex: {
    flexShrink: 1,
  },
});
