import {
  addExercises,
  doneCount,
  elapsedS,
  hasDoneSets,
  lastTimeAt,
  liveProgress,
  minPlanSets,
  moveExercise,
  parseSession,
  planOf,
  removeExercise,
  reorderExercises,
  saveEditedSet,
  saveSet,
  sessionFromWorkout,
  sessionSummary,
  setExercisePlan,
  setOneRepMaxKg,
  setProblem,
  setSessionTitle,
  setSessionWhen,
  startSession,
  toSavePayload,
  toUpdatePayload,
  type ExerciseInfo,
  type GymSession,
  type LastPerformance,
  type SetValues,
} from '.';

const bench: ExerciseInfo = { id: 'bench', unit: 'reps', tracksLoad: true, addsBodyweight: false };
const plank: ExerciseInfo = {
  id: 'plank',
  unit: 'seconds',
  tracksLoad: false,
  addsBodyweight: false,
};
const pullUp: ExerciseInfo = {
  id: 'pull-up',
  unit: 'reps',
  tracksLoad: true,
  addsBodyweight: true,
};
const press: ExerciseInfo = { id: 'press', unit: 'reps', tracksLoad: true, addsBodyweight: false };
const exercises = { bench, plank, 'pull-up': pullUp, press };

const START = new Date('2026-11-04T23:30:00Z');

