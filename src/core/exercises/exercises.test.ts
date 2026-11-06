import {
  canAddBodyweight,
  EMPTY_CUSTOM_EXERCISE,
  EXERCISE_NAME_MAX_LENGTH,
  NO_FILTERS,
  normalizeSearch,
  searchExercises,
  validateCustomExercise,
  type LibraryExercise,
} from '.';

function exercise(overrides: Partial<LibraryExercise> & { id: string }): LibraryExercise {
  return {
    owner_id: null,
    name_en: overrides.id,
    name_pt: overrides.id,
    muscle_group: 'chest',
    equipment: 'barbell',
    unit: 'reps',
    tracks_load: true,
    adds_bodyweight: false,
    archived: false,
    deleted_at: null,
    ...overrides,
  };
}

const bench = exercise({
  id: 'bench',
  name_en: 'Barbell Bench Press',
  name_pt: 'Supino plano com barra',
});
const incline = exercise({
  id: 'incline',
  name_en: 'Incline Dumbbell Bench Press',
  name_pt: 'Supino inclinado com halteres',
  equipment: 'dumbbell',
});
const pullUp = exercise({
  id: 'pull-up',
  name_en: 'Pull-up',
  name_pt: 'Elevações na barra',
  muscle_group: 'back',
  equipment: 'bodyweight',
  adds_bodyweight: true,
});
const mine = exercise({
  id: 'mine',
  owner_id: 'me',
  name_en: 'Zercher squat',
  name_pt: 'Zercher squat',
  muscle_group: 'quads',
});
const archived = exercise({ id: 'old', owner_id: 'me', name_en: 'Old', archived: true });
const all = [pullUp, bench, archived, incline, mine];

describe('normalizeSearch', () => {
  it('ignores accents, case and extra spaces', () => {
    expect(normalizeSearch('  Elevações   NA barra ')).toBe('elevacoes na barra');
  });
});

describe('searchExercises', () => {
  const ids = (list: LibraryExercise[]) => list.map((e) => e.id);

  it('puts the athlete own exercises first, then sorts by name in the app language', () => {
    expect(ids(searchExercises(all, NO_FILTERS, 'en'))).toEqual([
      'mine',
      'bench',
      'incline',
      'pull-up',
    ]);
    // "Supino inclinado" comes before "Supino plano".
    expect(ids(searchExercises(all, NO_FILTERS, 'pt'))).toEqual([
      'mine',
      'pull-up',
      'incline',
      'bench',
    ]);
  });

  it('hides archived and deleted exercises', () => {
    const deleted = exercise({ id: 'gone', deleted_at: '2026-11-01T00:00:00Z' });
    expect(ids(searchExercises([...all, deleted], NO_FILTERS, 'en'))).not.toContain('old');
    expect(ids(searchExercises([...all, deleted], NO_FILTERS, 'en'))).not.toContain('gone');
  });

  it('finds names without accents or case: "supino" finds "Supino", "elevacoes" finds "Elevações"', () => {
    const search = (query: string) => ids(searchExercises(all, { ...NO_FILTERS, query }, 'pt'));
    expect(search('supino')).toEqual(['incline', 'bench']);
    expect(search('SUPINO inclinado')).toEqual(['incline']);
    expect(search('elevacoes')).toEqual(['pull-up']);
  });

  it('matches every word in any order, in the app language only', () => {
    expect(ids(searchExercises(all, { ...NO_FILTERS, query: 'press bench' }, 'en'))).toEqual([
      'bench',
      'incline',
    ]);
    expect(ids(searchExercises(all, { ...NO_FILTERS, query: 'supino' }, 'en'))).toEqual([]);
  });

  it('filters by muscle group and equipment, together with the search', () => {
    expect(ids(searchExercises(all, { ...NO_FILTERS, muscleGroup: 'back' }, 'en'))).toEqual([
      'pull-up',
    ]);
    expect(ids(searchExercises(all, { ...NO_FILTERS, equipment: 'dumbbell' }, 'en'))).toEqual([
      'incline',
    ]);
    expect(
      ids(
        searchExercises(all, { query: 'bench', muscleGroup: 'chest', equipment: 'barbell' }, 'en'),
      ),
    ).toEqual(['bench']);
  });
});

describe('custom exercises', () => {
  const valid = {
    ...EMPTY_CUSTOM_EXERCISE,
    name: '  Landmine press ',
    muscleGroup: 'shoulders' as const,
    equipment: 'barbell' as const,
  };

  it('accepts a valid exercise and trims the name', () => {
    expect(validateCustomExercise(valid)).toEqual({
      ok: true,
      value: {
        name: 'Landmine press',
        muscleGroup: 'shoulders',
        equipment: 'barbell',
        unit: 'reps',
        tracksLoad: true,
        addsBodyweight: false,
      },
    });
  });

  it('requires a name, a muscle group and equipment', () => {
    expect(validateCustomExercise({ ...EMPTY_CUSTOM_EXERCISE, name: '   ' })).toEqual({
      ok: false,
      error: { name: 'nameRequired', muscleGroup: 'required', equipment: 'required' },
    });
  });

  it('refuses names longer than the database allows', () => {
    const name = 'x'.repeat(EXERCISE_NAME_MAX_LENGTH + 1);
    expect(validateCustomExercise({ ...valid, name })).toEqual({
      ok: false,
      error: { name: 'nameTooLong' },
    });
  });

  it('adds bodyweight only for bodyweight exercises in reps that take load', () => {
    expect(canAddBodyweight({ equipment: 'bodyweight', unit: 'reps', tracksLoad: true })).toBe(
      true,
    );
    expect(canAddBodyweight({ equipment: 'bodyweight', unit: 'seconds', tracksLoad: true })).toBe(
      false,
    );
    expect(canAddBodyweight({ equipment: 'bodyweight', unit: 'reps', tracksLoad: false })).toBe(
      false,
    );
    expect(canAddBodyweight({ equipment: 'barbell', unit: 'reps', tracksLoad: true })).toBe(false);
  });

  it('saves "adds bodyweight" as false when it does not apply', () => {
    const result = validateCustomExercise({ ...valid, addsBodyweight: true });
    expect(result.ok && result.value.addsBodyweight).toBe(false);

    const dip = validateCustomExercise({
      ...valid,
      equipment: 'bodyweight',
      addsBodyweight: true,
    });
    expect(dip.ok && dip.value.addsBodyweight).toBe(true);
  });
});
