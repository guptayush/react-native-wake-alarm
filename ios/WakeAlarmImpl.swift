import Foundation
import UIKit

@objcMembers public final class WakeAlarmImpl: NSObject {
  /// name is "fired" | "stopped" | "permissionChanged"
  public var onEvent: ((String, [String: Any]) -> Void)?

  private let records = AlarmRecordStore()
  private let notifications = NotificationScheduler()
  private var updates: Task<Void, Never>?
  private let tint = (red: 0.20, green: 0.55, blue: 0.95)

  // Alarm id -> firedAt ms for every AlarmKit alarm currently alerting. Kept by observeUpdates so
  // getRingingJson() is an in-memory read on the render path, never an AlarmKit query.
  private let alertingLock = NSLock()
  private var alerting: [String: Int] = [:]

  public func start() {
    WakeAlarmBridge.shared.handler = { [weak self] payload in
      guard let id = payload["id"] as? String, let at = payload["at"] as? Int else { return }
      switch payload["action"] as? String {
      case "fired": self?.onEvent?("fired", ["id": id, "at": at])
      case "stopped": self?.onEvent?("stopped", ["id": id, "at": at, "source": payload["source"] as? String ?? "user"])
      default: break
      }
    }
    WakeAlarmNotificationProxy.shared.install()
    seedAlerting()
    updates = AlarmKitScheduler.observeUpdates(
      knownIds: { [records] in records.all().map(\.id) },
      onFired: { [weak self] id in self?.markFired(id) },
      onStopped: { [weak self] id in self?.markStopped(id, source: "user") }
    )
  }

  public func stop() {
    WakeAlarmBridge.shared.handler = nil
    WakeAlarmNotificationProxy.shared.uninstall()
    updates?.cancel(); updates = nil
  }

  private static func nowMs() -> Int { Int(Date().timeIntervalSince1970 * 1000) }

  // MARK: alerting map

  /// An alert that began before the module loaded has no observable fire instant; its firedAt is the seed time.
  private func seedAlerting() {
    let now = Self.nowMs()
    let ids = AlarmKitScheduler.alertingIds(from: records.all().map(\.id))
    alertingLock.lock(); defer { alertingLock.unlock() }
    for id in ids where alerting[id] == nil { alerting[id] = now }
  }

  private func markFired(_ id: String) {
    alertingLock.lock()
    let isNew = alerting[id] == nil
    if isNew { alerting[id] = Self.nowMs() }
    alertingLock.unlock()
    if isNew { WakeAlarmBridge.shared.record(id: id, action: "fired") }
  }

  /// Returns false when the id was not alerting, so a stop already reported by stopRinging() is not reported twice.
  @discardableResult
  private func markStopped(_ id: String, source: String) -> Bool {
    alertingLock.lock()
    let wasAlerting = alerting.removeValue(forKey: id) != nil
    alertingLock.unlock()
    if wasAlerting { WakeAlarmBridge.shared.record(id: id, action: "stopped", source: source) }
    return wasAlerting
  }

  private func latestAlerting() -> (id: String, firedAt: Int)? {
    alertingLock.lock(); defer { alertingLock.unlock() }
    return alerting.max { $0.value < $1.value }.map { (id: $0.key, firedAt: $0.value) }
  }

  private func failed(_ reason: String, _ message: String = "") -> [String: Any] {
    ["status": "failed", "backend": "", "reason": reason, "nextFireAt": 0, "message": message]
  }

  private static func gate(fromAlarmKit status: String) -> String {
    switch status {
    case "authorized": return "granted"
    case "denied": return "denied"
    case "not_determined": return "not_determined"
    default: return "not_applicable"
    }
  }

  private func earliestFireDate(for record: AlarmRecord, now: Date) -> Date {
    let calendar = Calendar.autoupdatingCurrent
    guard !record.days.isEmpty else {
      return AlarmMath.nextFireDate(now: now, hour: record.hour, minute: record.minute, isoWeekday: nil, calendar: calendar)
    }
    return record.days.map { AlarmMath.nextFireDate(now: now, hour: record.hour, minute: record.minute, isoWeekday: $0, calendar: calendar) }.min() ?? now
  }

  // MARK: scheduling

  public func schedule(_ input: [String: Any], completion: @escaping ([String: Any]) -> Void) {
    guard var record = AlarmRecord(dictionary: input) else { completion(failed("invalid_input", "missing fields")); return }
    Task { @MainActor in
      if AlarmKitScheduler.isAvailable {
        var status = AlarmKitScheduler.authorizationStatus()
        // The system sheet never appears for a backgrounded app and the await then hangs the promise;
        // schedule() prompts only while active and otherwise falls to the notification path. requestPermissions() prompts.
        if status == "not_determined" && UIApplication.shared.applicationState == .active {
          status = await AlarmKitScheduler.requestAuthorization()
        }
        if status == "authorized" {
          if await AlarmKitScheduler.schedule(record, tint: tint) {
            record.backend = "alarm_kit"
            record.nextFireAt = Int(self.earliestFireDate(for: record, now: Date()).timeIntervalSince1970 * 1000)
            self.notifications.cancel(record.id)
            self.records.put(record)
            completion(["status": "ok", "backend": "alarm_kit", "reason": "", "nextFireAt": record.nextFireAt, "message": ""])
            return
          }
        }
      }
      self.scheduleNotificationFallback(record, alarmKitAvailable: AlarmKitScheduler.isAvailable, completion: completion)
    }
  }

