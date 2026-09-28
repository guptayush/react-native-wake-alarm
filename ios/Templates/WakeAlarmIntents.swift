// Copy this file into your iOS app target (not into a framework or pod) and call
// WakeAlarmIntentsRegistration.install() from application(_:didFinishLaunchingWithOptions:).
// App Intents must be compiled into the app target for the system to resolve them, and the
// notification delegate must be in place before a cold-start tap is delivered.

import AppIntents
import Foundation
import WakeAlarm

#if canImport(AlarmKit)
import AlarmKit

@available(iOS 26.0, *)
struct WakeAlarmStopIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Alarm"
  static var isDiscoverable: Bool = false
  static var supportedModes: IntentModes { .background }

  @Parameter(title: "Alarm ID") var alarmId: String

  init() {}
  init(alarmId: String) { self.alarmId = alarmId }

  func perform() async throws -> some IntentResult {
    try? AlarmManager.shared.stop(id: WakeAlarmIds.uuid(for: alarmId))
    WakeAlarmBridge.shared.record(id: alarmId, action: "stopped")
    return .result()
  }
}

/// Behind the alert's "Open" button. Runs in the foreground, so the system brings the app up
/// (unlocking first if needed). The alarm keeps ringing: read WakeAlarm.getRinging() and show
/// your own screen with a stopRinging() button, or let the user press Stop on the alert.
@available(iOS 26.0, *)
struct WakeAlarmOpenIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Open Alarm"
  static var isDiscoverable: Bool = false
  static var supportedModes: IntentModes { .foreground }

  @Parameter(title: "Alarm ID") var alarmId: String

  init() {}
  init(alarmId: String) { self.alarmId = alarmId }

  func perform() async throws -> some IntentResult { .result() }
}
#endif

public enum WakeAlarmIntentsRegistration {
  public static func install() {
    WakeAlarmNotificationProxy.shared.install()
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      WakeAlarmBridge.shared.stopIntentFactory = { id in WakeAlarmStopIntent(alarmId: id) }
      WakeAlarmBridge.shared.openIntentFactory = { id in WakeAlarmOpenIntent(alarmId: id) }
    }
    #endif
  }
}
