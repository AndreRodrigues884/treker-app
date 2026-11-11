// TanStack Query cache keys: always under the user, then the entity. Invalidating a prefix
// refreshes everything below it, e.g. activities(userId) covers lists, counts and details.

export type DateRangeKey = { start: string; end: string };

export const queryKeys = {
  user: (userId: string) => ['user', userId] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  activities: (userId: string) => ['user', userId, 'activities'] as const,
  activityList: (userId: string, range: DateRangeKey) =>
    ['user', userId, 'activities', 'list', range.start, range.end] as const,
  activityCount: (userId: string, range: DateRangeKey) =>
    ['user', userId, 'activities', 'count', range.start, range.end] as const,
  activitySummaries: (userId: string) => ['user', userId, 'activities', 'summaries'] as const,
  activity: (userId: string, activityId: string) =>
    ['user', userId, 'activities', 'detail', activityId] as const,
  activityRecords: (userId: string, activityId: string) =>
    ['user', userId, 'activities', 'detail', activityId, 'records'] as const,
  lastPerformance: (userId: string, exerciseIds: readonly string[]) =>
    ['user', userId, 'activities', 'last', [...exerciseIds].sort().join(',')] as const,
  records: (userId: string) => ['user', userId, 'records'] as const,
  currentGymRecords: (userId: string) => ['user', userId, 'records', 'current', 'gym'] as const,
  gymRecords: (userId: string) => ['user', userId, 'records', 'gym'] as const,
  // Everything the exercise screen shows; invalidated for the exercises a workout change touches.
  exercise: (userId: string, exerciseId: string) =>
    ['user', userId, 'exercise', exerciseId] as const,
  exerciseRecord: (userId: string, exerciseId: string) =>
    ['user', userId, 'exercise', exerciseId, 'record'] as const,
  exerciseStats: (userId: string, exerciseId: string) =>
    ['user', userId, 'exercise', exerciseId, 'stats'] as const,
  exerciseProgress: (userId: string, exerciseId: string, from: string | null) =>
    ['user', userId, 'exercise', exerciseId, 'progress', from ?? 'all'] as const,
  exerciseHistory: (userId: string, exerciseId: string) =>
    ['user', userId, 'exercise', exerciseId, 'history'] as const,
  exercises: (userId: string) => ['user', userId, 'exercises'] as const,
  templates: (userId: string) => ['user', userId, 'templates'] as const,
  templateList: (userId: string) => ['user', userId, 'templates', 'list'] as const,
  template: (userId: string, templateId: string) =>
    ['user', userId, 'templates', 'detail', templateId] as const,
};
