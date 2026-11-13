// The progress rule cases are shared with the pgTAP tests (supabase/tests/20_progress_cases.sql),
// so the app and the database give the same result.
import cases from '../../../supabase/tests/fixtures/progress-cases.json';

import {
  addMonths,
  averagePerWeek,
  compareProgress,
  defaultStrengthExercises,
  describeTrend,
  groupTemplateProgress,
  isRecentRecord,
  overallProgress,
  parseStrengthChoice,
  rangeStart,
  statsRangeStart,
  summarizeProgress,
  toggleStrengthExercise,
  workoutMeasures,
  type ProgressExercise,
  type ProgressSet,
  type TemplateProgressRow,
} from '.';

describe('ranges', () => {
  it('3 months, 1 year, or everything', () => {
    expect(rangeStart('3m', '2026-11-11')).toBe('2026-08-11');
    expect(rangeStart('1y', '2026-11-11')).toBe('2025-11-11');
    expect(rangeStart('all', '2026-11-11')).toBeNull();
  });

  it('keeps the day when the month has it, else the last day', () => {
    expect(addMonths('2026-05-31', -3)).toBe('2026-02-28');
    expect(addMonths('2024-05-31', -3)).toBe('2024-02-29');
    expect(addMonths('2026-01-15', -3)).toBe('2025-10-15');
  });
});

describe('describeTrend (the screen reader summary of a chart)', () => {
  it('first and last point, and the direction', () => {
    expect(
      describeTrend([
        { localDate: '2026-08-12', value: 100 },
        { localDate: '2026-09-01', value: 95 },
        { localDate: '2026-11-01', value: 116.67 },
      ]),
    ).toEqual({
      first: { localDate: '2026-08-12', value: 100 },
      last: { localDate: '2026-11-01', value: 116.67 },
      direction: 'up',
      count: 3,
    });
    expect(describeTrend([{ localDate: '2026-08-12', value: 100 }])?.direction).toBe('same');
    expect(
      describeTrend([
        { localDate: '2026-08-12', value: 100 },
        { localDate: '2026-09-12', value: 90 },
      ])?.direction,
    ).toBe('down');
  });

  it('is null without points', () => {
    expect(describeTrend([])).toBeNull();
  });
});

describe('isRecentRecord', () => {
  it('the last 7 days, today included', () => {
    expect(isRecentRecord('2026-11-11', '2026-11-11')).toBe(true);
    expect(isRecentRecord('2026-11-05', '2026-11-11')).toBe(true);
    expect(isRecentRecord('2026-11-04', '2026-11-11')).toBe(false);
  });
});

type Side = { bodyweightKg: number | null; sets: ProgressSet[] };
type Case = {
  name: string;
  exercise: ProgressExercise;
  previous: Side | null;
  current: Side;
  expected: { measure: string; current: number; previous: number | null; result: string };
};

describe('the progress rule (shared cases)', () => {
  it.each(cases as Case[])('$name', ({ exercise, previous, current, expected }) => {
    const now = workoutMeasures(exercise, current.sets, current.bodyweightKg);
    const before = previous && workoutMeasures(exercise, previous.sets, previous.bodyweightKg);
    expect(compareProgress(exercise.unit, now, before)).toEqual(expected);
  });

  it('leaves warm-ups out', () => {
    const exercise = { unit: 'reps', tracksLoad: true, addsBodyweight: false } as const;
    expect(
      workoutMeasures(
        exercise,
        [
          { weightKg: 200, reps: 5, durationS: null, isWarmup: true },
          { weightKg: 100, reps: 5, durationS: null },
        ],
        null,
      ),
    ).toEqual({ oneRepMaxKg: 116.67, durationS: null, volumeKg: 500 });
  });
});

describe('the summary of a workout', () => {
  it('counts each result; first times are not compared', () => {
    const summary = summarizeProgress(['up', 'up', 'same', 'down', 'first']);
    expect(summary).toEqual({ up: 2, same: 1, down: 1, first: 1, compared: 4 });
    expect(overallProgress(summary)).toBe('up');
  });

  it('the overall result: more down is down, a tie is the same, all new is a first', () => {
    expect(overallProgress(summarizeProgress(['down', 'down', 'up']))).toBe('down');
    expect(overallProgress(summarizeProgress(['down', 'up', 'same']))).toBe('same');
    expect(overallProgress(summarizeProgress(['first', 'first']))).toBe('first');
  });
});

