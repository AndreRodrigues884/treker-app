import { fireEvent, screen } from 'expo-router/testing-library';

import { interpolate } from '@/core/i18n';
import { en } from '@/core/i18n/en';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  networkError,
  onboardedProfile,
  resetSupabaseMock,
  supabaseMock,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const copy = en.deleteAccount;
const confirmField = () =>
  screen.getByLabelText(interpolate(copy.confirmLabel, { word: copy.word }));
const deleteButton = () => screen.getByRole('button', { name: copy.confirm });

async function openDeleteAccount() {
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
  await resetStorage();
  await renderApp('/profile');
  await fireEvent.press(screen.getByRole('button', { name: en.profile.deleteAccount }));
  expect(screen).toHavePathname('/settings/delete-account');
}

describe('delete account', () => {
  it('explains what is lost', async () => {
    await openDeleteAccount();

    expect(screen.getByText(copy.warning)).toBeOnTheScreen();
    expect(screen.getByText(`• ${copy.loseWorkouts}`)).toBeOnTheScreen();
    expect(screen.getByText(`• ${copy.loseRecords}`)).toBeOnTheScreen();
  });

  it('does not call the database until the word is typed', async () => {
    await openDeleteAccount();
    expect(deleteButton()).toBeDisabled();

    await fireEvent.changeText(confirmField(), 'DELET');
    await fireEvent.press(deleteButton());

    expect(deleteButton()).toBeDisabled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('deletes the account once confirmed, then shows the email screen', async () => {
    await openDeleteAccount();

    await fireEvent.changeText(confirmField(), 'delete');
    expect(deleteButton()).toBeEnabled();
    await fireEvent.press(deleteButton());

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
    expect(screen).toHavePathname('/sign-in');
  });

  it('keeps the account and explains when there is no connection', async () => {
    await openDeleteAccount();
    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: networkError } as never);

    await fireEvent.changeText(confirmField(), 'DELETE');
    await fireEvent.press(deleteButton());

    expect(screen.getByRole('alert')).toHaveTextContent(copy.errors.network);
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/settings/delete-account');
  });
});
