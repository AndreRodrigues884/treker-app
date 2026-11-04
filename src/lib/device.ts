import { getCalendars, getLocales } from 'expo-localization';

// The phone's region, such as 'PT' or 'US'; null when unknown.
export function getDeviceRegion(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

// The phone's IANA timezone, such as 'Europe/Lisbon'.
export function getDeviceTimezone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}
