import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, FlatList } from 'react-native';

import { en } from '@/core/i18n/en';
import { storageKeys } from '@/lib/storage';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import { resetSupabaseMock } from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const page = (current: number) =>
  en.intro.pageOf.replace('{current}', String(current)).replace('{total}', '4');

async function openIntro() {
  resetSupabaseMock({ signedIn: false });
  await resetStorage({ introSeen: false });
  await renderApp('/');
  expect(screen).toHavePathname('/welcome');
}

async function goToLastPage() {
  for (let i = 0; i < 3; i++) {
    await fireEvent.press(screen.getByRole('button', { name: en.common.next }));
  }
  expect(screen.getByLabelText(page(4))).toBeOnTheScreen();
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('intro', () => {
  it('shows the logo, the first page, the page indicator and Skip', async () => {
    await openIntro();

    expect(screen.getByLabelText('Treker')).toBeOnTheScreen();

    expect(screen.getByText(en.intro.pages.oneLog.title)).toBeOnTheScreen();
    expect(screen.getByLabelText(page(1))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.intro.skip })).toBeOnTheScreen();
  });

  it('Next moves through the pages, with Skip still visible', async () => {
    await openIntro();

    await fireEvent.press(screen.getByRole('button', { name: en.common.next }));

    expect(screen.getByLabelText(page(2))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.intro.skip })).toBeOnTheScreen();
  });

  it('Skip opens the email screen and remembers the intro was seen', async () => {
    await openIntro();

    await fireEvent.press(screen.getByRole('button', { name: en.intro.skip }));

    expect(screen).toHavePathname('/sign-in');
    expect(await AsyncStorage.getItem(storageKeys.introSeen)).toBe('true');
  });

  it('the last page offers both ways in; "Get started" titles the email screen for a new account', async () => {
    await openIntro();
    await goToLastPage();

    expect(screen.getByRole('button', { name: en.intro.haveAccount })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en.intro.getStarted }));

    expect(screen).toHavePathname('/sign-in');
    expect(screen.getByRole('header', { name: en.auth.signUpTitle })).toBeOnTheScreen();
  });

  it('"I already have an account" opens the same email screen titled for signing in', async () => {
    await openIntro();
    await goToLastPage();

    await fireEvent.press(screen.getByRole('button', { name: en.intro.haveAccount }));

    expect(screen).toHavePathname('/sign-in');
    expect(screen.getByRole('header', { name: en.auth.emailTitle })).toBeOnTheScreen();
  });

  it('moves between pages without animation when the system asks to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    await openIntro();

    await fireEvent.press(screen.getByRole('button', { name: en.common.next }));

    expect(scrollToIndex).toHaveBeenCalledWith({ index: 1, animated: false });
  });

  it('animates between pages otherwise', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    await openIntro();

    await fireEvent.press(screen.getByRole('button', { name: en.common.next }));

    expect(scrollToIndex).toHaveBeenCalledWith({ index: 1, animated: true });
  });
});
