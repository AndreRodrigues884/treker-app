// In-memory stand-in for src/lib/supabase/client in Jest tests. Use it with:
//   jest.mock('@/lib/supabase/client', () => require('<path>/test-utils/supabase-mock').clientModule);
// and call resetSupabaseMock() in beforeEach.
//
// Each table is a list of rows. `from(table)` supports the subset of the supabase-js query
// builder the repositories use: select (with filters, order, single/maybeSingle and head counts),
// upsert by id and update. Like the server, it fills created_at/updated_at. It does not check RLS
// or constraints: those are tested in pgTAP (supabase/tests).
import type { Session } from '@supabase/supabase-js';

import { compareActivities } from '@/core/activities';
import { estimateOneRepMax } from '@/core/records';
import type { Tables } from '@/lib/supabase/database.types';

type AuthListener = (event: string, session: Session | null) => void;
type Row = Record<string, unknown>;

// The whole server row, as select('*') returns it.
export type ProfileRow = Tables<'profiles'>;

// What supabase-js returns when the phone has no connection.
export const networkError = {
  message: 'TypeError: Network request failed',
  details: '',
  hint: '',
  code: '',
};

export const TEST_USER_ID = 'aaaaaaaa-0000-0000-0000-000000000000';

export const testSession = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: TEST_USER_ID, email: 'ana@example.com' },
} as unknown as Session;

const SERVER_NOW = '2026-11-04T10:00:00.000Z';

// Column defaults the server applies on insert.
const DEFAULTS: Record<string, Row> = {
  activities: {
    ended_at: null,
    notes: null,
    visibility: 'private',
    bodyweight_kg: null,
    deleted_at: null,
  },
  gym_sets: { deleted_at: null },
  swim_entries: { deleted_at: null },
  exercises: { slug: null, archived: false, deleted_at: null },
  workout_templates: { notes: null, deleted_at: null },
};

const state = {
  session: null as Session | null,
  tables: {} as Record<string, Row[]>,
  // When set, every database request fails with this error (see goOffline).
  failure: null as object | null,
  // When set, updates to profiles fail with this error (see failProfileUpdates).
  profileUpdateError: null as object | null,
  // Milliseconds before a profile read answers, like a real network (see delayProfileReads).
  profileDelayMs: 0,
  listeners: new Set<AuthListener>(),
};

function emit(event: string, session: Session | null) {
  state.session = session;
  state.listeners.forEach((listener) => listener(event, session));
}

const ok = { error: null };

function rowsOf(table: string): Row[] {
  state.tables[table] ??= [];
  return state.tables[table];
}

type Filter = (row: Row) => boolean;

type Result = { data: unknown; error: unknown; count?: number | null };

class Query {
  private operation: 'select' | 'upsert' | 'update' = 'select';
  private values: Row | Row[] = {};
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private returnRows = false;
  private headCount = false;
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';
  private maxRows: number | null = null;

  constructor(private readonly table: string) {}

  select(_columns = '*', options: { count?: string; head?: boolean } = {}) {
    if (this.operation === 'select') {
      this.headCount = options.head === true;
    } else {
      this.returnRows = true;
    }
    return this;
  }

  upsert(values: Row | Row[], _options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.values = values;
    supabaseMock.writes.push({ table: this.table, operation: 'upsert', values });
    return this;
  }

  update(values: Row) {
    this.operation = 'update';
    this.values = values;
    supabaseMock.writes.push({ table: this.table, operation: 'update', values });
    if (this.table === 'profiles') supabaseMock.updateProfile(values);
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: null) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  gte(column: string, value: string | number) {
    this.filters.push((row) => (row[column] as string | number) >= value);
    return this;
  }

