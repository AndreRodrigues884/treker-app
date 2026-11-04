import {
  buildProfileUpdate,
  classifySaveError,
  defaultAnswers,
  nextStep,
  previousStep,
  resumeDraft,
  stepProgress,
  toggleSport,
  validateStep,
  visibleSteps,
  type OnboardingAnswers,
} from './index';

const device = { language: 'pt' as const, timezone: 'Europe/Lisbon' };

function answers(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return { ...defaultAnswers('PT'), displayName: 'Ana', ...overrides };
}

const gymOnly = answers({ sports: ['gym'], gymFocus: 'strength' });
const swimOnly = answers({ sports: ['swim'], swimStyle: 'competitive', poolLength: '50m' });
const both = answers({
  sports: ['gym', 'swim'],
  gymFocus: 'hypertrophy',
  swimStyle: 'fitness',
});

describe('visibleSteps', () => {
  it('gym only skips the swim questions', () => {
    expect(visibleSteps(gymOnly)).toEqual([
      'name',
      'sports',
      'gymFocus',
      'weeklyTarget',
      'units',
      'summary',
    ]);
  });

  it('swim only skips the gym question', () => {
    expect(visibleSteps(swimOnly)).toEqual([
      'name',
      'sports',
      'swimStyle',
      'poolLength',
      'weeklyTarget',
      'units',
      'summary',
    ]);
  });

  it('both sports ask every question', () => {
    expect(visibleSteps(both)).toEqual([
      'name',
      'sports',
      'gymFocus',
      'swimStyle',
      'poolLength',
      'weeklyTarget',
      'units',
      'summary',
    ]);
  });
});

describe('nextStep and previousStep', () => {
  it('jump over the questions of a sport not chosen', () => {
    expect(nextStep('sports', swimOnly)).toBe('swimStyle');
    expect(nextStep('gymFocus', gymOnly)).toBe('weeklyTarget');
    expect(previousStep('weeklyTarget', gymOnly)).toBe('gymFocus');
    expect(previousStep('weeklyTarget', swimOnly)).toBe('poolLength');
  });

  it('stop at the ends', () => {
    expect(previousStep('name', both)).toBeNull();
    expect(nextStep('summary', both)).toBeNull();
  });
});

describe('stepProgress', () => {
  it('counts only the visible steps', () => {
    expect(stepProgress('weeklyTarget', gymOnly)).toEqual({ number: 4, total: 6 });
    expect(stepProgress('weeklyTarget', both)).toEqual({ number: 6, total: 8 });
  });
});

describe('validateStep', () => {
  it.each([
    ['name', answers({ displayName: '  ' }), 'nameRequired'],
    ['sports', answers({ sports: [] }), 'sportsRequired'],
    ['gymFocus', answers({ sports: ['gym'] }), 'gymFocusRequired'],
    ['swimStyle', answers({ sports: ['swim'] }), 'swimStyleRequired'],
    ['weeklyTarget', answers({ weeklyTarget: 0 }), 'weeklyTargetInvalid'],
    ['weeklyTarget', answers({ weeklyTarget: 15 }), 'weeklyTargetInvalid'],
    ['units', answers({ bodyweight: 'abc' }), 'bodyweightInvalid'],
    ['units', answers({ bodyweight: '5' }), 'bodyweightInvalid'],
  ] as const)('%s rejects a missing or invalid answer', (step, input, error) => {
    expect(validateStep(step, input)).toBe(error);
  });

  it('accepts a skipped bodyweight and a comma decimal', () => {
    expect(validateStep('units', answers({ bodyweight: '' }))).toBeNull();
    expect(validateStep('units', answers({ bodyweight: '72,5' }))).toBeNull();
  });
});

describe('defaultAnswers', () => {
  it('uses kg and 25 m outside the United States', () => {
    expect(defaultAnswers('PT')).toMatchObject({ weightUnit: 'kg', poolLength: '25m' });
    expect(defaultAnswers(null)).toMatchObject({ weightUnit: 'kg', poolLength: '25m' });
  });

  it('uses lb and 25 yd in the United States', () => {
    expect(defaultAnswers('US')).toMatchObject({ weightUnit: 'lb', poolLength: '25yd' });
  });
});

describe('toggleSport', () => {
  it('adds and removes, keeping gym before swim', () => {
    const swim = toggleSport(answers(), 'swim');
    expect(swim.sports).toEqual(['swim']);
    expect(toggleSport(swim, 'gym').sports).toEqual(['gym', 'swim']);
    expect(toggleSport(both, 'gym').sports).toEqual(['swim']);
  });
});

describe('resumeDraft', () => {
  const defaults = defaultAnswers('PT');

  it('continues where the user stopped', () => {
    expect(resumeDraft({ step: 'weeklyTarget', answers: both }, defaults)).toEqual({
      step: 'weeklyTarget',
      answers: both,
    });
  });

  it('starts over when nothing (or something unreadable) was saved', () => {
    expect(resumeDraft(null, defaults)).toEqual({ step: 'name', answers: defaults });
    expect(resumeDraft({ step: 'nope', answers: {} }, defaults)).toEqual({
      step: 'name',
      answers: defaults,
    });
  });

  it('goes back to the first step still needing an answer', () => {
    const noFocus = answers({ sports: ['gym'], gymFocus: null });
    expect(resumeDraft({ step: 'units', answers: noFocus }, defaults).step).toBe('gymFocus');
  });

  it('moves off a step that no longer applies', () => {
    expect(resumeDraft({ step: 'swimStyle', answers: gymOnly }, defaults).step).toBe('summary');
  });
});

describe('buildProfileUpdate', () => {
  it('saves only the answers of the chosen sports', () => {
    const result = buildProfileUpdate({ ...gymOnly, swimStyle: 'fitness' }, device);
    expect(result).toEqual({
      ok: true,
      value: {
        display_name: 'Ana',
        sports: ['gym'],
        gym_focus: 'strength',
        swim_style: null,
        default_pool_length: null,
        weekly_target: 3,
        weight_unit: 'kg',
        pool_unit: 'm',
        bodyweight_kg: null,
        locale: 'pt',
        timezone: 'Europe/Lisbon',
      },
    });
  });

  it('saves the swim answers, the pool unit and the bodyweight in kg', () => {
    const result = buildProfileUpdate(
      { ...swimOnly, poolLength: '25yd', weightUnit: 'lb', bodyweight: '160' },
      device,
    );
    expect(result.ok && result.value).toMatchObject({
      sports: ['swim'],
      gym_focus: null,
      swim_style: 'competitive',
      default_pool_length: '25yd',
      pool_unit: 'yd',
      bodyweight_kg: 72.57,
    });
  });

  it('points to the first step with a problem', () => {
    expect(buildProfileUpdate(answers({ sports: ['gym', 'swim'] }), device)).toEqual({
      ok: false,
      error: { step: 'gymFocus', error: 'gymFocusRequired' },
    });
  });
});

describe('classifySaveError', () => {
  it('detects a missing connection', () => {
    expect(classifySaveError({ message: 'TypeError: Network request failed' })).toBe('network');
  });

  it('treats anything else as generic', () => {
    expect(classifySaveError({ message: 'new row violates check constraint' })).toBe('generic');
  });
});
