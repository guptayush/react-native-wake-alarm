import Foundation
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit
import AppIntents
import SwiftUI
#endif

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct WakeAlarmMetadata: AlarmMetadata { let alarmId: String }
#endif

enum AlarmKitScheduler {
  static var isAvailable: Bool {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) { return true }
    #endif
    return false
  }

  static func authorizationStatus() -> String {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      switch AlarmManager.shared.authorizationState {
      case .authorized: return "authorized"
      case .denied: return "denied"
      case .notDetermined: return "not_determined"
      @unknown default: return "not_determined"
      }
    }
    #endif
    return "not_applicable"
  }

  /// Must run on the main actor: the system sheet never appears from a background queue and the call then hangs.
  @MainActor static func requestAuthorization() async -> String {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let current = AlarmManager.shared.authorizationState
      if current == .authorized { return "authorized" }
      if current == .denied { return "denied" }
      do {
        switch try await AlarmManager.shared.requestAuthorization() {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "not_determined"
        @unknown default: return "not_determined"
        }
      } catch { return "denied" }
    }
    #endif
    return "not_applicable"
  }

  static func schedule(_ record: AlarmRecord, tint: (red: Double, green: Double, blue: Double)) async -> Bool {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      let uuid = WakeAlarmIds.uuid(for: record.id)
      let time = Alarm.Schedule.Relative.Time(hour: record.hour, minute: record.minute)
      let weekdays = record.days.compactMap(localeWeekday)
      if !record.days.isEmpty && weekdays.isEmpty { return false }
      let recurrence: Alarm.Schedule.Relative.Recurrence = weekdays.isEmpty ? .never : .weekly(weekdays)
      let schedule = Alarm.Schedule.relative(.init(time: time, repeats: recurrence))

      let stopButton = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle")
      let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: record.title), stopButton: stopButton, secondaryButton: nil, secondaryButtonBehavior: nil)
      let attributes = AlarmAttributes<WakeAlarmMetadata>(
        presentation: AlarmPresentation(alert: alert),
        metadata: WakeAlarmMetadata(alarmId: record.id),
        tintColor: Color(red: tint.red, green: tint.green, blue: tint.blue)
      )
      let stopIntent = WakeAlarmBridge.shared.stopIntentFactory?(record.id) as? (any LiveActivityIntent)
      let configuration = AlarmManager.AlarmConfiguration(
        countdownDuration: nil, schedule: schedule, attributes: attributes,
        stopIntent: stopIntent, secondaryIntent: nil, sound: alertSound(named: record.sound)
      )
      // schedule(id:) is not an upsert; a duplicate id is refused. Cancel first.
      try? AlarmManager.shared.cancel(id: uuid)
      do {
        _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)
        return true
      } catch {
        return false
      }
    }
    #endif
    return false
  }

  static func cancel(_ id: String) {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) { try? AlarmManager.shared.cancel(id: WakeAlarmIds.uuid(for: id)) }
    #endif
  }

  static func stop(_ id: String) {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) { try? AlarmManager.shared.stop(id: WakeAlarmIds.uuid(for: id)) }
    #endif
  }

  /// Which of `candidates` AlarmKit is still holding.
  static func scheduledIds(from candidates: [String]) -> Set<String> {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *), let alarms = try? AlarmManager.shared.alarms {
      let held = Set(alarms.map(\.id))
      return Set(candidates.filter { held.contains(WakeAlarmIds.uuid(for: $0)) })
    }
    #endif
    return []
  }

  /// Which of `candidates` are alerting right now. Queried once at start-up to seed the in-memory map.
  static func alertingIds(from candidates: [String]) -> [String] {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *), let alarms = try? AlarmManager.shared.alarms {
      let alerting = Set(alarms.filter { $0.state == .alerting }.map(\.id))
      return candidates.filter { alerting.contains(WakeAlarmIds.uuid(for: $0)) }
    }
    #endif
    return []
  }

  /// Watches AlarmKit's update stream and reports alerting transitions. Returns nil below iOS 26.
  static func observeUpdates(knownIds: @escaping () -> [String], onFired: @escaping (String) -> Void, onStopped: @escaping (String) -> Void) -> Task<Void, Never>? {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      return Task {
        var alerting = Set<UUID>()
        var iterator = AlarmManager.shared.alarmUpdates.makeAsyncIterator()
        // Checked before each await, so a cancelled task stops at the next opportunity instead of after the next update.
        while !Task.isCancelled, let alarms = try? await iterator.next() {
          let ids = knownIds()
          let byUuid = Dictionary(uniqueKeysWithValues: ids.map { (WakeAlarmIds.uuid(for: $0), $0) })
          let now = Set(alarms.filter { $0.state == .alerting }.map(\.id))
          for u in now.subtracting(alerting) { if let id = byUuid[u] { onFired(id) } }
          for u in alerting.subtracting(now) { if let id = byUuid[u] { onStopped(id) } }
          alerting = now
        }
      }
    }
    #endif
    return nil
  }

  #if canImport(AlarmKit)
  @available(iOS 26.0, *)
  private static func localeWeekday(_ iso: Int) -> Locale.Weekday? {
    switch iso {
    case 1: return .monday; case 2: return .tuesday; case 3: return .wednesday; case 4: return .thursday
    case 5: return .friday; case 6: return .saturday; case 7: return .sunday; default: return nil
    }
  }

  @available(iOS 26.0, *)
  private static func alertSound(named name: String) -> ActivityKit.AlertConfiguration.AlertSound {
    guard !name.isEmpty else { return .default }
    let v = ProcessInfo.processInfo.operatingSystemVersion
    if v.majorVersion == 26 && v.minorVersion == 0 { return .default } // custom sounds are broken on 26.0
    for ext in ["caf", "wav", "aiff"] where Bundle.main.url(forResource: name, withExtension: ext) != nil {
      // The resource name includes its extension; the 26.0 guard above keeps a known-broken release on the default tone.
      return .named("\(name).\(ext)")
    }
    return .default
  }
  #endif
}
