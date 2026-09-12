import type { ComponentType } from 'react';
import type { RingScreenProps } from '../types';
import { DefaultRingScreen } from './DefaultRingScreen';

let registered: ComponentType<RingScreenProps> = DefaultRingScreen;

export const getRegisteredRingScreen = (): ComponentType<RingScreenProps> =>
  registered;

export const setRegisteredRingScreen = (
  component: ComponentType<RingScreenProps>
): void => {
  registered = component;
};

export const __resetCurrentForTests = (): void => {
  registered = DefaultRingScreen;
};
