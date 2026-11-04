import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

// External links, in one place. PROVISIONAL: replace with the real pages before release.
export const links = {
  privacyPolicy: 'https://example.com/treker/privacy',
  contact: 'mailto:hello@example.com',
} as const;

// Web pages open in an in-app browser; mailto: opens the email app.
export async function openLink(url: string): Promise<void> {
  if (url.startsWith('mailto:')) {
    await Linking.openURL(url);
  } else {
    await WebBrowser.openBrowserAsync(url);
  }
}
