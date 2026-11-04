import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Supabase sessions can be larger than what the iOS Keychain reliably accepts in one item (around
// 2048 bytes), so, as in Supabase's Expo guide, the session is encrypted with a random AES-256 key
// kept in SecureStore (Keychain / Keystore), and only the ciphertext goes to AsyncStorage.
// Without the key, the stored value is unreadable.

const KEY_BYTES = 32;

async function encrypt(storageKey: string, value: string): Promise<string> {
  // A new key for every write, so the fixed CTR counter never reuses a key.
  const encryptionKey = getRandomBytes(KEY_BYTES);
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(storageKey, aesjs.utils.hex.fromBytes(encryptionKey));
  return aesjs.utils.hex.fromBytes(encryptedBytes);
}

async function decrypt(storageKey: string, value: string): Promise<string | null> {
  const encryptionKeyHex = await SecureStore.getItemAsync(storageKey);
  if (!encryptionKeyHex) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(encryptionKeyHex),
    new aesjs.Counter(1),
  );
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
}

// Implements the storage interface supabase-js expects.
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    return encrypted ? decrypt(key, encrypted) : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};
