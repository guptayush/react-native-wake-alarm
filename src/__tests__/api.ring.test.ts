import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import native, { emit } from '../__mocks__/NativeWakeAlarm';
import { createApi, STOP_SOURCES } from '../api';

jest.mock('../NativeWakeAlarm');
const api = createApi(() => native);

describe('ring lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getRinging parses the native json or returns null', () => {
    native.getRingingJson.mockReturnValue(null);
    expect(api.getRinging()).toBeNull();
    native.getRingingJson.mockReturnValue(
      '{"id":"a","title":"T","firedAt":5,"scheduledFor":4,"payload":{"k":"v"}}'
    );
    expect(api.getRinging()).toEqual({
      id: 'a',
      title: 'T',
      firedAt: 5,
      scheduledFor: 4,
      payload: { k: 'v' },
    });
    native.getRingingJson.mockReturnValue('garbage');
    expect(api.getRinging()).toBeNull();
    native.getRingingJson.mockReturnValue('123');
    expect(api.getRinging()).toBeNull();
    native.getRingingJson.mockReturnValue('[1,2]');
    expect(api.getRinging()).toBeNull();
  });

  it('stopRinging forwards', async () => {
    native.stopRinging.mockResolvedValue(undefined);
    await api.stopRinging();
    expect(native.stopRinging).toHaveBeenCalledTimes(1);
  });

  it('consumePendingAction parses or returns null', () => {
    native.consumePendingActionJson.mockReturnValue(null);
    expect(api.consumePendingAction()).toBeNull();
    native.consumePendingActionJson.mockReturnValue(
      '{"id":"a","action":"stopped","at":9}'
    );
    expect(api.consumePendingAction()).toEqual({
      id: 'a',
      action: 'stopped',
      at: 9,
    });
    native.consumePendingActionJson.mockReturnValue('{');
    expect(api.consumePendingAction()).toBeNull();
    native.consumePendingActionJson.mockReturnValue('null');
    expect(api.consumePendingAction()).toBeNull();
  });

  it('addListener routes each event and remove() unsubscribes', () => {
    const fired = jest.fn();
    const stopped = jest.fn();
    const perm = jest.fn();
    const s1 = api.addListener('fired', fired);
    const s2 = api.addListener('stopped', stopped);
    const s3 = api.addListener('permissionChanged', perm);
    emit('onFired', { id: 'a', at: 1 });
    emit('onStopped', { id: 'a', at: 2, source: 'user' });
    emit('onPermissionChanged', { gate: 'exactAlarm', value: 'granted' });
    expect(fired).toHaveBeenCalledWith({ id: 'a', at: 1 });
    expect(stopped).toHaveBeenCalledWith({ id: 'a', at: 2, source: 'user' });
    expect(perm).toHaveBeenCalledWith({ gate: 'exactAlarm', value: 'granted' });
    s1.remove();
    s2.remove();
    s3.remove();
    emit('onFired', { id: 'b', at: 3 });
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('accepts every documented stop source, including superseded', () => {
    expect([...STOP_SOURCES].sort()).toEqual([
      'api',
      'superseded',
      'timeout',
      'user',
    ]);
    const stopped = jest.fn();
    const sub = api.addListener('stopped', stopped);
    emit('onStopped', { id: 'a', at: 2, source: 'superseded' });
    expect(stopped).toHaveBeenCalledWith({
      id: 'a',
      at: 2,
      source: 'superseded',
    });
    sub.remove();
  });

  it('clears the parked duplicate once per live fired/stopped delivery', () => {
    native.consumePendingActionJson.mockReturnValue(null);
    const first = jest.fn();
    const second = jest.fn();
    const subs = [
      api.addListener('fired', first),
      api.addListener('fired', second),
      api.addListener('stopped', first),
    ];
    emit('onFired', { id: 'a', at: 1 });
    expect(native.consumePendingActionJson).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    emit('onStopped', { id: 'a', at: 2, source: 'user' });
    expect(native.consumePendingActionJson).toHaveBeenCalledTimes(2);
    emit('onStopped', { id: 'a', at: 2, source: 'user' });
    expect(native.consumePendingActionJson).toHaveBeenCalledTimes(2);
    emit('onPermissionChanged', { gate: 'exactAlarm', value: 'granted' });
    expect(native.consumePendingActionJson).toHaveBeenCalledTimes(2);
    subs.forEach((s) => s.remove());
  });

  it('addListener normalises unknown stop sources and gates', () => {
    const stopped = jest.fn();
    const perm = jest.fn();
    api.addListener('stopped', stopped);
    api.addListener('permissionChanged', perm);
    emit('onStopped', { id: 'a', at: 2, source: 'weird' });
    emit('onPermissionChanged', { gate: 'exactAlarm', value: 'weird' });
    expect(stopped).toHaveBeenCalledWith({ id: 'a', at: 2, source: 'api' });
    expect(perm).toHaveBeenCalledWith({
      gate: 'exactAlarm',
      value: 'not_applicable',
    });
  });

  it('addListener drops permission events for unknown gates', () => {
    const perm = jest.fn();
    api.addListener('permissionChanged', perm);
    emit('onPermissionChanged', { gate: 'bogus', value: 'granted' });
    expect(perm).not.toHaveBeenCalled();
  });

  it('addListener rejects an unknown event name', () => {
    expect(() =>
      (api.addListener as (e: string, cb: () => void) => unknown)(
        'nope',
        () => {}
      )
    ).toThrow('event: must be one of');
  });
});
