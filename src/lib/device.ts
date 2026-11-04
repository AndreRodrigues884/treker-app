import { getCalendars } from 'expo-localization';

// The phone's IANA timezone, such as 'Europe/Lisbon'.
export function getDeviceTimezone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}