  lte(column: string, value: string | number) {
    this.filters.push((row) => (row[column] as string | number) <= value);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  single() {
    this.mode = 'single';
    return this;
  }

  maybeSingle() {
    this.mode = 'maybeSingle';
    return this;
  }

  // Awaiting the builder runs the request, like supabase-js.
  then<R1 = Result, R2 = never>(
    onFulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }

  private async execute(): Promise<Result> {
    if (this.table === 'profiles' && this.operation === 'select' && state.profileDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, state.profileDelayMs));
    }
    if (state.failure) return { data: null, error: state.failure, count: null };
    if (this.table === 'profiles' && this.operation === 'update' && state.profileUpdateError) {
      return { data: null, error: state.profileUpdateError };
    }

    // current_records is a view: the best record per exercise.
    const rows = this.table === 'current_records' ? currentRecords() : rowsOf(this.table);
    let result: Row[];

    if (this.operation === 'upsert') {
      result = (Array.isArray(this.values) ? this.values : [this.values]).map((values) => {
        const existing = rows.find((row) => row.id === values.id);
        if (existing) {
          Object.assign(existing, values, { updated_at: SERVER_NOW });
          return existing;
        }
        const inserted = {
          ...DEFAULTS[this.table],
          ...values,
          created_at: SERVER_NOW,
          updated_at: SERVER_NOW,
        };
        rows.push(inserted);
        return inserted;
      });
    } else {
      result = rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.operation === 'update') {
        for (const row of result) Object.assign(row, this.values, { updated_at: SERVER_NOW });
      }
    }

    for (const { column, ascending } of [...this.orders].reverse()) {
      result = [...result].sort((a, b) => {
        const left = a[column] as string | number;
        const right = b[column] as string | number;
        return (left < right ? -1 : left > right ? 1 : 0) * (ascending ? 1 : -1);
      });
    }

    if (this.maxRows !== null) result = result.slice(0, this.maxRows);
    if (this.headCount) return { data: null, error: null, count: result.length };
    if (this.operation !== 'select' && !this.returnRows) return { data: null, error: null };

    const copies = result.map((row) => ({ ...row }));
    if (this.mode === 'single') {
      return copies.length === 1
        ? { data: copies[0], error: null }
        : {
            data: null,
            error: {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
            },
          };
    }
    if (this.mode === 'maybeSingle') return { data: copies[0] ?? null, error: null };
    return { data: copies, error: null };
  }
}

