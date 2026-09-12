import { useCallback, useEffect, useState } from 'react';
import type { RingingAlarm, WakeAlarmApi } from '../types';
import { getRegisteredRingScreen } from './current';

export function RingRoot({ api }: { api: WakeAlarmApi }) {
  const [alarm, setAlarm] = useState<RingingAlarm | null>(() =>
    api.getRinging()
  );
  useEffect(() => {
    const sub = api.addListener('stopped', () => setAlarm(null));
    return () => sub.remove();
  }, [api]);
  const stop = useCallback(() => api.stopRinging(), [api]);
  if (!alarm) return null;
  const Screen = getRegisteredRingScreen();
  return <Screen alarm={alarm} stop={stop} />;
}
