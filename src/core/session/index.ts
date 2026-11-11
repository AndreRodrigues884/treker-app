// The gym session in progress: its state, sets, totals, live records and rest timer, and the
// request that saves it (Postgres save_gym_session). Pure TypeScript.
//
// The session is a draft kept on the phone until the athlete taps "Finish"; only then is it sent,
// in one request. Weights are kept as typed, in the athlete's unit, and converted to kg
// (src/core/units) only when saving and when estimating a 1RM.
//
// Each exercise has a plan (number of sets × target reps or seconds). A set is filled in and
// marked as done in one step ("OK"), with how hard it felt: easy, medium or hard. There are no
// warm-up sets in the session.
import { z } from 'zod';

import { localDateOf } from '../dates';
import { estimateOneRepMax } from '../records';
import { fromKilograms, toKilograms, type WeightUnit } from '../units';

export const SESSION_VERSION = 1;

// Rest timer: 90 s by default, ±15 s a tap, between 15 s and 10 min.
export const DEFAULT_REST_S = 90;
export const REST_STEP_S = 15;
export const MIN_REST_S = 15;
export const MAX_REST_S = 600;

// How hard a set felt (gym_sets.difficulty).
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// Defaults for a new exercise without history or targets.
export const DEFAULT_REPS = 10;
export const DEFAULT_SECONDS = 30;

// The plan's limits (the database allows up to 100 sets per exercise).
export const PLAN_SETS = { min: 1, max: 20 } as const;
export const PLAN_REPS = { min: 1, max: 100 } as const;
export const PLAN_SECONDS = { min: 5, max: 3600, step: 5 } as const;

// Match the checks on gym_sets.
const LIMITS = {
  reps: { min: 1, max: 1000 },
  seconds: { min: 1, max: 86400 },
  weightKg: { min: -300, max: 1000 },
} as const;

export type ExerciseUnit = 'reps' | 'seconds';

// What the session needs to know about an exercise.
export type ExerciseInfo = {
  id: string;
  unit: ExerciseUnit;
  tracksLoad: boolean;
  addsBodyweight: boolean;
};

// One work set of "last time" (Postgres last_performance), numbered 1, 2, 3...
export type LastSet = {
  workSetIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  difficulty: Difficulty | null;
  localDate: string;
};

export type LastPerformance = Record<string, LastSet[]>;

export type SessionSet = {
  // gym_sets.id, made on the phone.
  id: string;
  // In the athlete's unit (weightUnit of the session).
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  difficulty: Difficulty | null;
  done: boolean;
  // Beat the best known 1RM when it was done (shown with the PR seal).
  pr: boolean;
};

export type SessionExercise = ExerciseInfo & {
  // Stable key in the session (an exercise can appear twice).
  key: string;
  // The plan's target per set (null: none, e.g. an exercise added during the workout).
  targetReps: number | null;
  targetSeconds: number | null;
  sets: SessionSet[];
  last: LastSet[];
};

export type RestTimer = { endsAt: string; durationS: number };

export type GymSession = {
  version: typeof SESSION_VERSION;
  // activities.id, made on the phone.
  id: string;
  userId: string;
  templateId: string | null;
  // The saved workout it came from.
  templateName: string | null;
  // The title typed on the finish screen; starts as the saved workout's name.
  title: string;
  startedAt: string;
  // The athlete's calendar date and timezone at the start.
  localDate: string;
  timezone: string;
  weightUnit: WeightUnit;
  bodyweightKg: number | null;
  exercises: SessionExercise[];
  restDurationS: number;
  rest: RestTimer | null;
  // The scheduled "rest is over" notification, to cancel it.
  restNotificationId: string | null;
};

// Starting --------------------------------------------------------------------------------------

export type TemplateItemInput = {
  exerciseId: string;
  targetSets: number;
  targetReps: number | null;
  targetSeconds: number | null;
};

export type StartSessionInput = {
  id: string;
  userId: string;
  now: Date;
  timezone: string;
  weightUnit: WeightUnit;
  bodyweightKg: number | null;
  template: { id: string; name: string; items: TemplateItemInput[] } | null;
  exercises: Readonly<Record<string, ExerciseInfo>>;
  last: LastPerformance;
  newId: () => string;
};

type Target = { reps: number | null; seconds: number | null };

