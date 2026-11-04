import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { readJson, removeKey, storageKeys, writeJson } from '@/lib/storage';

// Whether the intro (shown before the first sign-in) was already seen on this phone. It stays
// seen after signing out, so the app then opens on the email screen.
export type IntroState = {
  // Null while reading from storage.
  introSeen: boolean | null;
  markIntroSeen: () => Promise<void>;
  // Dev tool: shows the intro again.
  resetIntro: () => Promise<void>;
};

const IntroContext = createContext<IntroState | null>(null);

export function useIntro(): IntroState {
  const intro = use(IntroContext);
  if (!intro) throw new Error('useIntro must be used inside <IntroProvider>');
  return intro;
}

export function IntroProvider({ children }: { children: ReactNode }) {
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let current = true;
    void readJson(storageKeys.introSeen).then((value) => {
      if (current) setIntroSeen(value === true);
    });
    return () => {
      current = false;
    };
  }, []);

  const markIntroSeen = useCallback(async () => {
    setIntroSeen(true);
    await writeJson(storageKeys.introSeen, true);
  }, []);

  const resetIntro = useCallback(async () => {
    await removeKey(storageKeys.introSeen);
    setIntroSeen(false);
  }, []);

  return <IntroContext value={{ introSeen, markIntroSeen, resetIntro }}>{children}</IntroContext>;
}
