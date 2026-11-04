import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';
import { pt } from '@/core/i18n/pt';
import { storageKeys } from '@/lib/storage';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  currentProfile,
  onboardedProfile,
  resetSupabaseMock,
  supabaseMock,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const q = en.onboarding;

async function openProfile() {
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
  await resetStorage();
  await renderApp('/profile');
}

async function save() {
  await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
}

describe('profile', () => {
  it('shows the saved answers, the support links and the app version', async () => {
    await openProfile();

    expect(screen.getByRole('button', { name: `${en.profile.name}, Ana` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `${q.summary.sports}, Gym` })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `${q.summary.gymFocus}, ${q.gymFocus.strength}` }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: en.profile.privacy })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: en.profile.contact })).toBeOnTheScreen();
    // At the bottom of the profile and of the side menu.
    expect(screen.getAllByText(/^Version /)).toHaveLength(2);
  });
});

describe('editing answers', () => {
  it('validates with the onboarding rules, then saves', async () => {
    await openProfile();
    await fireEvent.press(screen.getByRole('button', { name: `${en.profile.name}, Ana` }));
    expect(screen).toHavePathname('/settings/edit');

    await fireEvent.changeText(screen.getByLabelText(q.name.label), '   ');
    await save();

    expect(screen.getByRole('alert')).toHaveTextContent(q.errors.nameRequired);
    expect(supabaseMock.updateProfile).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(q.name.label), 'Ana Silva');
    await save();

    expect(supabaseMock.updateProfile).toHaveBeenCalledTimes(1);
    expect(currentProfile()?.display_name).toBe('Ana Silva');
    expect(screen).toHavePathname('/profile');
    expect(screen.getByRole('button', { name: `${en.profile.name}, Ana Silva` })).toBeOnTheScreen();
  });

  it('adding swimming asks its questions before saving, so the profile stays consistent', async () => {
    await openProfile();
    await fireEvent.press(screen.getByRole('button', { name: `${q.summary.sports}, Gym` }));

    await fireEvent.press(screen.getByRole('checkbox', { name: q.sports.swim }));
    await save();

    expect(screen.getByText(en.profile.editMore)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: q.swimStyle.title })).toBeOnTheScreen();
    expect(supabaseMock.updateProfile).not.toHaveBeenCalled();

    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(q.errors.swimStyleRequired);

    await fireEvent.press(screen.getByLabelText(q.swimStyle.competitive, { exact: false }));
    await save();

    expect(screen.getByRole('header', { name: q.poolLength.title })).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(q.poolLength.longCourseHint, { exact: false }));
    await save();

    expect(supabaseMock.updateProfile).toHaveBeenCalledTimes(1);
    expect(currentProfile()).toMatchObject({
      sports: ['gym', 'swim'],
      gym_focus: 'strength',
      swim_style: 'competitive',
      default_pool_length: '50m',
    });
    expect(screen).toHavePathname('/profile');
  });

  it('removing a sport clears its answers', async () => {
    resetSupabaseMock({
      signedIn: true,
      profile: onboardedProfile({
        sports: ['gym', 'swim'],
        swim_style: 'fitness',
        default_pool_length: '25m',
      }),
    });
    await resetStorage();
    await renderApp('/settings/edit?step=sports');

    await fireEvent.press(screen.getByRole('checkbox', { name: q.sports.gym }));
    await save();

    expect(currentProfile()).toMatchObject({ sports: ['swim'], gym_focus: null });
  });
});

describe('language', () => {
  it('switches the app to Portuguese and remembers it', async () => {
    await openProfile();
    await fireEvent.press(
      screen.getByRole('button', { name: `${en.language.title}, ${en.language.auto}` }),
    );
    expect(screen).toHavePathname('/settings/language');

    await fireEvent.press(screen.getByRole('radio', { name: 'Português' }));

    expect(screen.getByRole('header', { name: pt.language.title })).toBeOnTheScreen();
    expect(await AsyncStorage.getItem(storageKeys.language)).toBe('"pt"');
  });
});
