import { jest } from '@jest/globals';
import type { Spec } from '../NativeWakeAlarm';

type Listener<T> = (e: T) => void;
const listeners: Record<string, Set<Listener<unknown>>> = {
  onFired: new Set(),
  onStopped: new Set(),
  onPermissionChanged: new Set(),
};

const emitter = (name: string) =>
  ((cb: Listener<unknown>) => {
    listeners[name]!.add(cb);
    return { remove: () => listeners[name]!.delete(cb) };
  }) as unknown as Spec['onFired'];

export const emit = (name: keyof typeof listeners, payload: unknown) =>
  listeners[name]!.forEach((l) => l(payload));

const mock: jest.Mocked<Spec> = {
  schedule: jest.fn(),
  cancel: jest.fn(),
  cancelAll: jest.fn(),
  getScheduled: jest.fn(),
  getPermissionStatus: jest.fn(),
  requestPermissions: jest.fn(),
  openSettings: jest.fn(),
  getRingingJson: jest.fn(),
  stopRinging: jest.fn(),
  consumePendingActionJson: jest.fn(),
  onFired: emitter('onFired'),
  onStopped: emitter('onStopped'),
  onPermissionChanged: emitter('onPermissionChanged'),
} as unknown as jest.Mocked<Spec>;

export default mock;
