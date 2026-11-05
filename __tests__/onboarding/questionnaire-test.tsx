import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';
import { defaultAnswers, type OnboardingDraft } from '@/core/onboarding';
import { storageKeys } from '@/lib/storage';

import { localOutbox, localProfile } from '../../test-utils/local-store';
import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  profileRow,
  resetSupabaseMock,
  supabaseMock,
  TEST_USER_ID,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const q = en.onboarding;
const draftKey = storageKeys.onboardingDraft(TEST_USER_ID);

async function openQuestionnaire() {
  resetSupabaseMock({ signedIn: true, profile: profileRow() });
  return renderApp('/');
}

function expectQuestion(title: string) {
  expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
}

async function next() {
  await fireEvent.press(screen.getByRole('button', { name: en.common.next }));
}

async function choose(label: string) {
  await fireEvent.press(screen.getByLabelText(label, { exact: false }));
}

async function answerName(name = 'Ana') {
  await fireEvent.changeText(screen.getByLabelText(q.name.label), name);
  await next();
}

beforeEach(async () => {
  await resetStorage();
});

describe('which questions appear', () => {
  it('gym only: asks the gym focus and skips the swim questions', async () => {
    await openQuestionnaire();
    expect(screen.getByText('Step 1 of 5')).toBeOnTheScreen();

    await answerName();
    await choose(q.sports.gym);
    await next();

    expectQuestion(q.gymFocus.title);
    await choose(q.gymFocus.strength);
    await next();

    expectQuestion(q.weeklyTarget.title);
    expect(screen.getByText('Step 4 of 6')).toBeOnTheScreen();
  });

  it('swim only: asks the swim style and pool, and skips the gym focus', async () => {
    await openQuestionnaire();
    await answerName();
    await choose(q.sports.swim);
    await next();

    expectQuestion(q.swimStyle.title);
    await choose(q.swimStyle.competitive);
    await next();

    expectQuestion(q.poolLength.title);
    await next();

    expectQuestion(q.weeklyTarget.title);
    expect(screen.getByText('Step 5 of 7')).toBeOnTheScreen();
  });

  it('both sports: asks every question, and Back returns to the previous one', async () => {
    await openQuestionnaire();
    await answerName();
    await choose(q.sports.gym);
    await choose(q.sports.swim);
    await next();

    expectQuestion(q.gymFocus.title);
    expect(screen.getByText('Step 3 of 8')).toBeOnTheScreen();
    await choose(q.gymFocus.maintenance);
    await next();
    expectQuestion(q.swimStyle.title);

    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));
    expectQuestion(q.gymFocus.title);
    expect(
      screen.getByRole('radio', {
        name: `${q.gymFocus.maintenance}. ${q.gymFocus.maintenanceHint}`,
      }),
    ).toBeChecked();
  });

  it('needs an answer before moving on', async () => {
    await openQuestionnaire();
    await answerName();

    await next();

    expect(screen.getByRole('alert')).toHaveTextContent(q.errors.sportsRequired);
    expectQuestion(q.sports.title);
  });
});

describe('resuming', () => {
  // Together with the next test: answers are saved on the phone as they are given, and a saved
  // questionnaire reopens on its question.
  it('saves every answer and the current question on the phone', async () => {
    await openQuestionnaire();
    await answerName('Bea');
    await choose(q.sports.swim);

    const saved = JSON.parse((await AsyncStorage.getItem(draftKey)) ?? 'null') as OnboardingDraft;
    expect(saved.step).toBe('sports');
    expect(saved.answers).toMatchObject({ displayName: 'Bea', sports: ['swim'] });
  });

  it('opens a saved questionnaire on the saved question', async () => {
    const draft: OnboardingDraft = {
      step: 'weeklyTarget',
      answers: {
        ...defaultAnswers('PT'),
        displayName: 'Ana',
        sports: ['gym'],
        gymFocus: 'strength',
        weeklyTarget: 5,
      },
    };
    await AsyncStorage.setItem(draftKey, JSON.stringify(draft));

    await openQuestionnaire();

    expectQuestion(q.weeklyTarget.title);
    expect(screen.getByText('5 a week')).toBeOnTheScreen();
  });
});

describe('final screen', () => {
  const ready: OnboardingDraft = {
    step: 'summary',
    answers: {
      ...defaultAnswers('PT'),
      displayName: 'Ana',
      sports: ['gym', 'swim'],
      gymFocus: 'hypertrophy',
      swimStyle: 'competitive',
      poolLength: '50m',
      weeklyTarget: 5,
      bodyweight: '72,5',
    },
  };

  beforeEach(async () => {
    await AsyncStorage.setItem(draftKey, JSON.stringify(ready));
  });

  it('summarizes the answers and says they can be changed later', async () => {
    await openQuestionnaire();

    expectQuestion("You're all set, Ana");
    expect(screen.getByText('Gym, Swimming')).toBeOnTheScreen();
    expect(screen.getByText(q.gymFocus.hypertrophy)).toBeOnTheScreen();
    expect(screen.getByText(q.swimStyle.competitive)).toBeOnTheScreen();
    expect(screen.getByText('50 m · Long course')).toBeOnTheScreen();
    expect(screen.getByText('5 a week')).toBeOnTheScreen();
    expect(screen.getByText('72.5 kg')).toBeOnTheScreen();
    expect(screen.getByText(q.summary.hint)).toBeOnTheScreen();
  });

  it('saves everything at once, then enters the app', async () => {
    await openQuestionnaire();

    await fireEvent.press(screen.getByRole('button', { name: q.summary.enter }));

    expect(screen).toHavePathname('/');
    expect(localProfile()).toMatchObject({
      display_name: 'Ana',
      sports: ['gym', 'swim'],
      gym_focus: 'hypertrophy',
      swim_style: 'competitive',
      default_pool_length: '50m',
      weekly_target: 5,
      weight_unit: 'kg',
      pool_unit: 'm',
      bodyweight_kg: 72.5,
    });
    expect(localProfile()?.onboarded_at).not.toBeNull();
    // One outbox entry with every answer and onboarded_at, for the server (step 6b).
    const entries = localOutbox();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ table_name: 'profiles', operation: 'upsert' });
    expect(entries[0].payload).toMatchObject({ weekly_target: 5, gym_focus: 'hypertrophy' });
    // Nothing is written to the server directly.
    expect(supabaseMock.updateProfile).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(draftKey)).toBeNull();
  });

  it('works without a connection: the answers are saved on the phone', async () => {
    await openQuestionnaire();
    // From now on every server call fails, as when the phone is offline.
    supabaseMock.from.mockImplementation(() => {
      throw new TypeError('Network request failed');
    });

    await fireEvent.press(screen.getByRole('button', { name: q.summary.enter }));

    expect(screen).toHavePathname('/');
    expect(localProfile()?.weekly_target).toBe(5);
    expect(localOutbox()).toHaveLength(1);
  });
});