export const supabaseMock = {
  // Every write, in order, for assertions.
  writes: [] as { table: string; operation: 'upsert' | 'update'; values: Row | Row[] }[],
  // Called on every update to profiles, for assertions.
  updateProfile: jest.fn((_values: Row) => {}),
  // rpc('delete_activity') marks the activity and its children deleted at once (a no-op when
  // already deleted; P0002 when not the user's). rpc('save_workout_template') upserts the
  // template and replaces its list like the Postgres function (see saveWorkoutTemplate).
  // rpc('delete_custom_exercise') marks the user's exercise and its template rows deleted (a
  // no-op when already deleted; P0002 for library or other users' exercises).
  // rpc('list_activity_summaries') pages the user's workouts with their totals, like the Postgres
  // function (see listActivitySummaries below).
  // rpc('delete_my_account') removes the user's rows, like the cascade in Postgres.
  rpc: jest.fn(async (fn: string, args: Row = {}) => {
    if (state.failure) return { data: null, error: state.failure };
    if (fn === 'delete_activity') {
      const activity = rowsOf('activities').find(
        (row) => row.id === args.p_activity_id && row.user_id === TEST_USER_ID,
      );
      if (!activity) {
        return { data: null, error: { code: 'P0002', message: 'activity not found' } };
      }
      if (activity.deleted_at) return { data: null, ...ok };
      for (const table of ['gym_sets', 'swim_entries']) {
        for (const row of rowsOf(table)) {
          if (row.activity_id === activity.id && !row.deleted_at) row.deleted_at = SERVER_NOW;
        }
      }
      activity.deleted_at = SERVER_NOW;
      // Records rebuilt without this workout's sets.
      const touched = rowsOf('gym_sets')
        .filter((row) => row.activity_id === activity.id)
        .map((row) => row.exercise_id as string);
      for (const exerciseId of new Set(touched)) rebuildGymRecords(exerciseId);
      return { data: null, ...ok };
    }
    if (fn === 'update_gym_session') return updateGymSession(args.p_session as Row);
    if (fn === 'current_gym_records') {
      return { data: currentGymRecords(args.p_exercise_id as string | undefined), error: null };
    }
    if (fn === 'exercise_progress') {
      return {
        data: exerciseProgress(args.p_exercise_id as string, args.p_from as string | undefined),
        error: null,
      };
    }
    if (fn === 'exercise_history') return { data: exerciseHistory(args), error: null };
    if (fn === 'delete_custom_exercise') {
      const exercise = rowsOf('exercises').find(
        (row) => row.id === args.p_exercise_id && row.owner_id === TEST_USER_ID,
      );
      if (!exercise) {
        return { data: null, error: { code: 'P0002', message: 'custom exercise not found' } };
      }
      if (exercise.deleted_at) return { data: null, ...ok };
      for (const row of rowsOf('workout_template_exercises')) {
        if (row.exercise_id === exercise.id && !row.deleted_at) row.deleted_at = SERVER_NOW;
      }
      exercise.deleted_at = SERVER_NOW;
      return { data: null, ...ok };
    }
    if (fn === 'save_gym_session') return saveGymSession(args.p_session as Row);
    if (fn === 'last_performance') {
      return { data: lastPerformance(args.p_exercise_ids as string[]), error: null };
    }
    if (fn === 'list_activity_summaries') {
      return { data: listActivitySummaries(args), error: null };
    }
    if (fn === 'save_workout_template') {
      return { data: null, error: saveWorkoutTemplate(args.p_template as TemplatePayload) };
    }
    if (fn === 'delete_my_account') {
      for (const table of Object.keys(state.tables)) {
        state.tables[table] = state.tables[table].filter(
          (row) => row.user_id !== TEST_USER_ID && row.id !== TEST_USER_ID,
        );
      }
    }
    return { data: null, ...ok };
  }),
  auth: {
    onAuthStateChange: jest.fn((listener: AuthListener) => {
      state.listeners.add(listener);
      listener('INITIAL_SESSION', state.session);
      return { data: { subscription: { unsubscribe: () => state.listeners.delete(listener) } } };
    }),
    signInWithOtp: jest.fn(async (_params: { email: string }) => ({ data: {}, ...ok })),
    // Succeeds by default; override with mockResolvedValueOnce to return an error.
    verifyOtp: jest.fn(async (_params: { email: string; token: string; type: string }) => {
      emit('SIGNED_IN', testSession);
      return { data: { session: testSession, user: testSession.user }, ...ok };
    }),
    signOut: jest.fn(async () => {
      emit('SIGNED_OUT', null);
      return ok;
    }),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  },
  from: jest.fn((table: string) => new Query(table)),
};

