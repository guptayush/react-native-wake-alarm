import { describe, expect, it } from '@jest/globals';
import {
  mapPermissionStatus,
  mapScheduleResult,
  mapScheduledAlarm,
  toGate,
} from '../mapResult';

describe('mapScheduleResult', () => {
  it('maps ok', () => {
    expect(
      mapScheduleResult({
        status: 'ok',
        backend: 'alarm_manager',
        reason: '',
        nextFireAt: 5,
        message: '',
      })
    ).toEqual({ status: 'ok', backend: 'alarm_manager', nextFireAt: 5 });
  });
  it('maps ok_degraded with reason', () => {
    expect(
      mapScheduleResult({
        status: 'ok_degraded',
        backend: 'notification',
        reason: 'notification_fallback',
        nextFireAt: 7,
        message: '',
      })
    ).toEqual({
      status: 'ok_degraded',
      backend: 'notification',
      nextFireAt: 7,
      reason: 'notification_fallback',
    });
  });
  it('maps failed with optional message', () => {
    expect(
      mapScheduleResult({
        status: 'failed',
        backend: '',
        reason: 'no_exact_alarm_permission',
        nextFireAt: 0,
        message: '',
      })
    ).toEqual({ status: 'failed', reason: 'no_exact_alarm_permission' });
    expect(
      mapScheduleResult({
        status: 'failed',
        backend: '',
        reason: 'native_error',
        nextFireAt: 0,
        message: 'boom',
      })
    ).toEqual({ status: 'failed', reason: 'native_error', message: 'boom' });
  });
  it('treats an unknown status or reason as native_error', () => {
    expect(
      mapScheduleResult({
        status: 'weird',
        backend: '',
        reason: '',
        nextFireAt: 0,
        message: '',
      })
    ).toEqual({
      status: 'failed',
      reason: 'native_error',
      message: 'unknown status: weird',
    });
    expect(
      mapScheduleResult({
        status: 'ok_degraded',
        backend: 'alarm_kit',
        reason: 'nope',
        nextFireAt: 1,
        message: '',
      })
    ).toEqual({
      status: 'failed',
      reason: 'native_error',
      message: 'unknown reason: nope',
    });
    expect(
      mapScheduleResult({
        status: 'failed',
        backend: '',
        reason: 'nope',
        nextFireAt: 0,
        message: '',
      })
    ).toEqual({
      status: 'failed',
      reason: 'native_error',
      message: 'unknown reason: nope',
    });
  });
});

describe('mapScheduledAlarm', () => {
  it('parses payload and drops empty optionals', () => {
    expect(
      mapScheduledAlarm({
        id: 'a',
        hour: 1,
        minute: 2,
        days: [1, 2],
        title: 't',
        body: '',
        sound: '',
        payloadJson: '{"k":"v"}',
        maxRingMs: 1000,
        nextFireAt: 9,
        backend: 'alarm_kit',
      })
    ).toEqual({
      id: 'a',
      hour: 1,
      minute: 2,
      days: [1, 2],
      title: 't',
      payload: { k: 'v' },
      maxRingMs: 1000,
      nextFireAt: 9,
      backend: 'alarm_kit',
    });
  });
  it('keeps body and sound when present and tolerates bad payload json', () => {
    expect(
      mapScheduledAlarm({
        id: 'a',
        hour: 1,
        minute: 2,
        days: [],
        title: 't',
        body: 'b',
        sound: 's',
        payloadJson: 'not json',
        maxRingMs: 1000,
        nextFireAt: 9,
        backend: 'notification',
      })
    ).toEqual({
      id: 'a',
      hour: 1,
      minute: 2,
      days: [],
      title: 't',
      body: 'b',
      sound: 's',
      maxRingMs: 1000,
      nextFireAt: 9,
      backend: 'notification',
    });
  });
});

describe('toGate / mapPermissionStatus', () => {
  it('maps known gates and defaults unknown to not_applicable', () => {
    expect(toGate('granted')).toBe('granted');
    expect(toGate('denied')).toBe('denied');
    expect(toGate('not_determined')).toBe('not_determined');
    expect(toGate('anything')).toBe('not_applicable');
    expect(
      mapPermissionStatus({
        notifications: 'granted',
        exactAlarm: 'denied',
        fullScreenIntent: 'x',
        batteryUnrestricted: 'not_determined',
        alarmKit: 'not_applicable',
      })
    ).toEqual({
      notifications: 'granted',
      exactAlarm: 'denied',
      fullScreenIntent: 'not_applicable',
      batteryUnrestricted: 'not_determined',
      alarmKit: 'not_applicable',
    });
  });
});