// A set filled in with "last time" (the work set with the same number), or else the target.
function prefilledSet(
  exercise: ExerciseInfo,
  last: LastSet | undefined,
  target: Target,
  unit: WeightUnit,
  id: string,
): SessionSet {
  const weight =
    exercise.tracksLoad && last?.weightKg != null ? fromKilograms(last.weightKg, unit) : null;
  return {
    id,
    weight,
    reps: exercise.unit === 'reps' ? (last?.reps ?? target.reps ?? DEFAULT_REPS) : null,
    seconds:
      exercise.unit === 'seconds' ? (last?.durationS ?? target.seconds ?? DEFAULT_SECONDS) : null,
    difficulty: null,
    done: false,
    pr: false,
  };
}

function newExercise(
  info: ExerciseInfo,
  last: LastSet[],
  setCount: number,
  target: Target,
  unit: WeightUnit,
  newId: () => string,
): SessionExercise {
  return {
    ...info,
    key: newId(),
    targetReps: info.unit === 'reps' ? target.reps : null,
    targetSeconds: info.unit === 'seconds' ? target.seconds : null,
    last,
    sets: Array.from({ length: Math.max(1, setCount) }, (_, index) =>
      prefilledSet(info, lastTimeAt(last, index), target, unit, newId()),
    ),
  };
}

/**
 * A new session: empty, or from a saved workout with its exercises and target sets. Each set is
 * filled in with the weight and reps (or seconds) of the same set last time, or with the target
 * when there is no history.
 */
export function startSession(input: StartSessionInput): GymSession {
  const exercises = (input.template?.items ?? []).flatMap((item) => {
    const info = input.exercises[item.exerciseId];
    if (!info) return [];
    return [
      newExercise(
        info,
        input.last[item.exerciseId] ?? [],
        item.targetSets,
        { reps: item.targetReps, seconds: item.targetSeconds },
        input.weightUnit,
        input.newId,
      ),
    ];
  });
  return {
    version: SESSION_VERSION,
    id: input.id,
    userId: input.userId,
    templateId: input.template?.id ?? null,
    templateName: input.template?.name ?? null,
    title: input.template?.name ?? '',
    startedAt: input.now.toISOString(),
    localDate: localDateOf(input.now, input.timezone),
    timezone: input.timezone,
    weightUnit: input.weightUnit,
    bodyweightKg: input.bodyweightKg,
    exercises,
    restDurationS: DEFAULT_REST_S,
    rest: null,
    restNotificationId: null,
  };
}

// The title, kept in the draft as it is typed so it survives the app closing.
export function setSessionTitle(session: GymSession, title: string): GymSession {
  return { ...session, title };
}

// Last time ---------------------------------------------------------------------------------------

// The work set of last time with the same number as the set at `index` (0-based) of this session.
export function lastTimeAt(last: readonly LastSet[], index: number): LastSet | undefined {
  return last.find((set) => set.workSetIndex === index + 1);
}

// The exercise's plan ---------------------------------------------------------------------------

export type ExercisePlan = {
  setCount: number;
  // The target per set; when the plan has none, the first set's value.
  reps: number | null;
  seconds: number | null;
};

export function planOf(exercise: SessionExercise): ExercisePlan {
  const first = exercise.sets[0];
  return {
    setCount: exercise.sets.length,
    reps: exercise.unit === 'reps' ? (exercise.targetReps ?? first?.reps ?? DEFAULT_REPS) : null,
    seconds:
      exercise.unit === 'seconds'
        ? (exercise.targetSeconds ?? first?.seconds ?? DEFAULT_SECONDS)
        : null,
  };
}

export function doneCount(exercise: SessionExercise): number {
  return exercise.sets.filter((set) => set.done).length;
}

// Fewer sets than are done is not allowed: done sets are never removed by the plan.
export function minPlanSets(exercise: SessionExercise): number {
  return Math.max(PLAN_SETS.min, doneCount(exercise));
}

/**
 * Changes how many sets an exercise has and its target reps (or seconds). New sets go at the end,
 * filled in from last time or the target; fewer sets removes sets that are not done, from the end.
 * A new target is applied to the sets not done yet that had no "last time" to fill them.
 */