// Like Postgres list_activity_summaries: in the list order (compareActivities), strictly after the
// cursor, at most 50 a page; work sets and volume (assistance as zero) or swim times and metres.
function listActivitySummaries(args: Row): Row[] {
  const limit = Math.min(Math.max(Number(args.p_limit ?? 20), 1), 50);
  const before =
    args.p_before_date === undefined
      ? null
      : {
          localDate: args.p_before_date as string,
          startedAt: (args.p_before_started_at as string | undefined) ?? null,
          id: args.p_before_id as string,
        };
  const ordered = (row: Row) => ({
    localDate: row.local_date as string,
    startedAt: (row.started_at as string | null | undefined) ?? null,
    id: row.id as string,
  });
  return rowsOf('activities')
    .filter((activity) => activity.user_id === TEST_USER_ID && !activity.deleted_at)
    .filter((activity) => !before || compareActivities(ordered(activity), before) > 0)
    .sort((a, b) => compareActivities(ordered(a), ordered(b)))
    .slice(0, limit)
    .map((activity) => {
      const sets = rowsOf('gym_sets').filter(
        (set) => set.activity_id === activity.id && !set.deleted_at && !set.is_warmup,
      );
      const entries = rowsOf('swim_entries').filter(
        (entry) => entry.activity_id === activity.id && !entry.deleted_at,
      );
      const gym = activity.type === 'gym';
      const started = activity.started_at as string | null | undefined;
      const ended = activity.ended_at as string | null | undefined;
      return {
        id: activity.id,
        type: activity.type,
        title: activity.title ?? null,
        local_date: activity.local_date,
        started_at: started ?? null,
        ended_at: ended ?? null,
        duration_s:
          started && ended ? Math.floor((Date.parse(ended) - Date.parse(started)) / 1000) : null,
        set_count: gym ? sets.length : entries.length,
        volume_kg: gym
          ? sets.reduce(
              (total, set) =>
                total +
                Math.max((set.weight_kg as number | null) ?? 0, 0) *
                  ((set.reps as number | null) ?? 0),
              0,
            )
          : null,
        distance_m: gym
          ? null
          : entries.reduce(
              (total, entry) =>
                total +
                (entry.pool_length === '25yd'
                  ? (entry.distance as number) * 0.9144
                  : (entry.distance as number)),
              0,
            ),
      };
    });
}

// The latest (best) gym record per exercise, like the current_records view.
function currentRecords(): Row[] {
  const best = new Map<string, Row>();
  for (const record of rowsOf('personal_records')) {
    if (record.type !== 'gym') continue;
    const key = record.exercise_id as string;
    const current = best.get(key);
    if (!current || (record.value as number) > (current.value as number)) best.set(key, record);
  }
  return [...best.values()];
}

/**
 * Like Postgres save_gym_session: the activity and its sets in one go (an invalid set saves
 * nothing), ids from the phone, a repeated call duplicates nothing, another user's activity id is
 * refused (42501). New records: each work set whose estimated 1RM beats the best so far. Returns
 * the records of this activity.
 */
function saveGymSession(payload: Row): { data: Row[] | null; error: object | null } {
  const sets = (payload.sets as Row[]) ?? [];
  const existing = rowsOf('activities').find((row) => row.id === payload.id);
  if (existing && existing.user_id !== TEST_USER_ID) {
    return { data: null, error: { code: '42501', message: 'activity belongs to another user' } };
  }
  if (sets.some((set) => set.reps !== null && (set.reps as number) < 1)) {
    return { data: null, error: { code: '23514', message: 'violates check constraint' } };
  }
  if (!existing) {
    rowsOf('activities').push({
      id: payload.id,
      user_id: TEST_USER_ID,
      type: 'gym',
      local_date: payload.local_date,
      timezone: payload.timezone,
      started_at: payload.started_at,
      ended_at: payload.ended_at,
      title: payload.title,
      // No notes in v1: the column stays empty.
      notes: null,
      template_id: payload.template_id,
      bodyweight_kg: null,
      deleted_at: null,
      created_at: SERVER_NOW,
      updated_at: SERVER_NOW,
    });
  }
  const added = sets.filter((set) => !rowsOf('gym_sets').some((row) => row.id === set.id));
  for (const set of added) {
    rowsOf('gym_sets').push({
      ...set,
      user_id: TEST_USER_ID,
      activity_id: payload.id,
      deleted_at: null,
      created_at: SERVER_NOW,
      updated_at: SERVER_NOW,
    });
  }
  for (const exerciseId of new Set(added.map((set) => set.exercise_id as string))) {
    rebuildGymRecords(exerciseId);
  }
  return {
    data: rowsOf('personal_records').filter((record) => record.activity_id === payload.id),
    error: null,
  };
}

