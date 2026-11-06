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
  activityRecent: (userId: string, limit: number) =>
    ['user', userId, 'activities', 'recent', limit] as const,
  activity: (userId: string, activityId: string) =>
    ['user', userId, 'activities', 'detail', activityId] as const,
  exercises: (userId: string) => ['user', userId, 'exercises'] as const,
  templates: (userId: string) => ['user', userId, 'templates'] as const,
  templateList: (userId: string) => ['user', userId, 'templates', 'list'] as const,
  template: (userId: string, templateId: string) =>
    ['user', userId, 'templates', 'detail', templateId] as const,
};
