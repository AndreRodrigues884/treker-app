// Exercises: the shared library (owner_id null, read-only) and the athlete's custom ones.
import type { DataContext } from '@/lib/data/context';
import { unwrap, unwrapMaybe } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type ExerciseRow = Tables<'exercises'>;

export type NewCustomExercise = {
  // Pass the same id when retrying, so the exercise is not created twice.
  id?: string;
  // Custom exercises keep the athlete's name in both languages.
  name: string;
  muscleGroup: ExerciseRow['muscle_group'];
  equipment: ExerciseRow['equipment'];
  tracksLoad?: boolean;
  unit?: ExerciseRow['unit'];
  addsBodyweight?: boolean;
};

export async function createCustomExercise(
  ctx: DataContext,
  input: NewCustomExercise,
): Promise<ExerciseRow> {
  const name = input.name.trim();
  const row = {
    id: input.id ?? ctx.newId(),
    owner_id: ctx.userId,
    name_en: name,
    name_pt: name,
    muscle_group: input.muscleGroup,
    equipment: input.equipment,
    tracks_load: input.tracksLoad ?? true,
    unit: input.unit ?? 'reps',
    adds_bodyweight: input.addsBodyweight ?? false,
  };
  return unwrap(
    await supabase.from('exercises').upsert(row, { onConflict: 'id' }).select().single(),
  );
}

export async function findCustomExerciseByName(
  ctx: DataContext,
  name: string,
): Promise<ExerciseRow | null> {
  return unwrapMaybe(
    await supabase
      .from('exercises')
      .select('*')
      .eq('owner_id', ctx.userId)
      .eq('name_en', name.trim())
      .is('deleted_at', null)
      .maybeSingle(),
  );
}