// The order Postgres rebuilds a key in: date, start time, then position in the workout.
function setsInHistoryOrder(exerciseId: string, options: { workOnly: boolean }) {
  const activities = new Map(rowsOf('activities').map((row) => [row.id as string, row]));
  return rowsOf('gym_sets')
    .filter((set) => {
      const activity = activities.get(set.activity_id as string);
      return (
        set.user_id === TEST_USER_ID &&
        set.exercise_id === exerciseId &&
        !set.deleted_at &&
        !(options.workOnly && set.is_warmup) &&
        activity !== undefined &&
        !activity.deleted_at
      );
    })
    .map((set) => ({ set, activity: activities.get(set.activity_id as string) as Row }))
    .sort((a, b) => {
      const date = String(a.activity.local_date).localeCompare(String(b.activity.local_date));
      if (date !== 0) return date;
      const aStart = (a.activity.started_at as string | null | undefined) ?? '9999';
      const bStart = (b.activity.started_at as string | null | undefined) ?? '9999';
      return (
        aStart.localeCompare(bStart) ||
        String(a.activity.id).localeCompare(String(b.activity.id)) ||
        (a.set.exercise_position as number) - (b.set.exercise_position as number) ||
        (a.set.set_number as number) - (b.set.set_number as number)
      );
    });
}

function estimateOf(set: Row, activity: Row): number | null {
  const exercise = rowsOf('exercises').find((row) => row.id === set.exercise_id);
  return estimateOneRepMax({
    weightKg: (set.weight_kg as number | null) ?? null,
    reps: (set.reps as number | null) ?? null,
    isWarmup: set.is_warmup === true,
    unit: (exercise?.unit as 'reps' | 'seconds') ?? 'reps',
    tracksLoad: (exercise?.tracks_load as boolean) ?? true,
    addsBodyweight: (exercise?.adds_bodyweight as boolean) ?? false,
    bodyweightKg: (activity.bodyweight_kg as number | null) ?? null,
  });
}

function volumeOf(set: Row): number {
  return Math.max((set.weight_kg as number | null) ?? 0, 0) * ((set.reps as number | null) ?? 0);
}

// Like private.rebuild_gym_key: the records and stats of one exercise, from its whole history.
function rebuildGymRecords(exerciseId: string) {
  state.tables.personal_records = rowsOf('personal_records').filter(
    (record) => !(record.type === 'gym' && record.exercise_id === exerciseId),
  );
  let best: number | null = null;
  let sequence = 0;
  const history = setsInHistoryOrder(exerciseId, { workOnly: false });
  for (const { set, activity } of history) {
    const estimate = estimateOf(set, activity);
    if (estimate !== null && (best === null || estimate > best)) {
      sequence += 1;
      rowsOf('personal_records').push({
        id: `record-${exerciseId}-${sequence}`,
        user_id: TEST_USER_ID,
        type: 'gym',
        activity_id: activity.id,
        gym_set_id: set.id,
        swim_entry_id: null,
        exercise_id: exerciseId,
        stroke: null,
        distance: null,
        pool_length: null,
        value: estimate,
        previous_value: best,
        sequence,
        local_date: activity.local_date,
      });
      best = estimate;
    }
  }
  state.tables.exercise_stats = rowsOf('exercise_stats').filter(
    (row) => row.exercise_id !== exerciseId,
  );
  const work = history.filter(({ set }) => !set.is_warmup);
  const last = history[history.length - 1];
  if (last) {
    rowsOf('exercise_stats').push({
      user_id: TEST_USER_ID,
      exercise_id: exerciseId,
      best_one_rep_max_kg: best,
      total_volume_kg: work.reduce((total, { set }) => total + volumeOf(set), 0),
      set_count: work.length,
      last_local_date: last.activity.local_date,
    });
  }
}

