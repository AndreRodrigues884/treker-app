import {
  addExercises,
  DEFAULT_TARGETS,
  draftOf,
  emptyTemplate,
  hasTemplateChanges,
  moveItem,
  moveItemBy,
  removeItem,
  TEMPLATE_NAME_MAX_LENGTH,
  toSavePayload,
  updateItem,
  validateTemplate,
} from '.';

function ids() {
  let next = 0;
  return () => `id-${++next}`;
}

function pushDay() {
  const newId = ids();
  return addExercises(
    { ...emptyTemplate('t1'), name: 'Push A' },
    [
      { id: 'bench', unit: 'reps' },
      { id: 'press', unit: 'reps' },
      { id: 'plank', unit: 'seconds' },
    ],
    newId,
  );
}

describe('editing a template', () => {
  it('adds several exercises at once, at the end, with new row ids and default targets', () => {
    const draft = pushDay();
    expect(draft.items.map((i) => [i.id, i.exerciseId])).toEqual([
      ['id-1', 'bench'],
      ['id-2', 'press'],
      ['id-3', 'plank'],
    ]);
    expect(draft.items[0]).toMatchObject({
      targetSets: DEFAULT_TARGETS.sets,
      targetReps: DEFAULT_TARGETS.reps,
    });
  });

  it('changes targets and removes an exercise', () => {
    const draft = updateItem(pushDay(), 'id-1', { targetSets: 5, targetReps: 5 });
    expect(draft.items[0]).toMatchObject({ targetSets: 5, targetReps: 5 });
    expect(removeItem(draft, 'id-2').items.map((i) => i.id)).toEqual(['id-1', 'id-3']);
  });

  it('moves an item from one place to another (dragging)', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a']);
  });

  it('moves an item up or down one place (buttons), and nothing at the ends', () => {
    const draft = pushDay();
    expect(moveItemBy(draft, 'id-2', -1).items.map((i) => i.id)).toEqual(['id-2', 'id-1', 'id-3']);
    expect(moveItemBy(draft, 'id-2', 1).items.map((i) => i.id)).toEqual(['id-1', 'id-3', 'id-2']);
    expect(moveItemBy(draft, 'id-1', -1)).toBe(draft);
    expect(moveItemBy(draft, 'id-3', 1)).toBe(draft);
  });
});

describe('hasTemplateChanges', () => {
  it('is false for the same draft, and after changing a value back', () => {
    const draft = pushDay();
    expect(hasTemplateChanges(draft, draft)).toBe(false);
    expect(hasTemplateChanges(emptyTemplate('t1'), emptyTemplate('t1'))).toBe(false);
    const changedBack = updateItem(updateItem(draft, 'id-1', { targetSets: 5 }), 'id-1', {
      targetSets: 3,
    });
    expect(hasTemplateChanges(draft, changedBack)).toBe(false);
  });

  it('is true when the name, the order, the exercises or a target change', () => {
    const draft = pushDay();
    expect(hasTemplateChanges(draft, { ...draft, name: 'Push B' })).toBe(true);
    expect(hasTemplateChanges(draft, moveItemBy(draft, 'id-2', -1))).toBe(true);
    expect(hasTemplateChanges(draft, removeItem(draft, 'id-3'))).toBe(true);
    expect(hasTemplateChanges(draft, updateItem(draft, 'id-1', { targetReps: 8 }))).toBe(true);
    expect(hasTemplateChanges(draft, updateItem(draft, 'id-3', { targetSeconds: 45 }))).toBe(true);
  });

  it('ignores the target that the exercise unit does not use', () => {
    const draft = pushDay();
    // id-1 is in reps: its seconds target is not shown or saved.
    expect(hasTemplateChanges(draft, updateItem(draft, 'id-1', { targetSeconds: 90 }))).toBe(false);
  });
});

describe('validateTemplate', () => {
  it('needs a name and at least one exercise', () => {
    expect(validateTemplate(emptyTemplate('t1'))).toEqual({
      ok: false,
      error: { name: 'nameRequired', items: 'noExercises' },
    });
    expect(
      validateTemplate({ ...pushDay(), name: 'x'.repeat(TEMPLATE_NAME_MAX_LENGTH + 1) }),
    ).toEqual({ ok: false, error: { name: 'nameTooLong' } });
  });

  it('trims the name', () => {
    const result = validateTemplate({ ...pushDay(), name: '  Push A ' });
    expect(result.ok && result.value.name).toBe('Push A');
  });
});

describe('saving', () => {
  it('sends the list in order, with reps or seconds depending on the exercise', () => {
    const payload = toSavePayload(moveItemBy(pushDay(), 'id-3', -1));
    expect(payload).toEqual({
      id: 't1',
      name: 'Push A',
      notes: null,
      exercises: [
        {
          id: 'id-1',
          exercise_id: 'bench',
          target_sets: 3,
          target_reps_min: 10,
          target_reps_max: 10,
          target_seconds: null,
          notes: null,
        },
        {
          id: 'id-3',
          exercise_id: 'plank',
          target_sets: 3,
          target_reps_min: null,
          target_reps_max: null,
          target_seconds: 30,
          notes: null,
        },
        {
          id: 'id-2',
          exercise_id: 'press',
          target_sets: 3,
          target_reps_min: 10,
          target_reps_max: 10,
          target_seconds: null,
          notes: null,
        },
      ],
    });
  });

  it('turns stored rows back into a draft, in position order', () => {
    const draft = draftOf(
      { id: 't1', name: 'Push A' },
      [
        {
          id: 'r2',
          exercise_id: 'plank',
          position: 1,
          target_sets: 2,
          target_reps_min: null,
          target_reps_max: null,
          target_seconds: 45,
        },
        {
          id: 'r1',
          exercise_id: 'bench',
          position: 0,
          target_sets: null,
          target_reps_min: 6,
          target_reps_max: 8,
          target_seconds: null,
        },
      ],
      (exerciseId) => (exerciseId === 'plank' ? 'seconds' : 'reps'),
    );
    expect(draft.items).toEqual([
      {
        id: 'r1',
        exerciseId: 'bench',
        unit: 'reps',
        targetSets: 3,
        targetReps: 8,
        targetSeconds: 30,
      },
      {
        id: 'r2',
        exerciseId: 'plank',
        unit: 'seconds',
        targetSets: 2,
        targetReps: 10,
        targetSeconds: 45,
      },
    ]);
  });
});