export function setExercisePlan(
  session: GymSession,
  key: string,
  plan: { setCount: number; reps: number | null; seconds: number | null },
  newId: () => string,
): GymSession {
  return mapExercise(session, key, (exercise) => {
    const target: Target = {
      reps: exercise.unit === 'reps' ? plan.reps : null,
      seconds: exercise.unit === 'seconds' ? plan.seconds : null,
    };
    const count = Math.min(PLAN_SETS.max, Math.max(minPlanSets(exercise), plan.setCount));

    let sets = exercise.sets.map((set, index) =>
      set.done || lastTimeAt(exercise.last, index)
        ? set
        : {
            ...set,
            reps: exercise.unit === 'reps' ? (target.reps ?? set.reps) : null,
            seconds: exercise.unit === 'seconds' ? (target.seconds ?? set.seconds) : null,
          },
    );
    while (sets.length > count) {
      const lastUndone = sets.map((set) => set.done).lastIndexOf(false);
      if (lastUndone < 0) break;
      sets = sets.filter((_, index) => index !== lastUndone);
    }
    while (sets.length < count) {
      sets = [
        ...sets,
        prefilledSet(
          exercise,
          lastTimeAt(exercise.last, sets.length),
          target,
          session.weightUnit,
          newId(),
        ),
      ];
    }
    return {
      ...exercise,
      targetReps: target.reps,
      targetSeconds: target.seconds,
      sets,
    };
  });
}

// Editing ---------------------------------------------------------------------------------------

function mapExercise(
  session: GymSession,
  key: string,
  change: (exercise: SessionExercise) => SessionExercise,
): GymSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) =>
      exercise.key === key ? change(exercise) : exercise,
    ),
  };
}

// Adds exercises at the end, each with one set filled in from last time.
export function addExercises(
  session: GymSession,
  exercises: readonly ExerciseInfo[],
  last: LastPerformance,
  newId: () => string,
): GymSession {
  return {
    ...session,
    exercises: [
      ...session.exercises,
      ...exercises.map((info) =>
        newExercise(
          info,
          last[info.id] ?? [],
          1,
          { reps: null, seconds: null },
          session.weightUnit,
          newId,
        ),
      ),
    ],
  };
}

export function removeExercise(session: GymSession, key: string): GymSession {
  return { ...session, exercises: session.exercises.filter((exercise) => exercise.key !== key) };
}

// One place up or down (the screen reader's actions on the drag handle).
export function moveExercise(session: GymSession, key: string, offset: -1 | 1): GymSession {
  const index = session.exercises.findIndex((exercise) => exercise.key === key);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= session.exercises.length) return session;
  const exercises = [...session.exercises];
  const [moved] = exercises.splice(index, 1);
  if (moved) exercises.splice(target, 0, moved);
  return { ...session, exercises };
}

// The order after dragging: the exercises' keys, in their new order.
export function reorderExercises(session: GymSession, keys: readonly string[]): GymSession {
  const byKey = new Map(session.exercises.map((exercise) => [exercise.key, exercise]));
  const ordered = keys.flatMap((key) => {
    const exercise = byKey.get(key);
    return exercise ? [exercise] : [];
  });
  // Anything the new order does not mention stays, at the end.
  const rest = session.exercises.filter((exercise) => !keys.includes(exercise.key));
  return { ...session, exercises: [...ordered, ...rest] };
}

// One set ---------------------------------------------------------------------------------------

export type SetValues = Pick<SessionSet, 'weight' | 'reps' | 'seconds' | 'difficulty'>;

export type SetProblem = 'reps' | 'seconds' | 'weight';

// Why a set cannot be saved yet, or null.
export function setProblem(
  exercise: ExerciseInfo,
  set: Pick<SessionSet, 'weight' | 'reps' | 'seconds'>,
  unit: WeightUnit,
): SetProblem | null {
  if (exercise.unit === 'reps') {
    const reps = set.reps;
    if (
      reps === null ||
      !Number.isInteger(reps) ||
      reps < LIMITS.reps.min ||
      reps > LIMITS.reps.max
    )
      return 'reps';
  } else {
    const seconds = set.seconds;
    if (
      seconds === null ||
      !Number.isInteger(seconds) ||
      seconds < LIMITS.seconds.min ||
      seconds > LIMITS.seconds.max
    )
      return 'seconds';
  }
  if (exercise.tracksLoad && set.weight !== null) {
    const kg = toKilograms(set.weight, unit);
    if (kg > LIMITS.weightKg.max || kg < LIMITS.weightKg.min) return 'weight';
    // Negative weight is assistance, only for exercises that add bodyweight.
    if (kg < 0 && !exercise.addsBodyweight) return 'weight';
  }
  return null;
}

