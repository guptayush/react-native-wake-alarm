import Foundation

@objcMembers public final class WakeAlarmImpl: NSObject {
  /// name is "fired" | "stopped" | "permissionChanged"
  public var onEvent: ((String, [String: Any]) -> Void)?

  private let records = AlarmRecordStore()
  private let notifications = NotificationScheduler()
  private var updates: Task<Void, Never>?
  private let tint = (red: 0.20, green: 0.55, blue: 0.95)

  public func start() {
    WakeAlarmBridge.shared.handler = { [weak self] payload in
      let action = payload["action"] as? String ?? "stopped"
      self?.onEvent?(action, payload)
    }
    updates = AlarmKitScheduler.observeUpdates(
      knownIds: { [records] in records.all().map(\.id) },
      onFired: { [weak self] id in self?.onEvent?("fired", ["id": id, "at": Self.nowMs()]) },
      onStopped: { [weak self] id in self?.onEvent?("stopped", ["id": id, "at": Self.nowMs(), "source": "user"]) }
    )
  }

  public func stop() {
    WakeAlarmBridge.shared.handler = nil
    updates?.cancel(); updates = nil
  }

  private static func nowMs() -> Int { Int(Date().timeIntervalSince1970 * 1000) }

  private func failed(_ reason: String, _ message: String = "") -> [String: Any] {
    ["status": "failed", "backend": "", "reason": reason, "nextFireAt": 0, "message": message]
  }

  // MARK: scheduling

  public func schedule(_ input: [String: Any], completion: @escaping ([String: Any]) -> Void) {
    guard var record = AlarmRecord(dictionary: input) else { completion(failed("invalid_input", "missing fields")); return }
    Task { @MainActor in
      if AlarmKitScheduler.isAvailable {
        var status = AlarmKitScheduler.authorizationStatus()
        if status == "not_determined" { status = await AlarmKitScheduler.requestAuthorization() }
        if status == "authorized" {
          if await AlarmKitScheduler.schedule(record, tint: tint) {
            record.backend = "alarm_kit"
            record.nextFireAt = Int(AlarmMath.nextFireDate(now: Date(), hour: record.hour, minute: record.minute,
              isoWeekday: record.days.min(by: { a, b in
                AlarmMath.nextFireDate(now: Date(), hour: record.hour, minute: record.minute, isoWeekday: a, calendar: .autoupdatingCurrent) <
                AlarmMath.nextFireDate(now: Date(), hour: record.hour, minute: record.minute, isoWeekday: b, calendar: .autoupdatingCurrent) }),
              calendar: .autoupdatingCurrent).timeIntervalSince1970 * 1000)
            self.notifications.cancel(record.id)
            self.records.put(record)
            completion(["status": "ok", "backend": "alarm_kit", "reason": "", "nextFireAt": record.nextFireAt, "message": ""])
            return
          }
        }
      }
      self.scheduleNotificationFallback(record, alarmKitDenied: AlarmKitScheduler.isAvailable, completion: completion)
    }
  }

  private func scheduleNotificationFallback(_ input: AlarmRecord, alarmKitDenied: Bool, completion: @escaping ([String: Any]) -> Void) {
    var record = input
    notifications.authorizationStatus { [self] auth in
      let proceed: (String) -> Void = { auth in
        AlarmKitScheduler.cancel(record.id)
        self.notifications.schedule(record) { fire in
          guard let fire else { completion(self.failed("native_error", "UNUserNotificationCenter refused the request")); return }
          record.backend = "notification"
          record.nextFireAt = Int(fire.timeIntervalSince1970 * 1000)
          self.records.put(record)
          if auth == "denied" {
            if alarmKitDenied { completion(self.failed("alarm_kit_denied", "AlarmKit denied and notifications are off")) }
            else { completion(["status": "ok_degraded", "backend": "notification", "reason": "no_notification_permission", "nextFireAt": record.nextFireAt, "message": ""]) }
          } else {
            completion(["status": "ok_degraded", "backend": "notification", "reason": "notification_fallback", "nextFireAt": record.nextFireAt, "message": ""])
          }
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
    notifications.pendingIds { [records] pending in
      var live: [[String: Any]] = []
      for r in all {
        let held = r.backend == "alarm_kit" ? kitIds.contains(r.id) : pending.contains(r.id)
        if held { live.append(r.dictionary) } else { records.remove(r.id) }
      }
      completion(live)
    }
  }

  // MARK: permissions

  public func getPermissionStatus(_ completion: @escaping ([String: Any]) -> Void) {
    notifications.authorizationStatus { n in
      completion(["notifications": n, "exactAlarm": "not_applicable", "fullScreenIntent": "not_applicable",
                  "batteryUnrestricted": "not_applicable", "alarmKit": AlarmKitScheduler.authorizationStatus()])
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
    let all = records.all()
    guard let id = AlarmKitScheduler.alertingId(from: all.map(\.id)), let r = records.get(id) else { return nil }
    var o: [String: Any] = ["id": r.id, "title": r.title, "firedAt": Self.nowMs(), "scheduledFor": r.nextFireAt]
    if !r.body.isEmpty { o["body"] = r.body }
    if let d = r.payloadJson.data(using: .utf8), let p = try? JSONSerialization.jsonObject(with: d) as? [String: String], !p.isEmpty { o["payload"] = p }
    return (try? JSONSerialization.data(withJSONObject: o)).flatMap { String(data: $0, encoding: .utf8) }
  }

  public func stopRinging(_ completion: @escaping () -> Void) {
    if let id = AlarmKitScheduler.alertingId(from: records.all().map(\.id)) {
      AlarmKitScheduler.stop(id)
      onEvent?("stopped", ["id": id, "at": Self.nowMs(), "source": "api"])
    }
    completion()
  }

  public func consumePendingActionJson() -> String? { WakeAlarmBridge.shared.consumeJson() }
}
