// The cases file is shared with the pgTAP tests (supabase/tests/09_one_rep_max_cases.sql), so the
// app and the database compute the same 1RM.
import cases from '../../../supabase/tests/fixtures/one-rep-max-cases.json';

import { beatsGymRecord, beatsSwimRecord, estimateOneRepMax, type OneRepMaxInput } from './index';

type Case = { name: string; input: OneRepMaxInput; expected: number | null };

describe('estimateOneRepMax (shared cases)', () => {
  it.each(cases as Case[])('$name', ({ input, expected }) => {
    expect(estimateOneRepMax(input)).toBe(expected);
  });
});

describe('beatsGymRecord', () => {
  it('a first valid 1RM is a record', () => {
    expect(beatsGymRecord(100, null)).toBe(true);
  });

  it('must strictly beat the current best', () => {
    expect(beatsGymRecord(120.5, 120)).toBe(true);
    expect(beatsGymRecord(120, 120)).toBe(false);
    expect(beatsGymRecord(119, 120)).toBe(false);
  });

  it('a set that does not count is never a record', () => {
    expect(beatsGymRecord(null, null)).toBe(false);
  });
});

describe('beatsSwimRecord', () => {
  it('a first time is a record', () => {
    expect(beatsSwimRecord(2761, null)).toBe(true);
  });

  it('must be strictly faster', () => {
    expect(beatsSwimRecord(2760, 2761)).toBe(true);
    expect(beatsSwimRecord(2761, 2761)).toBe(false);
    expect(beatsSwimRecord(2800, 2761)).toBe(false);
  });
});