// The estimated 1RM of a set in kg, with the same rules as the server (src/core/records): null
// for timed or unloaded exercises and sets above 12 reps.
export function setOneRepMaxKg(
  session: Pick<GymSession, 'weightUnit' | 'bodyweightKg'>,
  exercise: ExerciseInfo,
  set: Pick<SessionSet, 'weight' | 'reps'>,
): number | null {
  return estimateOneRepMax({
    weightKg: set.weight === null ? null : toKilograms(set.weight, session.weightUnit),
    reps: set.reps,
    isWarmup: false,
    unit: exercise.unit,
    tracksLoad: exercise.tracksLoad,
    addsBodyweight: exercise.addsBodyweight,
    bodyweightKg: session.bodyweightKg,
  });
}

/**
 * "OK" on a set: saves what was typed and how hard it felt, and marks it as done. The set gets the
 * PR seal when its estimated 1RM beats both the current record (`recordsKg`, from
 * current_records) and every other set done in this session for the same exercise. Starts the
 * rest timer when the set was not done yet (editing a done set does not).
 */
export function saveSet(
  session: GymSession,
  key: string,
  setId: string,
  values: SetValues,
  now: Date,
  recordsKg: Readonly<Record<string, number>>,
): GymSession {
  const exercise = session.exercises.find((item) => item.key === key);
  const set = exercise?.sets.find((item) => item.id === setId);
  if (!exercise || !set) return session;

  const best = sessionBestKg(session, exercise.id, setId, recordsKg[exercise.id] ?? null);
  const estimate = setOneRepMaxKg(session, exercise, values);
  const pr = estimate !== null && (best === null || estimate > best);

  const updated = mapExercise(session, key, (item) => ({
    ...item,
    sets: item.sets.map((current) =>
      current.id === setId ? { ...current, ...values, done: true, pr } : current,
    ),
  }));
  return set.done ? updated : startRest(updated, now);
}

// The best 1RM known for an exercise: the record and every other done set of this session.
function sessionBestKg(
  session: GymSession,
  exerciseId: string,
  exceptSetId: string,
  recordKg: number | null,
): number | null {
  let best = recordKg;
  for (const exercise of session.exercises) {
    if (exercise.id !== exerciseId) continue;
    for (const set of exercise.sets) {
      if (!set.done || set.id === exceptSetId) continue;
      const estimate = setOneRepMaxKg(session, exercise, set);
      if (estimate !== null && (best === null || estimate > best)) best = estimate;
    }
  }
  return best;
}

// Rest timer -------------------------------------------------------------------------------------
// The timer keeps its end time, not a countdown, so it is right after the app was in the
// background or the phone was locked.

export function startRest(session: GymSession, now: Date): GymSession {
  const endsAt = new Date(now.getTime() + session.restDurationS * 1000).toISOString();
  return { ...session, rest: { endsAt, durationS: session.restDurationS } };
}

// ±15 s on the running rest; the new length also becomes the default for the next sets.
export function adjustRest(session: GymSession, deltaS: number, now: Date): GymSession {
  if (!session.rest) return session;
  const remaining = restRemainingS(session.rest, now);
  const nextRemaining = Math.min(MAX_REST_S, Math.max(0, remaining + deltaS));
  const durationS = Math.min(MAX_REST_S, Math.max(MIN_REST_S, session.restDurationS + deltaS));
  return {
    ...session,
    restDurationS: durationS,
    rest: {
      endsAt: new Date(now.getTime() + nextRemaining * 1000).toISOString(),
      durationS: Math.max(0, session.rest.durationS + deltaS),
    },
  };
}

export function skipRest(session: GymSession): GymSession {
  return { ...session, rest: null, restNotificationId: null };
}

// Whole seconds left, never negative.
export function restRemainingS(rest: RestTimer | null, now: Date): number {
  if (!rest) return 0;
  return Math.max(0, Math.ceil((Date.parse(rest.endsAt) - now.getTime()) / 1000));
}

export function elapsedS(session: Pick<GymSession, 'startedAt'>, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(session.startedAt)) / 1000));
}

// Totals -------------------------------------------------------------------------------------------

// No duration: how long a workout takes is not recorded.
export type SessionSummary = {
  // Done sets.
  setCount: number;
  // Of the done sets, weight × reps in kg; assistance counts as zero.
  volumeKg: number;
  // Exercises with at least one done set.
  exerciseCount: number;
  prCount: number;
};

export function hasDoneSets(session: GymSession): boolean {
  return session.exercises.some((exercise) => exercise.sets.some((set) => set.done));
}

