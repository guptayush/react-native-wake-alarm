/* global jest */
// Consumer mock: jest.mock('react-native-wake-alarm', () => require('react-native-wake-alarm/jest')).
// Every WakeAlarmApi method is a jest.fn() with a resolved value a host test can build on;
// nothing here touches the TurboModule registry.

const GRANTED = {
  notifications: 'granted',
  exactAlarm: 'granted',
  fullScreenIntent: 'granted',
  batteryUnrestricted: 'granted',
  backgroundPopup: 'not_applicable',
  alarmKit: 'not_applicable',
};

class WakeAlarmInputError extends Error {
  constructor(field, message) {
    super(`${field}: ${message}`);
    this.name = 'WakeAlarmInputError';
    this.code = 'invalid_input';
    this.field = field;
  }
}

const DefaultRingScreen = () => null;
const RING_COMPONENT_NAME = 'WakeAlarmRing';

const WakeAlarm = {
  schedule: jest.fn(async () => ({
    status: 'ok',
    backend: 'alarm_manager',
    nextFireAt: 0,
  })),
  cancel: jest.fn(async () => undefined),
  cancelAll: jest.fn(async () => undefined),
  getScheduled: jest.fn(async () => []),
  getPermissionStatus: jest.fn(async () => ({ ...GRANTED })),
  requestPermissions: jest.fn(async () => ({ ...GRANTED })),
  openSettings: jest.fn(async () => undefined),
  getRinging: jest.fn(() => null),
  stopRinging: jest.fn(async () => undefined),
  consumePendingAction: jest.fn(() => null),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  registerRingScreen: jest.fn(),
};

module.exports = {
  __esModule: true,
  default: WakeAlarm,
  DefaultRingScreen,
  RING_COMPONENT_NAME,
  WakeAlarmInputError,
};
