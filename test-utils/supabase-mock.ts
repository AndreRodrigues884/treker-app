// In-memory stand-in for src/lib/supabase/client in Jest tests. Use it with:
//   jest.mock('@/lib/supabase/client', () => require('<path>/test-utils/supabase-mock').clientModule);
// and call resetSupabaseMock() in beforeEach.
//
// Each table is a list of rows. `from(table)` supports the subset of the supabase-js query
// builder the repositories use: select (with filters, order, single/maybeSingle and head counts),
// upsert by id and update. Like the server, it fills created_at/updated_at. It does not check RLS
// or constraints: those are tested in pgTAP (supabase/tests).
import type { Session } from '@supabase/supabase-js';

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

    const rows = rowsOf(this.table);
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
      return { data: null, ...ok };
    }
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
