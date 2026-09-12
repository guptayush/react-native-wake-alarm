const { describe, expect, it } = require('@jest/globals');
const {
  alarmKitInfoPlist,
  timeSensitiveEntitlements,
  DEFAULT_USAGE,
} = require('../lib/plist');

describe('plist helpers', () => {
  it('sets the default usage description and keeps existing keys', () => {
    expect(alarmKitInfoPlist({ CFBundleName: 'x' }, {})).toEqual({
      CFBundleName: 'x',
      NSAlarmKitUsageDescription: DEFAULT_USAGE,
    });
  });
  it('honours a custom description', () => {
    expect(
      alarmKitInfoPlist({}, { alarmKitUsageDescription: 'Ring me' })
        .NSAlarmKitUsageDescription
    ).toBe('Ring me');
  });
  it('enables the time-sensitive entitlement', () => {
    expect(
      timeSensitiveEntitlements({ 'aps-environment': 'development' })
    ).toEqual({
      'aps-environment': 'development',
      'com.apple.developer.usernotifications.time-sensitive': true,
    });
  });
});
