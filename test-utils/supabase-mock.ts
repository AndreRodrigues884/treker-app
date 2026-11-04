// In-memory stand-in for src/lib/supabase/client in Jest tests. Use it with:
//   jest.mock('@/lib/supabase/client', () => require('<path>/test-utils/supabase-mock').clientModule);
// and call resetSupabaseMock() in beforeEach. Only the calls the app makes are implemented.
import type { Session } from '@supabase/supabase-js';

type AuthListener = (event: string, session: Session | null) => void;

export type ProfileRow = {
  id: string;
  display_name: string | null;
  weight_unit: 'kg' | 'lb';
  pool_unit: 'm' | 'yd';
  bodyweight_kg: number | null;
  onboarded_at: string | null;
  sports: ('gym' | 'swim')[] | null;
  gym_focus: 'strength' | 'hypertrophy' | 'maintenance' | null;
  swim_style: 'competitive' | 'fitness' | null;
  default_pool_length: '25m' | '50m' | '25yd' | null;
  weekly_target: number | null;
};

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

const state = {
  session: null as Session | null,
  profile: null as ProfileRow | null,
  // When set, profile updates fail with this error (see failProfileUpdates).
  updateError: null as object | null,
  listeners: new Set<AuthListener>(),
};

function emit(event: string, session: Session | null) {
  state.session = session;
  state.listeners.forEach((listener) => listener(event, session));
}

const ok = { error: null };

// from('profiles').update(values).eq('id', id); shared so tests can count the updates.
const updateProfile = jest.fn((values: Partial<ProfileRow>) => ({
  eq: async () => {
    if (state.updateError) return { error: state.updateError };
    if (state.profile) state.profile = { ...state.profile, ...values };
    return ok;
  },
}));

export const supabaseMock = {
  updateProfile,
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
  // from('profiles').select(...).eq('id', id).maybeSingle() and .update(values).eq('id', id)
  from: jest.fn((_table: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: state.profile, ...ok }) }),
    }),
    update: updateProfile,
  })),
};

export function failProfileUpdates(error: object | null) {
  state.updateError = error;
}

export function currentProfile(): ProfileRow | null {
  return state.profile;
}

export const clientModule = {
  supabase: supabaseMock,
  startAutoRefreshWhileActive: () => () => {},
};

export function resetSupabaseMock(
  options: { signedIn?: boolean; profile?: ProfileRow | null } = {},
) {
  state.session = options.signedIn ? testSession : null;
  state.profile = options.profile ?? null;
  state.updateError = null;
  state.listeners.clear();
  jest.clearAllMocks();
}

// A profile right after signup (onboarding not done).
export function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: TEST_USER_ID,
    display_name: null,
    weight_unit: 'kg',
    pool_unit: 'm',
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
