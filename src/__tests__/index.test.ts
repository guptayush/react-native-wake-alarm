import { describe, expect, it, jest } from '@jest/globals';
jest.mock('../NativeWakeAlarm');
import WakeAlarm, {
  DefaultRingScreen,
  RING_COMPONENT_NAME,
  WakeAlarmInputError,
} from '../index';

describe('index', () => {
  it('exports the api object and helpers', () => {
    expect(typeof WakeAlarm.schedule).toBe('function');
    expect(typeof DefaultRingScreen).toBe('function');
    expect(RING_COMPONENT_NAME).toBe('WakeAlarmRing');
    expect(new WakeAlarmInputError('f', 'm').code).toBe('invalid_input');
  });
});
