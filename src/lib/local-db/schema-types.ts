// Compile-time check that every local row type is exactly the server's row type (from the
// generated Supabase types). If a migration on either side adds, removes or retypes a column,
// `npm run typecheck` fails here until both sides agree again.
import type { InferSelectModel } from 'drizzle-orm';

import type { Tables } from '@/lib/supabase/database.types';

import type {
  activities,
  exercises,
  exerciseStats,
  gymSets,
  personalRecords,
  profiles,
  swimEntries,
  workoutTemplateExercises,
  workoutTemplates,
} from './schema';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

export type LocalSchemaMatchesServer = [
  Expect<Same<InferSelectModel<typeof profiles>, Tables<'profiles'>>>,
  Expect<Same<InferSelectModel<typeof exercises>, Tables<'exercises'>>>,
  Expect<Same<InferSelectModel<typeof workoutTemplates>, Tables<'workout_templates'>>>,
  Expect<
    Same<InferSelectModel<typeof workoutTemplateExercises>, Tables<'workout_template_exercises'>>
  >,
  Expect<Same<InferSelectModel<typeof activities>, Tables<'activities'>>>,
  Expect<Same<InferSelectModel<typeof gymSets>, Tables<'gym_sets'>>>,
  Expect<Same<InferSelectModel<typeof swimEntries>, Tables<'swim_entries'>>>,
  Expect<Same<InferSelectModel<typeof personalRecords>, Tables<'personal_records'>>>,
  Expect<Same<InferSelectModel<typeof exerciseStats>, Tables<'exercise_stats'>>>,
];
