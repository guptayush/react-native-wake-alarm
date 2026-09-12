import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import native from '../__mocks__/NativeWakeAlarm';
import { createApi } from '../api';

jest.mock('../NativeWakeAlarm');
const api = createApi(native);
const nativeStatus = {
  notifications: 'granted',
  exactAlarm: 'denied',
  fullScreenIntent: 'not_applicable',
  batteryUnrestricted: 'granted',
  alarmKit: 'not_applicable',
};

describe('permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('getPermissionStatus maps', async () => {
    native.getPermissionStatus.mockResolvedValue(nativeStatus);
    await expect(api.getPermissionStatus()).resolves.toEqual(nativeStatus);
  });
  it('requestPermissions maps', async () => {
    native.requestPermissions.mockResolvedValue({
      ...nativeStatus,
      exactAlarm: 'granted',
    });
    await expect(api.requestPermissions()).resolves.toMatchObject({
      exactAlarm: 'granted',
    });
  });
  it('openSettings forwards a valid kind and rejects an invalid one', async () => {
    native.openSettings.mockResolvedValue(undefined);
    await api.openSettings('exactAlarm');
    expect(native.openSettings).toHaveBeenCalledWith('exactAlarm');
    await expect(api.openSettings('bogus' as never)).rejects.toThrow(
      'kind: must be one of'
    );
    expect(native.openSettings).toHaveBeenCalledTimes(1);
  });
});
