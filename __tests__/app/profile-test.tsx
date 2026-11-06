import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';
import { pt } from '@/core/i18n/pt';
import { storageKeys } from '@/lib/storage';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  goOffline,
  onboardedProfile,
  resetSupabaseMock,
  serverProfileState,
  serverRows,
  supabaseMock,
  TEST_USER_ID,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const q = en.onboarding;

async function openProfile() {
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
  await resetStorage();
  await renderApp('/profile');
}

// Profile -> Edit profile.
async function openEditProfile() {
  await openProfile();
  await fireEvent.press(screen.getByRole('button', { name: en.profile.editProfile }));
  await screen.findByRole('header', { name: en.profile.editProfile });
}

async function save() {
  await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
}

describe('profile', () => {
  it('shows the picture (initials), name and sports, without the questionnaire answers', async () => {
    resetSupabaseMock({
      signedIn: true,
      profile: onboardedProfile({
        display_name: 'Ana Silva',
        sports: ['gym', 'swim'],
        swim_style: 'fitness',
        default_pool_length: '25m',
      }),
    });
    await resetStorage();
    await renderApp('/profile');

    // Decorative (the name is next to it), so hidden from screen readers.
    expect(screen.getByText('AS', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Ana Silva' })).toBeOnTheScreen();
    expect(screen.getByText(q.sports.gym)).toBeOnTheScreen();
    expect(screen.getByText(q.sports.swim)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.profile.editProfile })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.profile.settings })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.profile.signOut })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.profile.deleteAccount })).toBeOnTheScreen();

    // The answers, units, language and links are elsewhere.
    expect(screen.queryByText(q.gymFocus.strength)).not.toBeOnTheScreen();
    expect(screen.queryByText(q.summary.weeklyTarget)).not.toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: en.profile.privacy })).not.toBeOnTheScreen();
    expect(screen.queryByText(en.language.title)).not.toBeOnTheScreen();
  });

  it('lists the latest workouts, newest first, without deleted ones or other users', async () => {
    resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
    const activity = (id: string, overrides: Record<string, unknown>) =>
      serverRows('activities').push({
        id,
        user_id: TEST_USER_ID,
        type: 'gym',
        title: null,
        local_date: '2026-11-02',
        started_at: '2026-11-02T10:00:00Z',
        deleted_at: null,
        ...overrides,
      });
    activity('old', { local_date: '2026-11-02', title: 'Push A' });
    activity('new', { local_date: '2026-11-05', type: 'swim' });
    activity('gone', { local_date: '2026-11-04', deleted_at: '2026-11-04T12:00:00Z' });
    activity('theirs', {
      local_date: '2026-11-04',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000000',
    });
    await resetStorage();
    await renderApp('/profile');

    const swim = await screen.findByRole('button', { name: /^Open Swimming, / });
    const push = screen.getByRole('button', { name: /^Open Push A, / });
    const rows = screen.getAllByRole('button', { name: /^Open [^,]+, / });
    expect(rows).toHaveLength(2);
    expect(rows.indexOf(swim)).toBeLessThan(rows.indexOf(push));
    expect(screen.queryByText(en.profile.recentEmptyTitle)).not.toBeOnTheScreen();
  });

  it('shows an empty list before the first workout', async () => {
    await openProfile();
    expect(await screen.findByText(en.profile.recentEmptyTitle)).toBeOnTheScreen();
  });

  it('Edit profile lists the questionnaire answers', async () => {
    await openEditProfile();

    expect(screen.getByRole('button', { name: `${en.profile.name}, Ana` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `${q.summary.sports}, Gym` })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `${q.summary.gymFocus}, ${q.gymFocus.strength}` }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: `${q.summary.weeklyTarget}, ${q.weeklyTarget.value.replace('{count}', '3')}`,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `${q.summary.bodyweight}, ${q.summary.notSet}` }),
    ).toBeOnTheScreen();
  });

  it('Settings has units, language, the support links and the app version', async () => {
    await openProfile();
    await fireEvent.press(screen.getByRole('button', { name: en.profile.settings }));
    expect(screen).toHavePathname('/settings');

    expect(screen.getByRole('button', { name: `${en.profile.units}, kg` })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `${en.language.title}, ${en.language.auto}` }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: en.profile.privacy })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: en.profile.contact })).toBeOnTheScreen();
    expect(screen.getAllByText(/^Version /).length).toBeGreaterThan(0);
  });
});

describe('editing answers', () => {
  it('validates with the onboarding rules, then saves', async () => {
    await openEditProfile();
    await fireEvent.press(screen.getByRole('button', { name: `${en.profile.name}, Ana` }));
    expect(screen).toHavePathname('/settings/edit');

    await fireEvent.changeText(screen.getByLabelText(q.name.label), '   ');
    await save();

    expect(screen.getByRole('alert')).toHaveTextContent(q.errors.nameRequired);
    expect(supabaseMock.updateProfile).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(q.name.label), 'Ana Silva');
    await save();

    expect(serverProfileState()?.display_name).toBe('Ana Silva');
    expect(supabaseMock.updateProfile).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/settings/profile');
    expect(screen.getByRole('button', { name: `${en.profile.name}, Ana Silva` })).toBeOnTheScreen();
  });

  it('adding swimming asks its questions before saving, so the profile stays consistent', async () => {
    await openEditProfile();
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
    expect(serverProfileState()).toMatchObject({
      sports: ['gym', 'swim'],
      gym_focus: 'strength',
      swim_style: 'competitive',
      default_pool_length: '50m',
    });
    expect(screen).toHavePathname('/settings/profile');
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

    expect(serverProfileState()).toMatchObject({ sports: ['swim'], gym_focus: null });
  });

  it('without a connection: shows the error with "Try again" and keeps what was typed', async () => {
    await openEditProfile();
    await fireEvent.press(screen.getByRole('button', { name: `${en.profile.name}, Ana` }));
    await fireEvent.changeText(screen.getByLabelText(q.name.label), 'Ana Silva');
    goOffline();

    await save();

    expect(screen).toHavePathname('/settings/edit');
    expect(screen.getByRole('alert')).toHaveTextContent(en.common.errors.network);
    expect(screen.getByLabelText(q.name.label)).toHaveDisplayValue('Ana Silva');
    expect(serverProfileState()?.display_name).toBe('Ana');

    goOffline(false);
    await fireEvent.press(screen.getByRole('button', { name: en.common.retry }));

    expect(serverProfileState()?.display_name).toBe('Ana Silva');
    expect(screen).toHavePathname('/settings/profile');
    expect(screen.getByRole('button', { name: `${en.profile.name}, Ana Silva` })).toBeOnTheScreen();
  });
});

describe('language', () => {
  it('switches the app to Portuguese and remembers it', async () => {
    await openProfile();
    await fireEvent.press(screen.getByRole('button', { name: en.profile.settings }));
    await fireEvent.press(
      screen.getByRole('button', { name: `${en.language.title}, ${en.language.auto}` }),
    );
    expect(screen).toHavePathname('/settings/language');

    await fireEvent.press(screen.getByRole('radio', { name: 'Português' }));

    expect(screen.getByRole('header', { name: pt.language.title })).toBeOnTheScreen();
    expect(await AsyncStorage.getItem(storageKeys.language)).toBe('"pt"');
  });
});
