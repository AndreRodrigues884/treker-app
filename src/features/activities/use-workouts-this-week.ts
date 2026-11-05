import { localDateOf, weekRange } from '@/core/dates';
import { countActivities } from '@/features/activities/repository';
import { useAuth } from '@/features/auth/auth-provider';
import { getDeviceTimezone } from '@/lib/device';
import { useLocalQuery } from '@/lib/local-db';

// Workouts (not deleted) whose local date is in the current week, Monday to Sunday, counted from
// the local database and updated as activities change. Undefined while loading.
export function useWorkoutsThisWeek(): number | undefined {
  const { store } = useAuth();
  const { start, end } = weekRange(localDateOf(new Date(), getDeviceTimezone()));
  return useLocalQuery(store, (s) => countActivities(s, { start, end }), ['activities'], [start]);
}
