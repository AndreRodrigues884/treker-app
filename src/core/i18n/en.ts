// Source dictionary: its shape defines the Messages type every other language must match.
export const en = {
  common: {
    loading: 'Loading',
  },
  home: {
    tagline: 'Gym and swim tracking for self-coached athletes.',
  },
  records: {
    prShort: 'PR',
    prLabel: 'Personal record',
  },
};

export type Messages = typeof en;