export function sessionSummary(session: GymSession): SessionSummary {
  let setCount = 0;
  let volumeKg = 0;
  let prCount = 0;
  let exerciseCount = 0;
  for (const exercise of session.exercises) {
    const done = exercise.sets.filter((set) => set.done);
    if (done.length > 0) exerciseCount += 1;
    for (const set of done) {
      if (set.pr) prCount += 1;
      setCount += 1;
      const kg = set.weight === null ? 0 : toKilograms(set.weight, session.weightUnit);
      volumeKg += Math.max(kg, 0) * (exercise.unit === 'reps' ? (set.reps ?? 0) : 0);
    }
  }
  return {
    setCount,
    volumeKg: Math.round(volumeKg * 1000) / 1000,
    exerciseCount,
    prCount,
  };
}

// Saving -------------------------------------------------------------------------------------------

export type SaveSessionPayload = {
  id: string;
  local_date: string;
  timezone: string;
  started_at: string;
  // Always null: the end of a workout, and so its duration, is not recorded.
  ended_at: null;
  title: string | null;
  template_id: string | null;
  sets: {
    id: string;
    exercise_id: string;
    exercise_position: number;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    duration_s: number | null;
    difficulty: Difficulty | null;
    is_warmup: boolean;
  }[];
};

/**
 * The p_session argument of save_gym_session. Only done sets are sent; exercises without one are
 * left out, and positions and set numbers are counted again (0, 1, 2... and 1, 2, 3...) so they
 * have no gaps. Weights go in kg. No notes (the v1 has none), no warm-ups and no end time (the
 * workout's duration is not recorded). Built only from the draft, so "Try again" always sends the
 * very same request.
 */
export function toSavePayload(session: GymSession): SaveSessionPayload {
  const sets: SaveSessionPayload['sets'] = [];
  let position = 0;
  for (const exercise of session.exercises) {
    const done = exercise.sets.filter((set) => set.done);
    if (done.length === 0) continue;
    done.forEach((set, index) => {
      sets.push({
        id: set.id,
        exercise_id: exercise.id,
        exercise_position: position,
        set_number: index + 1,
        weight_kg:
          exercise.tracksLoad && set.weight !== null
            ? toKilograms(set.weight, session.weightUnit)
            : null,
        reps: exercise.unit === 'reps' ? set.reps : null,
        duration_s: exercise.unit === 'seconds' ? set.seconds : null,
        difficulty: set.difficulty,
        is_warmup: false,
      });
    });
    position += 1;
  }
  return {
    id: session.id,
    local_date: session.localDate,
    timezone: session.timezone,
    started_at: session.startedAt,
    ended_at: null,
    title: session.title.trim() || null,
    template_id: session.templateId,
    sets,
  };
}

// Editing a saved workout --------------------------------------------------------------------------
// The same session model, loaded from a saved workout: every set is done, there is no rest timer
// and no live PR seal (Postgres rebuilds the records when the changes are saved).

export type SavedSet = {
  id: string;
  exercise_id: string;
  exercise_position: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  difficulty: Difficulty | null;
  deleted_at: string | null;
};

export type LoadWorkoutInput = {
  activity: {
    id: string;
    user_id: string;
    template_id: string | null;
    title: string | null;
    local_date: string;
    timezone: string;
    started_at: string | null;
  };
  sets: readonly SavedSet[];
  exercises: Readonly<Record<string, ExerciseInfo>>;
  weightUnit: WeightUnit;
  bodyweightKg: number | null;
  newId: () => string;
};

// A saved workout as a session to edit: one exercise per position, in order, its sets done.
export function sessionFromWorkout(input: LoadWorkoutInput): GymSession {
  const byPosition = new Map<number, SavedSet[]>();
  for (const set of input.sets) {
    if (set.deleted_at !== null) continue;
    byPosition.set(set.exercise_position, [...(byPosition.get(set.exercise_position) ?? []), set]);
  }
  const exercises = [...byPosition.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, sets]) => {
      const first = sets[0];
      const info = first ? input.exercises[first.exercise_id] : undefined;
      if (!first || !info) return [];
      const ordered = [...sets].sort((a, b) => a.set_number - b.set_number);
      return [
        {
          ...info,
          key: input.newId(),
          targetReps: null,
          targetSeconds: null,
          last: [],
          sets: ordered.map((set) => ({
            id: set.id,
            weight: set.weight_kg === null ? null : fromKilograms(set.weight_kg, input.weightUnit),
            reps: set.reps,
            seconds: set.duration_s,
            difficulty: set.difficulty,
            done: true,
            pr: false,
          })),
        },
      ];
    });
  const { activity } = input;
  return {
    version: SESSION_VERSION,
    id: activity.id,
    userId: activity.user_id,
    templateId: activity.template_id,
    templateName: null,
    title: activity.title ?? '',
    startedAt: activity.started_at ?? `${activity.local_date}T12:00:00.000Z`,
    localDate: activity.local_date,
    timezone: activity.timezone,
    weightUnit: input.weightUnit,
    bodyweightKg: input.bodyweightKg,
    exercises,
    restDurationS: DEFAULT_REST_S,
    rest: null,
    restNotificationId: null,
  };
}

