import type { ComponentType } from 'react';
import type { RingScreenProps, WakeAlarmApi } from 'react-native-wake-alarm';

// Structural subset of jest.Mock, so this file needs no Jest types to compile in a host project.
export interface MockFunction<F extends (...args: never[]) => unknown> {
  (...args: Parameters<F>): ReturnType<F>;
  mock: { calls: Parameters<F>[]; results: { type: string; value: unknown }[] };
  mockClear(): this;
  mockReset(): this;
  mockImplementation(fn: F): this;
  mockReturnValue(value: ReturnType<F>): this;
  mockResolvedValue(value: Awaited<ReturnType<F>>): this;
  mockRejectedValue(reason: unknown): this;
}

export type MockedWakeAlarm = {
  [K in keyof WakeAlarmApi]: WakeAlarmApi[K] extends (
    ...args: never[]
  ) => unknown
    ? MockFunction<WakeAlarmApi[K]>
    : WakeAlarmApi[K];
};

declare const WakeAlarm: MockedWakeAlarm;
export default WakeAlarm;
export declare const DefaultRingScreen: ComponentType<RingScreenProps>;
export declare const RING_COMPONENT_NAME: 'WakeAlarmRing';
export declare class WakeAlarmInputError extends Error {
  readonly code: 'invalid_input';
  readonly field: string;
  constructor(field: string, message: string);
}