// Like Postgres update_gym_session: the caller's own gym workout, its sets replaced, the records of
// the exercises before and after rebuilt, its records returned.
function updateGymSession(payload: Row): { data: Row[] | null; error: object | null } {
  const activity = rowsOf('activities').find(
    (row) =>
      row.id === payload.id &&
      row.user_id === TEST_USER_ID &&
      row.type === 'gym' &&
      !row.deleted_at,
  );
  if (!activity) return { data: null, error: { code: 'P0002', message: 'gym workout not found' } };
  const sets = (payload.sets as Row[]) ?? [];
  const before = rowsOf('gym_sets')
    .filter((row) => row.activity_id === activity.id && !row.deleted_at)
    .map((row) => row.exercise_id as string);

  Object.assign(activity, {
    title: (payload.title as string | null) ?? null,
    local_date: payload.local_date ?? activity.local_date,
    started_at: payload.started_at ?? activity.started_at,
    updated_at: SERVER_NOW,
  });
  for (const set of sets) {
    const row = rowsOf('gym_sets').find((candidate) => candidate.id === set.id);
    if (row) {
      if (row.activity_id === activity.id) Object.assign(row, set, { deleted_at: null });
    } else {
      rowsOf('gym_sets').push({
        ...set,
        user_id: TEST_USER_ID,
        activity_id: activity.id,
        deleted_at: null,
        created_at: SERVER_NOW,
        updated_at: SERVER_NOW,
      });
    }
  }
  const kept = new Set(sets.map((set) => set.id));
  for (const row of rowsOf('gym_sets')) {
    if (row.activity_id === activity.id && !row.deleted_at && !kept.has(row.id)) {
      row.deleted_at = SERVER_NOW;
    }
  }
  for (const exerciseId of new Set([...before, ...sets.map((set) => set.exercise_id as string)])) {
    rebuildGymRecords(exerciseId);
  }
  return {
    data: rowsOf('personal_records').filter((record) => record.activity_id === activity.id),
    error: null,
  };
}

// Like Postgres current_gym_records: the current record per exercise, with its set.
function currentGymRecords(exerciseId?: string): Row[] {
  return currentRecords()
    .filter((record) => !exerciseId || record.exercise_id === exerciseId)
    .map((record) => {
      const set = rowsOf('gym_sets').find((row) => row.id === record.gym_set_id);
      return {
        exercise_id: record.exercise_id,
        value: record.value,
        previous_value: record.previous_value ?? null,
        local_date: record.local_date,
        activity_id: record.activity_id,
        gym_set_id: record.gym_set_id,
        weight_kg: set?.weight_kg ?? null,
        reps: set?.reps ?? null,
      };
    })
    .sort((a, b) => String(b.local_date).localeCompare(String(a.local_date)));
}

// Like Postgres exercise_progress: one point per workout, oldest first.
function exerciseProgress(exerciseId: string, from?: string): Row[] {
  const points = new Map<string, Row>();
  for (const { set, activity } of setsInHistoryOrder(exerciseId, { workOnly: true })) {
    if (from && String(activity.local_date) < from) continue;
    const point = points.get(activity.id as string) ?? {
      activity_id: activity.id,
      local_date: activity.local_date,
      started_at: activity.started_at ?? null,
      best_one_rep_max_kg: null,
      volume_kg: 0,
      set_count: 0,
      is_record: rowsOf('personal_records').some(
        (record) => record.activity_id === activity.id && record.exercise_id === exerciseId,
      ),
    };
    const estimate = estimateOf(set, activity);
    const bestSoFar = point.best_one_rep_max_kg as number | null;
    if (estimate !== null && (bestSoFar === null || estimate > bestSoFar)) {
      point.best_one_rep_max_kg = estimate;
    }
    point.volume_kg = (point.volume_kg as number) + volumeOf(set);
    point.set_count = (point.set_count as number) + 1;
    points.set(activity.id as string, point);
  }
  return [...points.values()];
}

