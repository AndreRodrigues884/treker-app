// Exercises in the local database. The shared library (owner_id null) is read-only here and
// arrives from the server in step 6b; the athlete only creates and edits their own.
import { and, eq, isNull } from 'drizzle-orm';

import { exercises, type LocalStore } from '@/lib/local-db';
import { inTransaction, recordChange, timestamp } from '@/lib/local-db/write';

export type ExerciseRow = typeof exercises.$inferSelect;

export type NewCustomExercise = {
  // Custom exercises keep the athlete's name in both languages.
  name: string;
  muscleGroup: ExerciseRow['muscle_group'];
  equipment: ExerciseRow['equipment'];
  tracksLoad?: boolean;
  unit?: ExerciseRow['unit'];
  addsBodyweight?: boolean;
};

export function createCustomExercise(store: LocalStore, input: NewCustomExercise): ExerciseRow {
  const id = store.newId();
  const now = timestamp(store);
  const name = input.name.trim();
  return inTransaction(store, (tx) => {
    tx.insert(exercises)
      .values({
        id,
        owner_id: store.userId,
        slug: null,
        name_en: name,
        name_pt: name,
        muscle_group: input.muscleGroup,
        equipment: input.equipment,
        tracks_load: input.tracksLoad ?? true,
        unit: input.unit ?? 'reps',
        adds_bodyweight: input.addsBodyweight ?? false,
        archived: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .run();
    return recordChange<ExerciseRow>(tx, store, 'exercises', exercises, id, 'upsert');
  });
}

export function findCustomExerciseByName(store: LocalStore, name: string): ExerciseRow | null {
  return (
    store.db
      .select()
      .from(exercises)
      .where(
        and(
          eq(exercises.owner_id, store.userId),
          eq(exercises.name_en, name.trim()),
          isNull(exercises.deleted_at),
        ),
      )
      .get() ?? null
  );
}
