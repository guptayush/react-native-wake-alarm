import Foundation
import UserNotifications

/// iOS < 26 path (and the fallback when AlarmKit is unavailable or denied):
/// a time-sensitive local notification with a Stop action. Passes Focus, not the silent switch.
final class NotificationScheduler {
  static let categoryId = "WAKE_ALARM"
  private let center = UNUserNotificationCenter.current()
  private let calendar = Calendar.autoupdatingCurrent

  func authorizationStatus(_ completion: @escaping (String) -> Void) {
    center.getNotificationSettings { s in
      switch s.authorizationStatus {
      case .authorized, .provisional, .ephemeral: completion("granted")
      case .denied: completion("denied")
      case .notDetermined: completion("not_determined")
      @unknown default: completion("not_determined")
      }
    }
  }

  func requestAuthorization(_ completion: @escaping (String) -> Void) {
    center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] _, _ in
      self?.authorizationStatus(completion)
    }
  }

  private func ensureCategory(_ completion: @escaping () -> Void) {
    center.getNotificationCategories { [center] existing in
      if existing.contains(where: { $0.identifier == Self.categoryId }) { completion(); return }
      let stop = UNNotificationAction(identifier: "STOP", title: "Stop", options: [.destructive])
      let category = UNNotificationCategory(identifier: Self.categoryId, actions: [stop], intentIdentifiers: [], options: [])
      center.setNotificationCategories(existing.union([category]))
      completion()
    }
  }

  private func sound(named name: String) -> UNNotificationSound {
    guard !name.isEmpty else { return .default }
    for ext in ["caf", "wav", "aiff"] where Bundle.main.url(forResource: name, withExtension: ext) != nil {
      return UNNotificationSound(named: UNNotificationSoundName("\(name).\(ext)"))
    }
    return .default
  }

  private func identifier(_ id: String, _ isoWeekday: Int?) -> String { "wakealarm.\(id).\(isoWeekday.map(String.init) ?? "once")" }

  /// Schedules one request per weekday (or one one-off). Completes with the earliest fire date.
  func schedule(_ record: AlarmRecord, completion: @escaping (Date?) -> Void) {
    cancel(record.id)
    ensureCategory { [weak self] in
      guard let self else { completion(nil); return }
      let content = UNMutableNotificationContent()
      content.title = record.title
      content.body = record.body.isEmpty ? "Alarm" : record.body
      content.sound = self.sound(named: record.sound)
      content.categoryIdentifier = Self.categoryId
      content.userInfo = ["wakeAlarmId": record.id, "payloadJson": record.payloadJson]
      if #available(iOS 15.0, *) { content.interruptionLevel = .timeSensitive }

      let now = Date()
      // JavaScript validates days; filtering here keeps a bad record from scheduling a trigger that never fires.
      let validDays = record.days.filter { (1...7).contains($0) }
      let days: [Int?] = validDays.isEmpty ? [nil] : validDays.map { Optional($0) }
      var earliest: Date?
      let group = DispatchGroup()
      let lock = NSLock()
      var failed = false
      for day in days {
        let fire = AlarmMath.nextFireDate(now: now, hour: record.hour, minute: record.minute, isoWeekday: day, calendar: self.calendar)
        earliest = min(earliest ?? fire, fire)
        let trigger: UNCalendarNotificationTrigger
        if let day {
          trigger = UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: record.hour, minute: record.minute, weekday: WakeAlarmIds.weekday(fromIso: day)), repeats: true)
        } else {
          trigger = UNCalendarNotificationTrigger(dateMatching: self.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fire), repeats: false)
        }
        group.enter()
        self.center.add(UNNotificationRequest(identifier: self.identifier(record.id, day), content: content, trigger: trigger)) { error in
          if error != nil { lock.lock(); failed = true; lock.unlock() }
          group.leave()
        }
      }
      group.notify(queue: .main) { completion(failed ? nil : earliest) }
    }
  }

  func cancel(_ id: String) {
    let ids = ([nil] + (1...7).map(Optional.some)).map { identifier(id, $0) }
    center.removePendingNotificationRequests(withIdentifiers: ids)
  }

  func cancelAll(_ ids: [String]) { ids.forEach(cancel) }

  func pendingIds(_ completion: @escaping (Set<String>) -> Void) {
    center.getPendingNotificationRequests { reqs in
      completion(Set(reqs.compactMap { $0.content.userInfo["wakeAlarmId"] as? String }))
    }
  }
}

/// Owns UNUserNotificationCenter's delegate slot for the WAKE_ALARM category only. Everything else is
/// forwarded to whichever delegate the host had installed, and that delegate is put back on uninstall().
@objcMembers public final class WakeAlarmNotificationProxy: NSObject, UNUserNotificationCenterDelegate {
  public static let shared = WakeAlarmNotificationProxy()
  private let lock = NSLock()
  private var previous: UNUserNotificationCenterDelegate?

  private override init() {}

  /// Idempotent. Call from application(_:didFinishLaunchingWithOptions:) so a cold-start tap is seen;
  /// the module also calls it when it loads, for hosts that skipped that step.
  public func install() {
    let center = UNUserNotificationCenter.current()
    if center.delegate === self { return }
    lock.lock(); previous = center.delegate; lock.unlock()
    center.delegate = self
  }

  public func uninstall() {
    let center = UNUserNotificationCenter.current()
    guard center.delegate === self else { return }
    lock.lock(); let restored = previous; previous = nil; lock.unlock()
    center.delegate = restored
  }

  private var forwardTo: UNUserNotificationCenterDelegate? { lock.lock(); defer { lock.unlock() }; return previous }

  private static func isWakeAlarm(_ content: UNNotificationContent) -> Bool {
    content.categoryIdentifier == NotificationScheduler.categoryId
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                     withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    guard Self.isWakeAlarm(notification.request.content) else {
      // A previous delegate without this method leaves the optional call nil; the system default is then "do not present".
      if forwardTo?.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler) == nil {
        completionHandler([])
      }
      return
    }
    // An alarm that lands while the app is open must still be seen and heard.
    completionHandler([.banner, .list, .sound])
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                     withCompletionHandler completionHandler: @escaping () -> Void) {
    let content = response.notification.request.content
    guard Self.isWakeAlarm(content) else {
      if forwardTo?.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler) == nil {
        completionHandler()
      }
      return
    }
    // The STOP action and the default tap both end the alarm from the user's point of view.
    if let id = content.userInfo["wakeAlarmId"] as? String {
      WakeAlarmBridge.shared.record(id: id, action: "stopped")
    }
    completionHandler()
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
    forwardTo?.userNotificationCenter?(center, openSettingsFor: notification)
  }
}
