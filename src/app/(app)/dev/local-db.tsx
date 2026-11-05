// Dev-only screen to inspect the local database: rows per table, the outbox waiting to be sent,
// and buttons to create a test workout or delete the local database. Its texts are not translated.
import { count } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { Redirect, router } from 'expo-router';
import { ArrowLeft, Dumbbell, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '@/components';
import { localDateOf } from '@/core/dates';
import { startActivity } from '@/features/activities/repository';
import { useAuth } from '@/features/auth/auth-provider';
import { createCustomExercise, findCustomExerciseByName } from '@/features/exercises/repository';
import { addSet } from '@/features/gym/repository';
import { getDeviceTimezone } from '@/lib/device';
import { schema, useLocalQuery, waitingEntries, type LocalStore } from '@/lib/local-db';
import { spacing } from '@/theme';

const TABLES = Object.values(schema).map((table) => ({ table, name: getTableConfig(table).name }));
const TABLE_NAMES = TABLES.map(({ name }) => name);
const TEST_EXERCISE = 'Test bench press';

function readCounts(store: LocalStore) {
  return TABLES.map(({ table, name }) => ({
    name,
    rows: store.db.select({ rows: count() }).from(table).get()?.rows ?? 0,
  }));
}

// A gym workout today with 3 sets of a custom test exercise (created the first time).
function createTestWorkout(store: LocalStore) {
  const exercise =
    findCustomExerciseByName(store, TEST_EXERCISE) ??
    createCustomExercise(store, {
      name: TEST_EXERCISE,
      muscleGroup: 'chest',
      equipment: 'barbell',
    });
  const timezone = getDeviceTimezone();
  const activity = startActivity(store, {
    type: 'gym',
    timezone,
    localDate: localDateOf(store.now(), timezone),
    title: 'Test workout',
  });
  [60, 65, 70].forEach((weightKg, index) =>
    addSet(store, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: index + 1,
      weightKg,
      reps: 5,
    }),
  );
}

export default function LocalDatabaseRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <LocalDatabaseScreen />;
}

function LocalDatabaseScreen() {
  const { store, resetLocalData } = useAuth();
  const [message, setMessage] = useState<string>();
  const counts = useLocalQuery(store, readCounts, TABLE_NAMES);
  const waiting = useLocalQuery(store, (s) => waitingEntries(s.db), ['outbox']);

  if (!store) return <Screen>{null}</Screen>;

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.top}>
          <Button label="Back" variant="ghost" icon={ArrowLeft} onPress={() => router.back()} />
        </View>
        <AppText variant="title" accessibilityRole="header">
          Local database
        </AppText>
        <AppText variant="caption" color="muted">
          {store.databaseName}
        </AppText>

        <View style={styles.actions}>
          <Button
            label="Create test workout (3 sets)"
            icon={Dumbbell}
            fullWidth
            onPress={() => {
              createTestWorkout(store);
              setMessage('Test workout created.');
            }}
          />
          <Button
            label="Delete local database"
            variant="danger"
            icon={Trash2}
            fullWidth
            onPress={() => {
              resetLocalData();
              setMessage('Local database deleted; the profile is downloaded again.');
            }}
          />
          {message !== undefined && (
            <AppText color="positive" accessibilityLiveRegion="polite">
              {message}
            </AppText>
          )}
        </View>

        <AppText variant="heading" accessibilityRole="header">
          Rows per table
        </AppText>
        <Card>
          {(counts ?? []).map(({ name, rows }, index) => (
            <View key={name}>
              {index > 0 && <Divider />}
              <View style={styles.row} accessible accessibilityLabel={`${name}: ${rows}`}>
                <AppText style={styles.flex}>{name}</AppText>
                <AppText variant="numeric">{rows}</AppText>
              </View>
            </View>
          ))}
        </Card>

        <AppText variant="heading" accessibilityRole="header">
          Outbox: {waiting?.length ?? 0} waiting
        </AppText>
        {waiting?.length === 0 && <AppText color="muted">Nothing waiting to be sent.</AppText>}
        {waiting?.map((entry) => (
          <Card key={entry.id}>
            <View style={styles.row}>
              <AppText variant="heading" style={styles.flex}>
                {entry.table_name}
              </AppText>
              <Badge
                label={entry.operation}
                tone={entry.operation === 'delete' ? 'danger' : 'gym'}
              />
              <Badge label={entry.status} tone={entry.status === 'failed' ? 'danger' : 'neutral'} />
            </View>
            <AppText variant="caption" color="muted">
              #{entry.id} · row {entry.row_id.slice(0, 8)} · priority {entry.priority} · attempts{' '}
              {entry.attempts}
            </AppText>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  top: {
    alignItems: 'flex-start',
  },
  actions: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  flex: {
    flex: 1,
  },
});
