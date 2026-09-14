import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import native from '../__mocks__/NativeWakeAlarm';
import { createApi } from '../api';
import { ID_PATTERN } from '../validate';

jest.mock('../NativeWakeAlarm');

const api = createApi(() => native);
const okNative = {
  status: 'ok',
  backend: 'alarm_manager',
  reason: '',
  nextFireAt: 123,
  message: '',
};

describe('schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates, forwards the normalised input and maps the result', async () => {
    native.schedule.mockResolvedValue(okNative);
    const res = await api.schedule({
      id: 'a',
      hour: 6,
      minute: 30,
      title: 'T',
      days: [3, 1],
    });
    expect(native.schedule).toHaveBeenCalledWith({
      id: 'a',
      hour: 6,
      minute: 30,
      days: [1, 3],
      title: 'T',
      body: '',
      sound: '',
      payloadJson: '{}',
      maxRingMs: 600000,
      vibrate: true,
    });
    expect(res).toEqual({
      status: 'ok',
      backend: 'alarm_manager',
      nextFireAt: 123,
    });
  });

  it('returns failed/invalid_input instead of throwing for bad input', async () => {
    await expect(
      api.schedule({ id: '', hour: 6, minute: 30, title: 'T' })
    ).resolves.toEqual({
      status: 'failed',
      reason: 'invalid_input',
      message: 'id: must match /^[A-Za-z0-9_.-]{1,64}$/',
    });
    expect(native.schedule).not.toHaveBeenCalled();
  });

  it('returns failed/native_error when native rejects', async () => {
    native.schedule.mockRejectedValue(new Error('kaboom'));
    await expect(
      api.schedule({ id: 'a', hour: 1, minute: 1, title: 'T' })
    ).resolves.toEqual({
      status: 'failed',
      reason: 'native_error',
      message: 'kaboom',
    });
  });

  it('returns failed/native_error with a generic message for a non-Error rejection', async () => {
    native.schedule.mockRejectedValue('string reason');
    await expect(
      api.schedule({ id: 'a', hour: 1, minute: 1, title: 'T' })
    ).resolves.toEqual({
      status: 'failed',
      reason: 'native_error',
      message: 'string reason',
    });
  });
});

describe('cancel / cancelAll / getScheduled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancel validates the id and forwards', async () => {
    native.cancel.mockResolvedValue(undefined);
    await api.cancel('abc');
    expect(native.cancel).toHaveBeenCalledWith('abc');
    await expect(api.cancel('')).rejects.toThrow('id: must match');
    await expect(api.cancel('a:b')).rejects.toThrow(String(ID_PATTERN));
  });

  it('cancelAll forwards', async () => {
    native.cancelAll.mockResolvedValue(undefined);
    await api.cancelAll();
    expect(native.cancelAll).toHaveBeenCalledTimes(1);
  });

  it('getScheduled maps every row', async () => {
    native.getScheduled.mockResolvedValue([
      {
        id: 'a',
        hour: 1,
        minute: 2,
        days: [],
        title: 't',
        body: '',
        sound: '',
        payloadJson: '{}',
        maxRingMs: 600000,
        vibrate: false,
        nextFireAt: 9,
        backend: 'alarm_kit',
      },
    ]);
    await expect(api.getScheduled()).resolves.toEqual([
      {
        id: 'a',
        hour: 1,
        minute: 2,
        days: [],
        title: 't',
        maxRingMs: 600000,
        vibrate: false,
        nextFireAt: 9,
        backend: 'alarm_kit',
      },
    ]);
  });
});
