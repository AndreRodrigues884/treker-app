import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

// The "rest is over" alert: a local notification scheduled for the end time of the rest, so it
// arrives with the app in the background or the phone locked, with sound and vibration. Local
// notifications work in Expo Go (only push notifications need a development build).

const CHANNEL_ID = 'rest-timer';
let configured = false;
// Whether our Android channel exists; without it the alert goes to the default channel.
let channelReady = false;

// Once per app run: show the alert also while the app is open, and (Android) a channel with
// vibration. `channelName` is the name the athlete sees in the Android settings.
export async function configureRestNotifications(channelName: string): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    try {
      // No `sound`: on Android it names a custom sound file, and leaving it out gives the phone's
      // default notification sound ('default' made Android look for a file called "default" and
      // fail).
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: channelName,
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 200, 400],
        enableVibrate: true,
      });
      channelReady = true;
    } catch {
      // The alert still works through the default channel.
    }
  }
}

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<NotificationPermission> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'denied';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// Schedules the alert for `endsAt`. Null when notifications are not allowed (the timer on screen
// still works) or the time has passed.
export async function scheduleRestEnd(
  endsAt: Date,
  content: { title: string; body: string },
): Promise<string | null> {
  if (endsAt.getTime() <= Date.now()) return null;
  if ((await getNotificationPermission()) !== 'granted') return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endsAt,
        ...(channelReady ? { channelId: CHANNEL_ID } : {}),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRestEnd(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already shown or gone.
  }
}
