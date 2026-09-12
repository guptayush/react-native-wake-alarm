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
  schedule: jest.fn<Spec['schedule']>(),
  cancel: jest.fn<Spec['cancel']>(),
  cancelAll: jest.fn<Spec['cancelAll']>(),
  getScheduled: jest.fn<Spec['getScheduled']>(),
  getPermissionStatus: jest.fn<Spec['getPermissionStatus']>(),
  requestPermissions: jest.fn<Spec['requestPermissions']>(),
  openSettings: jest.fn<Spec['openSettings']>(),
  getRingingJson: jest.fn<Spec['getRingingJson']>(),
  stopRinging: jest.fn<Spec['stopRinging']>(),
  consumePendingActionJson: jest.fn<Spec['consumePendingActionJson']>(),
  onFired: emitter('onFired') as unknown as Spec['onFired'],
  onStopped: emitter('onStopped') as unknown as Spec['onStopped'],
  onPermissionChanged: emitter(
    'onPermissionChanged'
  ) as unknown as Spec['onPermissionChanged'],
} as unknown as jest.Mocked<Spec>;

export default mock;
