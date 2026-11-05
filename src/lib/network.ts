import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

// True when the phone reports no connection. Unknown (still checking) counts as connected, so
// the "No connection" banner never flashes at launch.
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(state.isConnected === false);
      }),
    [],
  );
  return offline;
}
