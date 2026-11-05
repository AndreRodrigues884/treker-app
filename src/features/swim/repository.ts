// Swim times. Postgres checks the entry belongs to one of the athlete's swim activities.
import type { SwimEntryRow } from '@/features/activities/repository';
import type { DataContext } from '@/lib/data/context';
import { throwIfError, unwrap } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';

export type { SwimEntryRow };

export type NewSwimEntry = {
  // Pass the same id when retrying, so the time is not created twice.
  id?: string;
  activityId: string;
  position: number;
  stroke: SwimEntryRow['stroke'];
  distance: number;
  poolLength: SwimEntryRow['pool_length'];
  timeCs: number;
  kind: SwimEntryRow['kind'];
  splitsCs?: number[] | null;
};

export async function addSwimEntry(ctx: DataContext, input: NewSwimEntry): Promise<SwimEntryRow> {
  const row = {
    id: input.id ?? ctx.newId(),
    user_id: ctx.userId,
    activity_id: input.activityId,
    position: input.position,
    stroke: input.stroke,
    distance: input.distance,
    pool_length: input.poolLength,
    time_cs: input.timeCs,
    kind: input.kind,
    splits_cs: input.splitsCs ?? null,
  };
  return unwrap(
    await supabase.from('swim_entries').upsert(row, { onConflict: 'id' }).select().single(),
  );
}

export type SwimEntryChanges = Partial<
  Pick<
    SwimEntryRow,
    'position' | 'stroke' | 'distance' | 'pool_length' | 'time_cs' | 'kind' | 'splits_cs'
  >
>;

export async function updateSwimEntry(
  ctx: DataContext,
  id: string,
  changes: SwimEntryChanges,
): Promise<SwimEntryRow> {
  return unwrap(
    await supabase
      .from('swim_entries')
      .update(changes)
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .select()
      .single(),
  );
}

export async function deleteSwimEntry(ctx: DataContext, id: string): Promise<void> {
  throwIfError(
    await supabase
      .from('swim_entries')
      .update({ deleted_at: ctx.now().toISOString() })
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null),
  );
}