// "OK" on a set while editing: its values, done, no rest timer and no live seal.
export function saveEditedSet(
  session: GymSession,
  key: string,
  setId: string,
  values: SetValues,
): GymSession {
  return mapExercise(session, key, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) =>
      set.id === setId ? { ...set, ...values, done: true, pr: false } : set,
    ),
  }));
}

// When the workout happened: the athlete's calendar date and the start instant.
export function setSessionWhen(
  session: GymSession,
  when: { localDate: string; startedAt: string },
): GymSession {
  return { ...session, localDate: when.localDate, startedAt: when.startedAt };
}

export type UpdateSessionPayload = Omit<SaveSessionPayload, 'ended_at'>;

/**
 * The p_session argument of update_gym_session. The sets sent are the workout as it should be:
 * new ones (new ids) are added, changed ones updated, and any set of the workout that is not sent
 * is marked deleted by Postgres. Only done sets are sent, with positions and numbers without gaps.
 */
export function toUpdatePayload(session: GymSession): UpdateSessionPayload {
  const { ended_at: _ended, ...payload } = toSavePayload(session);
  return payload;
}

// The draft on the phone ---------------------------------------------------------------------------
// Fields added after the first drafts were written are optional here, so a workout in progress
// survives an app update.

const difficultySchema = z.enum(DIFFICULTIES).nullable().optional();

const lastSetSchema = z.object({
  workSetIndex: z.number(),
  weightKg: z.number().nullable(),
  reps: z.number().nullable(),
  durationS: z.number().nullable(),
  difficulty: difficultySchema,
  localDate: z.string(),
});

const sessionSchema = z.object({
  version: z.literal(SESSION_VERSION),
  id: z.string(),
  userId: z.string(),
  templateId: z.string().nullable(),
  templateName: z.string().nullable(),
  title: z.string().optional(),
  startedAt: z.string(),
  localDate: z.string(),
  timezone: z.string(),
  weightUnit: z.enum(['kg', 'lb']),
  bodyweightKg: z.number().nullable(),
  exercises: z.array(
    z.object({
      key: z.string(),
      id: z.string(),
      unit: z.enum(['reps', 'seconds']),
      tracksLoad: z.boolean(),
      addsBodyweight: z.boolean(),
      targetReps: z.number().nullable().optional(),
      targetSeconds: z.number().nullable().optional(),
      last: z.array(lastSetSchema),
      sets: z.array(
        z.object({
          id: z.string(),
          weight: z.number().nullable(),
          reps: z.number().nullable(),
          seconds: z.number().nullable(),
          difficulty: difficultySchema,
          done: z.boolean(),
          pr: z.boolean(),
        }),
      ),
    }),
  ),
  restDurationS: z.number(),
  rest: z.object({ endsAt: z.string(), durationS: z.number() }).nullable(),
  restNotificationId: z.string().nullable(),
  // Drafts from before the end time was dropped have one; it is ignored.
  endedAt: z.string().nullable().optional(),
});

// A stored draft read back, or null when it is missing, damaged, from an older version, or
// someone else's (one draft per user on the phone).
export function parseSession(value: unknown, userId: string): GymSession | null {
  const result = sessionSchema.safeParse(value);
  if (!result.success || result.data.userId !== userId) return null;
  const { endedAt: _endedAt, ...data } = result.data;
  return {
    ...data,
    title: data.title ?? data.templateName ?? '',
    exercises: data.exercises.map((exercise) => ({
      ...exercise,
      targetReps: exercise.targetReps ?? null,
      targetSeconds: exercise.targetSeconds ?? null,
      last: exercise.last.map((set) => ({ ...set, difficulty: set.difficulty ?? null })),
      sets: exercise.sets.map((set) => ({ ...set, difficulty: set.difficulty ?? null })),
    })),
  };
}
