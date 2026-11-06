// Exercises: the shared library (owner_id null, read-only) and the athlete's custom ones.
import type { CustomExerciseValues } from '@/core/exercises';
import type { DataContext } from '@/lib/data/context';
import { throwIfError, unwrap, unwrapMaybe } from '@/lib/data/result';
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

// The library and the athlete's own exercises (RLS returns exactly those), archived and deleted
// ones included: logged workouts keep pointing at them and still need their names. The library
// screen hides them.
export async function listExercises(_ctx: DataContext): Promise<ExerciseRow[]> {
  return unwrap(await supabase.from('exercises').select('*').order('name_en', { ascending: true }));
}

function customColumns(values: CustomExerciseValues) {
  return {
    name_en: values.name,
    name_pt: values.name,
    muscle_group: values.muscleGroup,
    equipment: values.equipment,
    unit: values.unit,
    tracks_load: values.tracksLoad,
    adds_bodyweight: values.addsBodyweight,
  };
}

// Changes a custom exercise. Changing the unit, the load or the bodyweight rule makes Postgres
// rebuild its records.
export async function updateCustomExercise(
  ctx: DataContext,
  id: string,
  values: CustomExerciseValues,
): Promise<ExerciseRow> {
  return unwrap(
    await supabase
      .from('exercises')
      .update(customColumns(values))
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select()
      .single(),
  );
}

// Deletes a custom exercise in one request: Postgres delete_custom_exercise marks it deleted and
// takes it out of every saved workout, in one transaction. Logged sets, records and stats keep it.
// Repeating it after a network failure changes nothing.
export async function deleteCustomExercise(_ctx: DataContext, id: string): Promise<void> {
  throwIfError(await supabase.rpc('delete_custom_exercise', { p_exercise_id: id }));
}