describe('Statistics ranges', () => {
  // Thursday 12 Nov 2026; that week starts on Monday 9 Nov.
  const today = '2026-11-12';

  it('start on a Monday, so the first week is whole', () => {
    expect(statsRangeStart('4w', today)).toBe('2026-10-19');
    expect(statsRangeStart('3m', today)).toBe('2026-08-10');
    expect(statsRangeStart('1y', today)).toBe('2025-11-10');
    expect(statsRangeStart('all', today)).toBeNull();
  });

  it('4 weeks on a Monday is that week and the 3 before', () => {
    expect(statsRangeStart('4w', '2026-11-09')).toBe('2026-10-19');
  });
});

describe('averagePerWeek', () => {
  it('averages from the first week with a workout, to one decimal', () => {
    expect(
      averagePerWeek([
        { weekStart: '2026-10-12', count: 0 },
        { weekStart: '2026-10-19', count: 3 },
        { weekStart: '2026-10-26', count: 0 },
        { weekStart: '2026-11-02', count: 2 },
      ]),
    ).toBe(1.7);
  });

  it('is null without workouts', () => {
    expect(averagePerWeek([{ weekStart: '2026-11-02', count: 0 }])).toBeNull();
    expect(averagePerWeek([])).toBeNull();
  });
});

describe('the strength chart exercises', () => {
  const usage = (
    exerciseId: string,
    setCount: number,
    lastLocalDate: string,
    hasOneRepMax = true,
  ) => ({
    exerciseId,
    setCount,
    lastLocalDate,
    hasOneRepMax,
  });

  it('by default, the 5 done most (most sets, then the latest), without exercises with no 1RM', () => {
    expect(
      defaultStrengthExercises([
        usage('curl', 10, '2026-11-01'),
        usage('bench', 40, '2026-11-01'),
        usage('plank', 90, '2026-11-01', false),
        usage('squat', 30, '2026-10-01'),
        usage('row', 30, '2026-11-05'),
        usage('press', 20, '2026-11-01'),
        usage('deadlift', 25, '2026-11-01'),
      ]),
    ).toEqual(['bench', 'row', 'squat', 'deadlift', 'press']);
  });

  it('ticking adds at the end, unticking removes, and a sixth is refused', () => {
    expect(toggleStrengthExercise(['a'], 'b')).toEqual({ selected: ['a', 'b'], limited: false });
    expect(toggleStrengthExercise(['a', 'b'], 'a')).toEqual({ selected: ['b'], limited: false });
    expect(toggleStrengthExercise(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual({
      selected: ['a', 'b', 'c', 'd', 'e'],
      limited: true,
    });
  });

  it('the choice read from the phone is checked', () => {
    expect(parseStrengthChoice(['a', 'a', 'b'])).toEqual(['a', 'b']);
    expect(parseStrengthChoice(['a', 'b', 'c', 'd', 'e', 'f'])).toHaveLength(5);
    expect(parseStrengthChoice('a')).toBeNull();
    expect(parseStrengthChoice([1])).toBeNull();
  });
});

describe('groupTemplateProgress', () => {
  const row = (
    activityId: string,
    localDate: string,
    exerciseId: string,
    position: number,
    measure: TemplateProgressRow['measure'],
    value: number,
    result: TemplateProgressRow['result'],
    sessionResult: TemplateProgressRow['sessionResult'],
  ): TemplateProgressRow => ({
    activityId,
    localDate,
    exerciseId,
    position,
    measure,
    value,
    result,
    sessionResult,
  });

  it('one entry per workout and one series per exercise, in the latest order', () => {
    const grouped = groupTemplateProgress([
      row('w1', '2026-10-01', 'bench', 0, 'one_rep_max', 100, 'first', 'first'),
      row('w1', '2026-10-01', 'row', 1, 'volume', 900, 'first', 'first'),
      row('w2', '2026-10-08', 'row', 0, 'one_rep_max', 80, 'first', 'up'),
      row('w2', '2026-10-08', 'bench', 1, 'one_rep_max', 105, 'up', 'up'),
    ]);
    expect(grouped.sessions).toEqual([
      { activityId: 'w1', localDate: '2026-10-01', result: 'first' },
      { activityId: 'w2', localDate: '2026-10-08', result: 'up' },
    ]);
    expect(grouped.exercises.map((series) => series.exerciseId)).toEqual(['row', 'bench']);
    // Row was measured by volume, then by 1RM: only the 1RM bar is shown.
    expect(grouped.exercises[0]).toEqual({
      exerciseId: 'row',
      measure: 'one_rep_max',
      points: [{ activityId: 'w2', localDate: '2026-10-08', value: 80, result: 'first' }],
    });
    expect(grouped.exercises[1]?.points.map((point) => point.result)).toEqual(['first', 'up']);
  });
});