function ids(prefix = 'id') {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

const last: LastPerformance = {
  bench: [
    {
      workSetIndex: 1,
      weightKg: 97.5,
      reps: 6,
      durationS: null,
      difficulty: 'hard',
      localDate: '2026-11-01',
    },
    {
      workSetIndex: 2,
      weightKg: 95,
      reps: 6,
      durationS: null,
      difficulty: null,
      localDate: '2026-11-01',
    },
  ],
};

function pushDay(overrides: Partial<Parameters<typeof startSession>[0]> = {}): GymSession {
  return startSession({
    id: 'session',
    userId: 'ana',
    now: START,
    timezone: 'Europe/Madrid',
    weightUnit: 'kg',
    bodyweightKg: 70,
    template: {
      id: 'push-a',
      name: 'Push A',
      items: [
        { exerciseId: 'bench', targetSets: 3, targetReps: 8, targetSeconds: null },
        { exerciseId: 'plank', targetSets: 2, targetReps: null, targetSeconds: 45 },
      ],
    },
    exercises,
    last,
    newId: ids(),
    ...overrides,
  });
}

const benchKey = (session: GymSession) => session.exercises[0]!.key;
const setAt = (session: GymSession, exercise: number, set: number) =>
  session.exercises[exercise]!.sets[set]!;
const values = (overrides: Partial<SetValues> = {}): SetValues => ({
  weight: 100,
  reps: 5,
  seconds: null,
  difficulty: null,
  ...overrides,
});

describe('starting a session', () => {
  it('from a saved workout: its exercises, target sets and title, the local date at the start', () => {
    const session = pushDay();
    expect(session.title).toBe('Push A');
    // 23:30 UTC is already the next day in Madrid.
    expect(session.localDate).toBe('2026-11-05');
    expect(
      session.exercises.map((e) => [e.id, e.sets.length, e.targetReps, e.targetSeconds]),
    ).toEqual([
      ['bench', 3, 8, null],
      ['plank', 2, null, 45],
    ]);
  });

  it('fills each set with the same set last time, or with the target when there is none', () => {
    const session = pushDay();
    expect(session.exercises[0]!.sets.map((s) => [s.weight, s.reps])).toEqual([
      [97.5, 6],
      [95, 6],
      [null, 8],
    ]);
    expect(session.exercises[1]!.sets.map((s) => [s.weight, s.seconds])).toEqual([
      [null, 45],
      [null, 45],
    ]);
    expect(lastTimeAt(session.exercises[0]!.last, 0)?.difficulty).toBe('hard');
  });

  it('shows last time in pounds for an athlete who uses lb', () => {
    expect(setAt(pushDay({ weightUnit: 'lb' }), 0, 0).weight).toBe(215);
  });

  it('an empty workout has no exercises and no title', () => {
    const session = pushDay({ template: null });
    expect(session.exercises).toEqual([]);
    expect(session.templateId).toBeNull();
    expect(session.title).toBe('');
  });
});

describe('the exercise plan', () => {
  it('describes the sets and target ("3 × 8 reps")', () => {
    const session = pushDay();
    expect(planOf(session.exercises[0]!)).toEqual({ setCount: 3, reps: 8, seconds: null });
    expect(planOf(session.exercises[1]!)).toEqual({ setCount: 2, reps: null, seconds: 45 });
  });

  it('adds sets at the end and applies a new target to the sets without last time', () => {
    const session = setExercisePlan(
      pushDay(),
      benchKey(pushDay()),
      { setCount: 5, reps: 5, seconds: null },
      ids('new'),
    );
    expect(session.exercises[0]!.sets.map((s) => [s.weight, s.reps])).toEqual([
      [97.5, 6],
      [95, 6],
      [null, 5],
      [null, 5],
      [null, 5],
    ]);
    expect(session.exercises[0]!.targetReps).toBe(5);
  });

  it('removes sets that are not done, from the end, never the done ones', () => {
    let session = pushDay();
    const key = benchKey(session);
    const sets = session.exercises[0]!.sets;
    session = saveSet(session, key, sets[2]!.id, values(), {});
    expect(minPlanSets(session.exercises[0]!)).toBe(1);

    session = setExercisePlan(session, key, { setCount: 1, reps: 8, seconds: null }, ids('new'));
    expect(session.exercises[0]!.sets.map((s) => s.id)).toEqual([sets[2]!.id]);
    expect(doneCount(session.exercises[0]!)).toBe(1);
  });
});

describe('editing the workout', () => {
  it('adds exercises at the end, each with one set from last time', () => {
    const session = addExercises(pushDay({ template: null }), [bench, press], last, ids());
    expect(session.exercises.map((e) => [e.id, e.sets.length])).toEqual([
      ['bench', 1],
      ['press', 1],
    ]);
    expect(setAt(session, 0, 0)).toMatchObject({ weight: 97.5, reps: 6 });
    expect(setAt(session, 1, 0)).toMatchObject({ weight: null, reps: 10 });
  });

  it('reorders by dragging, moves one place (screen readers) and removes exercises', () => {
    const session = pushDay();
    const [benchEx, plankEx] = session.exercises;
    expect(
      reorderExercises(session, [plankEx!.key, benchEx!.key]).exercises.map((e) => e.id),
    ).toEqual(['plank', 'bench']);
    expect(moveExercise(session, plankEx!.key, -1).exercises.map((e) => e.id)).toEqual([
      'plank',
      'bench',
    ]);
    expect(moveExercise(session, plankEx!.key, 1)).toBe(session);
    expect(removeExercise(session, plankEx!.key).exercises.map((e) => e.id)).toEqual(['bench']);
  });
});

describe('saving a set ("OK")', () => {
  it('keeps the values and how hard it felt, and marks it done', () => {
    const session = pushDay();
    const id = setAt(session, 0, 0).id;
    const saved = saveSet(session, benchKey(session), id, values({ difficulty: 'medium' }), {});
    expect(setAt(saved, 0, 0)).toMatchObject({
      weight: 100,
      reps: 5,
      difficulty: 'medium',
      done: true,
    });
  });

  it('a done set can be changed again', () => {
    let session = pushDay();
    const key = benchKey(session);
    const id = setAt(session, 0, 0).id;
    session = saveSet(session, key, id, values(), {});
    session = saveSet(session, key, id, values({ difficulty: 'easy' }), {});
    expect(setAt(session, 0, 0)).toMatchObject({ difficulty: 'easy', done: true });
  });

  it('only done sets count in the totals', () => {
    let session = pushDay();
    const key = benchKey(session);
    session = saveSet(session, key, setAt(session, 0, 0).id, values({ weight: 100, reps: 6 }), {});
    expect(hasDoneSets(session)).toBe(true);
    expect(sessionSummary(session)).toEqual({
      setCount: 1,
      volumeKg: 600,
      exerciseCount: 1,
      prCount: 1,
    });
  });

  it('refuses a set without reps or seconds, or with impossible weight', () => {
    expect(setProblem(bench, { weight: 100, reps: null, seconds: null }, 'kg')).toBe('reps');
    expect(setProblem(plank, { weight: null, reps: null, seconds: 0 }, 'kg')).toBe('seconds');
    expect(setProblem(bench, { weight: -20, reps: 5, seconds: null }, 'kg')).toBe('weight');
    expect(setProblem(pullUp, { weight: -20, reps: 5, seconds: null }, 'kg')).toBeNull();
    expect(setProblem(bench, { weight: 3000, reps: 5, seconds: null }, 'lb')).toBe('weight');
  });
});

describe('live records', () => {
  it('a set that beats the current record gets the PR seal; one that does not, none', () => {
    let session = pushDay();
    const key = benchKey(session);
    const [first, second] = session.exercises[0]!.sets;
    // 97.5 x 6 = 117 kg estimated; the record is 120.
    session = saveSet(session, key, first!.id, values({ weight: 97.5, reps: 6 }), {
      bench: 120,
    });
    expect(setAt(session, 0, 0).pr).toBe(false);
    session = saveSet(session, key, second!.id, values({ weight: 110, reps: 5 }), {
      bench: 120,
    });
    expect(setAt(session, 0, 1).pr).toBe(true);
  });

  it('must also beat the other sets done in this session', () => {
    let session = pushDay();
    const key = benchKey(session);
    const [first, second] = session.exercises[0]!.sets;
    session = saveSet(session, key, first!.id, values(), {});
    session = saveSet(session, key, second!.id, values(), {});
    expect([setAt(session, 0, 0).pr, setAt(session, 0, 1).pr]).toEqual([true, false]);
  });

  it('sets above 12 reps never count', () => {
    let session = pushDay();
    const key = benchKey(session);
    session = saveSet(session, key, setAt(session, 0, 0).id, values({ weight: 200, reps: 13 }), {});
    expect(setAt(session, 0, 0).pr).toBe(false);
  });

  it('adds the bodyweight for pull-ups, and converts pounds', () => {
    const session = pushDay();
    // (20 + 70) x (1 + 5/30) - 70 = 35 kg added.
    expect(setOneRepMaxKg(session, pullUp, { weight: 20, reps: 5 })).toBe(35);
    expect(
      setOneRepMaxKg({ weightUnit: 'lb', bodyweightKg: null }, bench, { weight: 225, reps: 1 }),
    ).toBe(102.06);
  });
});

describe('live progress (finish screen)', () => {
  it('compares the done sets with last time, with the shared rule', () => {
    let session = pushDay();
    const key = benchKey(session);
    const [first, second] = session.exercises[0]!.sets;
    // Last time: best 97.5 x 6 = 117 kg. Today 100 x 5 = 116.67: less than 0.5% lower.
    session = saveSet(session, key, first!.id, values(), {});
    expect(liveProgress(session, session.exercises[0]!)).toEqual({
      measure: 'one_rep_max',
      current: 116.67,
      previous: 117,
      result: 'same',
    });
    // 105 x 5 = 122.5: up.
    session = saveSet(session, key, second!.id, values({ weight: 105 }), {});
    expect(liveProgress(session, session.exercises[0]!)?.result).toBe('up');
  });

  it('a first time without last time, and nothing without done sets', () => {
    let session = pushDay();
    const plankKey = session.exercises[1]!.key;
    expect(liveProgress(session, session.exercises[1]!)).toBeNull();
    session = saveSet(
      session,
      plankKey,
      setAt(session, 1, 0).id,
      values({ weight: null, reps: null, seconds: 50 }),
      {},
    );
    expect(liveProgress(session, session.exercises[1]!)).toEqual({
      measure: 'duration',
      current: 50,
      previous: null,
      result: 'first',
    });
  });
});

describe('elapsed time', () => {
  it('counts the elapsed time from the start', () => {
    expect(elapsedS(pushDay(), new Date(START.getTime() + 1500_000))).toBe(1500);
  });
});

describe('saving the workout', () => {
  it('sends only done sets, in kg, with their difficulty and no gaps in positions or numbers', () => {
    let session = pushDay({ weightUnit: 'lb' });
    const key = benchKey(session);
    const sets = session.exercises[0]!.sets;
    session = saveSet(
      session,
      key,
      sets[1]!.id,
      values({ weight: 225, reps: 5, difficulty: 'hard' }),
      {},
    );
    session = addExercises(session, [plank], {}, ids('plank'));
    const plankSet = session.exercises[2]!.sets[0]!;
    session = saveSet(
      session,
      session.exercises[2]!.key,
      plankSet.id,
      { weight: null, reps: null, seconds: 30, difficulty: null },
      {},
    );
    session = setSessionTitle(session, '  Push A ');

    // No end time: the workout's duration is not recorded.
    expect(toSavePayload(session)).toEqual({
      id: 'session',
      local_date: '2026-11-05',
      timezone: 'Europe/Madrid',
      started_at: START.toISOString(),
      ended_at: null,
      title: 'Push A',
      template_id: 'push-a',
      sets: [
        {
          id: sets[1]!.id,
          exercise_id: 'bench',
          exercise_position: 0,
          set_number: 1,
          weight_kg: 102.06,
          reps: 5,
          duration_s: null,
          difficulty: 'hard',
          is_warmup: false,
        },
        {
          id: plankSet.id,
          exercise_id: 'plank',
          exercise_position: 1,
          set_number: 1,
          weight_kg: null,
          reps: null,
          duration_s: 30,
          difficulty: null,
          is_warmup: false,
        },
      ],
    });
  });

  it('keeps and reads back the draft (only its owner, only this version)', () => {
    const session = pushDay();
    const stored = JSON.parse(JSON.stringify(session));
    expect(parseSession(stored, 'ana')).toEqual(session);
    expect(parseSession(stored, 'bruno')).toBeNull();
    expect(parseSession({ ...stored, version: 0 }, 'ana')).toBeNull();
    expect(parseSession('broken', 'ana')).toBeNull();
  });

  it('reads a draft written before the title and difficulty existed', () => {
    const stored = JSON.parse(JSON.stringify(pushDay()));
    delete stored.title;
    for (const exercise of stored.exercises) {
      delete exercise.targetReps;
      delete exercise.targetSeconds;
      for (const set of exercise.sets) {
        delete set.difficulty;
        set.rpe = 8;
        set.isWarmup = false;
      }
    }
    const session = parseSession(stored, 'ana');
    expect(session?.title).toBe('Push A');
    expect(session?.exercises[0]!.targetReps).toBeNull();
    expect(session?.exercises[0]!.sets[0]!.difficulty).toBeNull();
  });
});

describe('editing a saved workout', () => {
  const saved = (overrides: Record<string, unknown> & { id: string }) => ({
    exercise_id: 'bench',
    exercise_position: 0,
    set_number: 1,
    weight_kg: 100,
    reps: 5,
    duration_s: null,
    difficulty: null,
    deleted_at: null,
    ...overrides,
  });

  const workout = () =>
    sessionFromWorkout({
      activity: {
        id: 'w1',
        user_id: 'ana',
        template_id: null,
        title: 'Push A',
        local_date: '2026-11-01',
        timezone: 'Europe/Lisbon',
        started_at: '2026-11-01T09:00:00.000Z',
      },
      sets: [
        saved({ id: 'p1', exercise_id: 'press', exercise_position: 1, weight_kg: 50, reps: 8 }),
        saved({ id: 'b2', set_number: 2, weight_kg: 102.06, difficulty: 'hard' }),
        saved({ id: 'b1', difficulty: 'easy' }),
        saved({ id: 'gone', set_number: 3, deleted_at: '2026-11-02T10:00:00Z' }),
      ],
      exercises,
      weightUnit: 'lb',
      bodyweightKg: null,
      newId: ids('key'),
    });

  it('loads the workout as a session: exercises in order, sets done, in the athlete unit', () => {
    const session = workout();
    expect(session).toMatchObject({
      id: 'w1',
      title: 'Push A',
      localDate: '2026-11-01',
      startedAt: '2026-11-01T09:00:00.000Z',
    });
    expect(session.exercises.map((e) => [e.id, e.sets.map((s) => s.id)])).toEqual([
      ['bench', ['b1', 'b2']],
      ['press', ['p1']],
    ]);
    expect(session.exercises[0]!.sets[1]).toMatchObject({
      weight: 225,
      difficulty: 'hard',
      done: true,
      pr: false,
    });
  });

  it('builds the update: changed, new and removed sets, and the new date and title', () => {
    let session = workout();
    const bench = session.exercises[0]!;
    // Changed: b1 to 230 lb, hard.
    session = saveEditedSet(session, bench.key, 'b1', {
      weight: 230,
      reps: 5,
      seconds: null,
      difficulty: 'hard',
    });
    // New: a third bench set.
    session = setExercisePlan(
      session,
      bench.key,
      { setCount: 3, reps: 5, seconds: null },
      () => 'b3',
    );
    session = saveEditedSet(session, bench.key, 'b3', {
      weight: 200,
      reps: 8,
      seconds: null,
      difficulty: null,
    });
    // Removed: the press.
    session = removeExercise(session, session.exercises[1]!.key);
    session = setSessionWhen(setSessionTitle(session, 'Push A (heavy)'), {
      localDate: '2026-11-02',
      startedAt: '2026-11-02T18:00:00.000Z',
    });

    const payload = toUpdatePayload(session);
    expect(payload).not.toHaveProperty('ended_at');
    expect(payload).toMatchObject({
      id: 'w1',
      local_date: '2026-11-02',
      started_at: '2026-11-02T18:00:00.000Z',
      title: 'Push A (heavy)',
    });
    expect(
      payload.sets.map((s) => [s.id, s.set_number, s.weight_kg, s.reps, s.difficulty]),
    ).toEqual([
      ['b1', 1, 104.33, 5, 'hard'],
      ['b2', 2, 102.06, 5, 'hard'],
      ['b3', 3, 90.72, 8, null],
    ]);
    // The press is not sent, so Postgres marks its set deleted.
    expect(payload.sets.map((s) => s.id)).not.toContain('p1');
  });

  it('a set edited while editing gets no live seal', () => {
    const session = workout();
    const edited = saveEditedSet(session, session.exercises[0]!.key, 'b1', {
      weight: 400,
      reps: 1,
      seconds: null,
      difficulty: null,
    });
    expect(edited.exercises[0]!.sets[0]!.pr).toBe(false);
  });
});