// Like Postgres exercise_history: the workouts with this exercise, newest first, by cursor.
function exerciseHistory(args: Row): Row[] {
  const exerciseId = args.p_exercise_id as string;
  const limit = Math.min(Math.max(Number(args.p_limit ?? 20), 1), 50);
  const before =
    args.p_before_date === undefined
      ? null
      : {
          localDate: args.p_before_date as string,
          startedAt: (args.p_before_started_at as string | undefined) ?? null,
          id: args.p_before_id as string,
        };
  const ordered = (row: Row) => ({
    localDate: row.local_date as string,
    startedAt: (row.started_at as string | null | undefined) ?? null,
    id: row.id as string,
  });
  const setsOf = (activityId: unknown) =>
    rowsOf('gym_sets')
      .filter(
        (set) =>
          set.activity_id === activityId && set.exercise_id === exerciseId && !set.deleted_at,
      )
      .sort(
        (a, b) =>
          (a.exercise_position as number) - (b.exercise_position as number) ||
          (a.set_number as number) - (b.set_number as number),
      );
  return rowsOf('activities')
    .filter((activity) => activity.user_id === TEST_USER_ID && !activity.deleted_at)
    .filter((activity) => setsOf(activity.id).length > 0)
    .filter((activity) => !before || compareActivities(ordered(activity), before) > 0)
    .sort((a, b) => compareActivities(ordered(a), ordered(b)))
    .slice(0, limit)
    .map((activity) => ({
      activity_id: activity.id,
      title: activity.title ?? null,
      local_date: activity.local_date,
      started_at: activity.started_at ?? null,
      sets: setsOf(activity.id).map((set) => ({
        id: set.id,
        set_number: set.set_number,
        weight_kg: set.weight_kg ?? null,
        reps: set.reps ?? null,
        duration_s: set.duration_s ?? null,
        difficulty: set.difficulty ?? null,
        is_warmup: set.is_warmup ?? false,
      })),
    }));
}

// Like Postgres last_performance: per exercise, the work sets of its latest workout.
function lastPerformance(exerciseIds: string[]): Row[] {
  const ordered = (row: Row) => ({
    localDate: row.local_date as string,
    startedAt: (row.started_at as string | null | undefined) ?? null,
    id: row.id as string,
  });
  const activities = rowsOf('activities')
    .filter((activity) => activity.user_id === TEST_USER_ID && !activity.deleted_at)
    .sort((a, b) => compareActivities(ordered(a), ordered(b)));
  const result: Row[] = [];
  for (const exerciseId of exerciseIds) {
    const workSets = (activity: Row) =>
      rowsOf('gym_sets')
        .filter(
          (set) =>
            set.activity_id === activity.id &&
            set.exercise_id === exerciseId &&
            !set.deleted_at &&
            !set.is_warmup,
        )
        .sort(
          (a, b) =>
            (a.exercise_position as number) - (b.exercise_position as number) ||
            (a.set_number as number) - (b.set_number as number),
        );
    const latest = activities.find((activity) => workSets(activity).length > 0);
    if (!latest) continue;
    workSets(latest).forEach((set, index) =>
      result.push({
        exercise_id: exerciseId,
        activity_id: latest.id,
        local_date: latest.local_date,
        work_set_index: index + 1,
        weight_kg: set.weight_kg ?? null,
        reps: set.reps ?? null,
        duration_s: set.duration_s ?? null,
        difficulty: set.difficulty ?? null,
      }),
    );
  }
  return result;
}

type TemplatePayload = {
  id: string;
  name: string;
  notes: string | null;
  exercises: (Row & { id: string; exercise_id: string })[];
};

