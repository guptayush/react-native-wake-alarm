import { describe, expect, it, jest } from '@jest/globals';
import native from '../__mocks__/NativeWakeAlarm';
import { createApi } from '../api';
import consumerMock from '../../jest';

jest.mock('../NativeWakeAlarm');

const methods = Object.keys(createApi(() => native)).sort();

describe('react-native-wake-alarm/jest', () => {
  it('exposes every WakeAlarmApi method as a mock function', () => {
    expect(Object.keys(consumerMock).sort()).toEqual(methods);
    for (const name of methods) {
      expect(
        jest.isMockFunction(consumerMock[name as keyof typeof consumerMock])
      ).toBe(true);
    }
  });

  it('mirrors the named exports of the real entry point', async () => {
    const real = await import('../index');
    const mock = await import('../../jest');
    // Babel stamps __esModule on the compiled entry point; the CommonJS mock declares it by hand.
    expect(
      Object.keys(mock)
        .filter((k) => k !== '__esModule')
        .sort()
    ).toEqual(Object.keys(real).sort());
    expect(mock.RING_COMPONENT_NAME).toBe(real.RING_COMPONENT_NAME);
    const Stub = mock.DefaultRingScreen as (p: never) => unknown;
    expect(Stub({} as never)).toBeNull();
    const error = new mock.WakeAlarmInputError('id', 'bad');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'WakeAlarmInputError',
      code: 'invalid_input',
      field: 'id',
      message: 'id: bad',
    });
  });

  it('resolves sensible defaults from every method', async () => {
    await expect(
      consumerMock.schedule({ id: 'a', hour: 1, minute: 2, title: 't' })
    ).resolves.toEqual({
      status: 'ok',
      backend: 'alarm_manager',
      nextFireAt: 0,
    });
    await expect(consumerMock.cancel('a')).resolves.toBeUndefined();
    await expect(consumerMock.cancelAll()).resolves.toBeUndefined();
    await expect(consumerMock.getScheduled()).resolves.toEqual([]);
    await expect(consumerMock.getPermissionStatus()).resolves.toMatchObject({
      notifications: 'granted',
      backgroundPopup: 'not_applicable',
      alarmKit: 'not_applicable',
    });
    await expect(consumerMock.requestPermissions()).resolves.toMatchObject({
      exactAlarm: 'granted',
    });
    await expect(consumerMock.openSettings('battery')).resolves.toBeUndefined();
    expect(consumerMock.getRinging()).toBeNull();
    await expect(consumerMock.stopRinging()).resolves.toBeUndefined();
    expect(consumerMock.consumePendingAction()).toBeNull();
    const sub = consumerMock.addListener('permissionChanged', () => {});
    expect(jest.isMockFunction(sub.remove)).toBe(true);
    sub.remove();
    expect(consumerMock.registerRingScreen(() => null)).toBeUndefined();
  });
});
