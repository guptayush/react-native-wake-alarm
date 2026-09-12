import type { ComponentType } from 'react';
import { AppRegistry } from 'react-native';
import type { RingScreenProps, WakeAlarmApi } from '../types';
import {
  __resetCurrentForTests,
  getRegisteredRingScreen,
  setRegisteredRingScreen,
} from './current';
import { RingRoot } from './RingRoot';

export const RING_COMPONENT_NAME = 'WakeAlarmRing';

export { getRegisteredRingScreen };

let appRegistryDone = false;

export function ensureRingRootRegistered(api: WakeAlarmApi): void {
  if (appRegistryDone) return;
  appRegistryDone = true;
  AppRegistry.registerComponent(RING_COMPONENT_NAME, () => () => (
    <RingRoot api={api} />
  ));
}

export function registerRingScreen(
  component: ComponentType<RingScreenProps>,
  api: WakeAlarmApi
): void {
  setRegisteredRingScreen(component);
  ensureRingRootRegistered(api);
}

export function __resetRegistryForTests(): void {
  __resetCurrentForTests();
  appRegistryDone = false;
}