  private func scheduleNotificationFallback(_ input: AlarmRecord, alarmKitAvailable: Bool, completion: @escaping ([String: Any]) -> Void) {
    var record = input
    notifications.authorizationStatus { [self] auth in
      let proceed: (String) -> Void = { auth in
        // Upsert semantics: whatever this id held before is gone before the outcome is decided.
        AlarmKitScheduler.cancel(record.id)
        if auth == "denied" && alarmKitAvailable {
          // "failed" means nothing from this call fires and nothing is listed: no request, no record.
          self.notifications.cancel(record.id)
          self.records.remove(record.id)
          completion(self.failed("alarm_kit_denied", "AlarmKit denied and notifications are off"))
          return
        }
        self.notifications.schedule(record) { fire in
          guard let fire else { completion(self.failed("native_error", "UNUserNotificationCenter refused the request")); return }
          record.backend = "notification"
          record.nextFireAt = Int(fire.timeIntervalSince1970 * 1000)
          self.records.put(record)
          let reason = auth == "denied" ? "no_notification_permission" : "notification_fallback"
          completion(["status": "ok_degraded", "backend": "notification", "reason": reason, "nextFireAt": record.nextFireAt, "message": ""])
        }
      }
      if auth == "not_determined" { self.notifications.requestAuthorization(proceed) } else { proceed(auth) }
    }
  }

  public func cancel(_ id: String, completion: @escaping () -> Void) {
    AlarmKitScheduler.cancel(id)
    notifications.cancel(id)
    records.remove(id)
    completion()
  }

  public func cancelAll(_ completion: @escaping () -> Void) {
    let all = records.all().map(\.id)
    all.forEach(AlarmKitScheduler.cancel)
    notifications.cancelAll(all)
    records.clear()
    completion()
  }

  public func getScheduled(_ completion: @escaping ([[String: Any]]) -> Void) {
    let all = records.all()
    let kitIds = AlarmKitScheduler.scheduledIds(from: all.filter { $0.backend == "alarm_kit" }.map(\.id))
    let now = Date()
    notifications.pendingIds { [self] pending in
      var live: [[String: Any]] = []
      for r in all {
        let held = r.backend == "alarm_kit" ? kitIds.contains(r.id) : pending.contains(r.id)
        guard held else { self.records.remove(r.id); continue }
        var row = r.dictionary
        // Neither AlarmKit nor UNUserNotificationCenter reports a next-fire instant; the stored one is the
        // schedule-time value, stale for a weekly alarm after its first fire. Recompute from the wall clock.
        row["nextFireAt"] = Int(self.earliestFireDate(for: r, now: now).timeIntervalSince1970 * 1000)
        live.append(row)
      }
      completion(live)
    }
  }

  // MARK: permissions

  public func getPermissionStatus(_ completion: @escaping ([String: Any]) -> Void) {
    notifications.authorizationStatus { n in
      completion(["notifications": n, "exactAlarm": "not_applicable", "fullScreenIntent": "not_applicable",
                  "batteryUnrestricted": "not_applicable", "alarmKit": Self.gate(fromAlarmKit: AlarmKitScheduler.authorizationStatus())])
    }
  }

  public func requestPermissions(_ completion: @escaping ([String: Any]) -> Void) {
    Task { @MainActor in
      _ = await AlarmKitScheduler.requestAuthorization()
      self.notifications.requestAuthorization { _ in self.getPermissionStatus(completion) }
    }
  }

  public func openSettings(_ kind: String, completion: @escaping () -> Void) {
    Task { @MainActor in _ = SettingsOpener.open(kind); completion() }
  }

  // MARK: ring lifecycle

  public func getRingingJson() -> String? {
    guard let current = latestAlerting(), let r = records.get(current.id) else { return nil }
    var o: [String: Any] = ["id": r.id, "title": r.title, "firedAt": current.firedAt, "scheduledFor": r.nextFireAt]
    if !r.body.isEmpty { o["body"] = r.body }
    if let d = r.payloadJson.data(using: .utf8), let p = try? JSONSerialization.jsonObject(with: d) as? [String: String], !p.isEmpty { o["payload"] = p }
    return (try? JSONSerialization.data(withJSONObject: o)).flatMap { String(data: $0, encoding: .utf8) }
  }

  public func stopRinging(_ completion: @escaping () -> Void) {
    if let current = latestAlerting(), markStopped(current.id, source: "api") {
      AlarmKitScheduler.stop(current.id)
    }
    completion()
  }

  public func consumePendingActionJson() -> String? { WakeAlarmBridge.shared.consumeJson() }
}
