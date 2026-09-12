const DEFAULT_USAGE =
  'Alarms you set can ring even when the phone is silent or in a Focus mode.';

const alarmKitInfoPlist = (infoPlist, props) => ({
  ...infoPlist,
  NSAlarmKitUsageDescription: props.alarmKitUsageDescription || DEFAULT_USAGE,
});
const timeSensitiveEntitlements = (entitlements) => ({
  ...entitlements,
  'com.apple.developer.usernotifications.time-sensitive': true,
});

module.exports = {
  alarmKitInfoPlist,
  timeSensitiveEntitlements,
  DEFAULT_USAGE,
};
