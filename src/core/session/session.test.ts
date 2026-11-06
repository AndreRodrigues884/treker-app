import {
  addExercises,
  adjustRest,
  DEFAULT_REST_S,
  doneCount,
  elapsedS,
  hasDoneSets,
  lastTimeAt,
  minPlanSets,
  moveExercise,
  parseSession,
  planOf,
  removeExercise,
  reorderExercises,
  restRemainingS,
  saveSet,
  sessionSummary,
  setExercisePlan,
  setOneRepMaxKg,
  setProblem,
  setSessionTitle,
  skipRest,
  startSession,
  toSavePayload,
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
    session = saveSet(session, key, sets[2]!.id, values(), START, {});
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
  it('keeps the values and how hard it felt, marks it done and starts the rest', () => {
    const session = pushDay();
    const id = setAt(session, 0, 0).id;
    const saved = saveSet(
      session,
      benchKey(session),
      id,
      values({ difficulty: 'medium' }),
      START,
      {},
    );
    expect(setAt(saved, 0, 0)).toMatchObject({
      weight: 100,
      reps: 5,
      difficulty: 'medium',
      done: true,
    });
    expect(saved.rest).toEqual({
      endsAt: new Date(START.getTime() + DEFAULT_REST_S * 1000).toISOString(),
      durationS: DEFAULT_REST_S,
    });
  });

  it('editing a done set does not start the rest again', () => {
    let session = pushDay();
    const key = benchKey(session);
    const id = setAt(session, 0, 0).id;
    session = skipRest(saveSet(session, key, id, values(), START, {}));
    session = saveSet(session, key, id, values({ difficulty: 'easy' }), START, {});
    expect(setAt(session, 0, 0).difficulty).toBe('easy');
    expect(session.rest).toBeNull();
  });

  it('only done sets count in the totals', () => {
    let session = pushDay();
    const key = benchKey(session);
    session = saveSet(
      session,
      key,
      setAt(session, 0, 0).id,
      values({ weight: 100, reps: 6 }),
      START,
      {},
    );
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
    session = saveSet(session, key, first!.id, values({ weight: 97.5, reps: 6 }), START, {
      bench: 120,
    });
    expect(setAt(session, 0, 0).pr).toBe(false);
    session = saveSet(session, key, second!.id, values({ weight: 110, reps: 5 }), START, {
      bench: 120,
    });
    expect(setAt(session, 0, 1).pr).toBe(true);
  });

  it('must also beat the other sets done in this session', () => {
    let session = pushDay();
    const key = benchKey(session);
    const [first, second] = session.exercises[0]!.sets;
    session = saveSet(session, key, first!.id, values(), START, {});
    session = saveSet(session, key, second!.id, values(), START, {});
    expect([setAt(session, 0, 0).pr, setAt(session, 0, 1).pr]).toEqual([true, false]);
  });

  it('sets above 12 reps never count', () => {
    let session = pushDay();
    const key = benchKey(session);
    session = saveSet(
      session,
      key,
      setAt(session, 0, 0).id,
      values({ weight: 200, reps: 13 }),
      START,
      {},
    );
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

describe('rest timer', () => {
  const rested = () => {
    const session = pushDay();
    return saveSet(session, benchKey(session), setAt(session, 0, 0).id, values(), START, {});
  };

  it('works from the end time, so it is right after the app was in the background', () => {
    const session = rested();
    expect(restRemainingS(session.rest, START)).toBe(90);
    expect(restRemainingS(session.rest, new Date(START.getTime() + 61_500))).toBe(29);
    expect(restRemainingS(session.rest, new Date(START.getTime() + 120_000))).toBe(0);
  });

  it('adjusts by ±15 s (never below zero) and can be skipped', () => {
    let session = adjustRest(rested(), 15, START);
    expect(restRemainingS(session.rest, START)).toBe(105);
    expect(session.restDurationS).toBe(105);
    session = adjustRest(session, -15, new Date(START.getTime() + 100_000));
    expect(restRemainingS(session.rest, new Date(START.getTime() + 100_000))).toBe(0);
    expect(skipRest(session).rest).toBeNull();
  });

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
      START,
      {},
    );
    session = addExercises(session, [plank], {}, ids('plank'));
    const plankSet = session.exercises[2]!.sets[0]!;
    session = saveSet(
      session,
      session.exercises[2]!.key,
      plankSet.id,
      { weight: null, reps: null, seconds: 30, difficulty: null },
      START,
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
