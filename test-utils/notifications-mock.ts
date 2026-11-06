// Stand-in for expo-notifications in Jest (registered in jest.setup.ts). Scheduled notifications
// are kept in `scheduled` so tests can check what would fire and when. Permission starts as
// "undetermined", like a fresh install; setNotificationStatus changes it.

type Scheduled = { id: string; content: { title: string; body: string }; date: Date };

let status: 'granted' | 'denied' | 'undetermined' = 'undetermined';
let nextId = 0;
export const scheduled = new Map<string, Scheduled>();

export function setNotificationStatus(next: typeof status) {
  status = next;
}

export function resetNotifications() {
  status = 'undetermined';
  nextId = 0;
  scheduled.clear();
}

export const getPermissionsAsync = jest.fn(async () => ({
  status,
  granted: status === 'granted',
  canAskAgain: status === 'undetermined',
}));

export const requestPermissionsAsync = jest.fn(async () => {
  status = 'granted';
  return { status, granted: true, canAskAgain: false };
});

export const scheduleNotificationAsync = jest.fn(
  async (request: { content: Scheduled['content']; trigger: { date: Date } }) => {
    const id = `notification-${++nextId}`;
    scheduled.set(id, { id, content: request.content, date: request.trigger.date });
    return id;
  },
);

export const cancelScheduledNotificationAsync = jest.fn(async (id: string) => {
  scheduled.delete(id);
});

export const setNotificationHandler = jest.fn();
export const setNotificationChannelAsync = jest.fn(async () => null);

export const SchedulableTriggerInputTypes = { DATE: 'date', TIME_INTERVAL: 'timeInterval' };
export const AndroidImportance = { DEFAULT: 3, HIGH: 4, MAX: 5 };
