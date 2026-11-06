import type { Difficulty } from '@/core/session';
import type { Messages } from '@/core/i18n';
import type { AccentTone } from '@/theme';

// How hard a set felt, as the athlete sees it: easy in green, medium in amber, hard in red.

export const difficultyTone: Record<Difficulty, AccentTone> = {
  easy: 'positive',
  medium: 'warning',
  hard: 'danger',
};

export function difficultyLabel(t: Messages, difficulty: Difficulty): string {
  return t.session.difficulty[difficulty];
}
