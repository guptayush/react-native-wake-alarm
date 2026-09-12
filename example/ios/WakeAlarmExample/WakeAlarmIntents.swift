// Copy this file into your iOS app target (not into a framework or pod) and call
// WakeAlarmIntentsRegistration.install() from application(_:didFinishLaunchingWithOptions:).
// App Intents must be compiled into the app target for the system to resolve them.

import AppIntents
import Foundation
import WakeAlarm

#if canImport(AlarmKit)
import AlarmKit

@available(iOS 26.0, *)
struct WakeAlarmStopIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Alarm"
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Alarm ID") var alarmId: String

  init() {}
  init(alarmId: String) { self.alarmId = alarmId }

  func perform() async throws -> some IntentResult {
    try? AlarmManager.shared.stop(id: WakeAlarmIds.uuid(for: alarmId))
    WakeAlarmBridge.shared.record(id: alarmId, action: "stopped")
    return .result()
  }
}
#endif

public enum WakeAlarmIntentsRegistration {
  public static func install() {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      WakeAlarmBridge.shared.stopIntentFactory = { id in WakeAlarmStopIntent(alarmId: id) }
    }
    #endif
  }
}
