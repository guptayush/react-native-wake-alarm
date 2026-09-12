import { AppRegistry } from 'react-native';
import type { WakeAlarmApi } from '../types';
import { RingRoot } from './RingRoot';

export const RING_COMPONENT_NAME = 'WakeAlarmRing';

// Called once at import. The ring activity starts this surface with only module scope
// evaluated, so a lazy registration would leave it with nothing to run.
export function registerRingRoot(api: WakeAlarmApi): void {
  AppRegistry.registerComponent(RING_COMPONENT_NAME, () => () => (
    <RingRoot api={api} />
  ));
}
