const { describe, expect, it } = require('@jest/globals');
const { injectAppDelegate, MARKER_REVISION } = require('../lib/appDelegate');

const template = `import Expo
import React

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe('injectAppDelegate', () => {
  it('adds the import and the install call once', () => {
    const out = injectAppDelegate(template);
    expect(out).toContain('import WakeAlarm');
    expect(out).toContain('WakeAlarmIntentsRegistration.install()');
    expect(out.indexOf('WakeAlarmIntentsRegistration.install()')).toBeLessThan(
      out.indexOf('let delegate = ReactNativeDelegate()')
    );
    expect(out).toContain(`wake-alarm:intents ${MARKER_REVISION}`);
  });
  it('is idempotent at the same revision', () => {
    const once = injectAppDelegate(template);
    expect(injectAppDelegate(once)).toBe(once);
  });
  it('replaces a region from an older revision', () => {
    const stale = injectAppDelegate(template)
      .replace(`wake-alarm:intents ${MARKER_REVISION}`, 'wake-alarm:intents r0')
      .replace('WakeAlarmIntentsRegistration.install()', 'OldCall()');
    const out = injectAppDelegate(stale);
    expect(out).not.toContain('OldCall()');
    expect(
      out.match(/WakeAlarmIntentsRegistration\.install\(\)/g)
    ).toHaveLength(1);
  });
  it('throws a clear error when the anchor is missing', () => {
    expect(() => injectAppDelegate('class Nope {}')).toThrow(
      'react-native-wake-alarm: could not find didFinishLaunchingWithOptions'
    );
  });
});