// Like Postgres save_workout_template: upserts the template by id, marks rows left out of the
// list deleted and upserts the list by row id with position = order in the array. Another
// user's template (42501) or custom exercise (23503) is refused before anything changes.
function saveWorkoutTemplate(payload: TemplatePayload): object | null {
  const templates = rowsOf('workout_templates');
  const items = rowsOf('workout_template_exercises');
  const existing = templates.find((row) => row.id === payload.id);
  if (existing && existing.user_id !== TEST_USER_ID) {
    return { code: '42501', message: 'new row violates row-level security policy' };
  }
  const foreign = payload.exercises.find((item) => {
    const exercise = rowsOf('exercises').find((row) => row.id === item.exercise_id);
    return exercise && exercise.owner_id !== null && exercise.owner_id !== TEST_USER_ID;
  });
  if (foreign) return { code: '23503', message: 'exercise is not available to this user' };

  if (existing) {
    Object.assign(existing, { name: payload.name, notes: payload.notes, updated_at: SERVER_NOW });
  } else {
    templates.push({
      ...DEFAULTS.workout_templates,
      id: payload.id,
      user_id: TEST_USER_ID,
      name: payload.name,
      notes: payload.notes,
      created_at: SERVER_NOW,
      updated_at: SERVER_NOW,
    });
  }
  const kept = new Set(payload.exercises.map((item) => item.id));
  for (const row of items) {
    if (row.template_id === payload.id && !row.deleted_at && !kept.has(row.id as string)) {
      row.deleted_at = SERVER_NOW;
    }
  }
  payload.exercises.forEach((item, position) => {
    const values = { ...item, position, template_id: payload.id, deleted_at: null };
    const row = items.find((candidate) => candidate.id === item.id);
    if (row) {
      Object.assign(row, values, { updated_at: SERVER_NOW });
    } else {
      items.push({
        ...values,
        user_id: TEST_USER_ID,
        created_at: SERVER_NOW,
        updated_at: SERVER_NOW,
      });
    }
  });
  return null;
}

// Adds exercises from the shared library (owner_id null) to the mock server.
export function seedLibraryExercises(
  exercises: (Partial<Tables<'exercises'>> & { id: string; name_en: string; name_pt: string })[],
) {
  for (const exercise of exercises) {
    rowsOf('exercises').push({
      owner_id: null,
      slug: exercise.id,
      muscle_group: 'chest',
      equipment: 'barbell',
      unit: 'reps',
      tracks_load: true,
      adds_bodyweight: false,
      archived: false,
      deleted_at: null,
      created_at: SERVER_NOW,
      updated_at: SERVER_NOW,
      ...exercise,
    });
  }
}

export const clientModule = {
  supabase: supabaseMock,
  startAutoRefreshWhileActive: () => () => {},
};

// The rows of a table on the (mock) server.
export function serverRows<T = Row>(table: string): T[] {
  return rowsOf(table) as T[];
}

export function serverProfileState(): ProfileRow | null {
  return (rowsOf('profiles')[0] as ProfileRow | undefined) ?? null;
}

// Every database request fails as without a connection (null: back online).
export function goOffline(offline = true) {
  state.failure = offline ? networkError : null;
}

export function failProfileUpdates(error: object | null) {
  state.profileUpdateError = error;
}

export function delayProfileReads(ms: number) {
  state.profileDelayMs = ms;
}

export function resetSupabaseMock(
  options: { signedIn?: boolean; profile?: ProfileRow | null } = {},
) {
  state.session = options.signedIn ? testSession : null;
  state.tables = { profiles: options.profile ? [{ ...options.profile }] : [] };
  state.failure = null;
  state.profileUpdateError = null;
  state.profileDelayMs = 0;
  state.listeners.clear();
  supabaseMock.writes = [];
  jest.clearAllMocks();
  supabaseMock.from.mockImplementation((table: string) => new Query(table));
}

// A profile right after signup (onboarding not done).
export function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: TEST_USER_ID,
    display_name: null,
    weight_unit: 'kg',
    pool_unit: 'm',
    timezone: 'UTC',
    locale: 'en',
    visibility: 'private',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    bodyweight_kg: null,
    onboarded_at: null,
    sports: null,
    gym_focus: null,
    swim_style: null,
    default_pool_length: null,
    weekly_target: null,
    ...overrides,
  };
}

// A profile that finished onboarding.
export function onboardedProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return profileRow({
    display_name: 'Ana',
    onboarded_at: '2026-11-04T10:00:00Z',
    sports: ['gym'],
    gym_focus: 'strength',
    weekly_target: 3,
    ...overrides,
  });
}
