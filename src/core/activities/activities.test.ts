import { durationSeconds, groupSetsByExercise, gymTotals, nextCursor, swimTotals } from '.';

describe('nextCursor', () => {
  const row = (localDate: string, id: string) => ({ localDate, id });

  it('is the (local_date, id) of the last row of a full page', () => {
    expect(nextCursor([row('2026-11-05', 'b'), row('2026-11-04', 'a')], 2)).toEqual({
      localDate: '2026-11-04',
      id: 'a',
    });
  });

  it('is undefined after a short or empty page: there is nothing more', () => {
    expect(nextCursor([row('2026-11-05', 'b')], 2)).toBeUndefined();
    expect(nextCursor([], 2)).toBeUndefined();
  });
});

describe('durationSeconds', () => {
  it('needs a start and an end', () => {
    expect(durationSeconds('2026-10-01T10:00:00Z', '2026-10-01T11:15:00Z')).toBe(4500);
    expect(durationSeconds('2026-10-01T10:00:00Z', null)).toBeNull();
    expect(durationSeconds(null, '2026-10-01T11:15:00Z')).toBeNull();
  });
});

describe('totals (same rules and example as supabase/tests/17_activity_summaries.sql)', () => {
  const set = (weight_kg: number | null, reps: number | null, extra = {}) => ({
    weight_kg,
    reps,
    is_warmup: false,
    deleted_at: null as string | null,
    ...extra,
  });

  it('gym: work sets only, assistance counts as zero volume', () => {
    expect(
      gymTotals([
        set(60, 5, { is_warmup: true }),
        set(100, 5),
        set(100, 5),
        set(200, 5, { deleted_at: '2026-10-01T12:00:00Z' }),
        set(-20, 8),
      ]),
    ).toEqual({ setCount: 3, volumeKg: 1000 });
  });

  it('gym: sets without weight or reps (plank, bodyweight) count as sets with no volume', () => {
    expect(gymTotals([set(null, 20), set(null, null)])).toEqual({ setCount: 2, volumeKg: 0 });
  });

  it('swim: times logged and metres, with yard pools converted', () => {
    expect(
      swimTotals([
        { distance: 50, pool_length: '25m', deleted_at: null },
        { distance: 100, pool_length: '25yd', deleted_at: null },
        { distance: 400, pool_length: '50m', deleted_at: '2026-10-02T12:00:00Z' },
      ]),
    ).toEqual({ setCount: 2, distanceM: 141.44 });
  });
});

describe('groupSetsByExercise', () => {
  it('groups by exercise in the order done, each in set order', () => {
    const groups = groupSetsByExercise([
      { id: 's3', exercise_id: 'press', exercise_position: 1, set_number: 1 },
      { id: 's2', exercise_id: 'bench', exercise_position: 0, set_number: 2 },
      { id: 's1', exercise_id: 'bench', exercise_position: 0, set_number: 1 },
    ]);
    expect(groups.map((g) => [g.exerciseId, g.sets.map((s) => s.id)])).toEqual([
      ['bench', ['s1', 's2']],
      ['press', ['s3']],
    ]);
  });
});
