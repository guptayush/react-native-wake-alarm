import Foundation

/// Process-wide hand-off between things that happen while JavaScript may not exist
/// (an App Intent on cold start, a notification action) and the TurboModule.
@objcMembers public final class WakeAlarmBridge: NSObject {
  public static let shared = WakeAlarmBridge()
  private let lock = NSLock()
  private let defaults = UserDefaults.standard
  private let key = "wake_alarm.pending_action"

  /// Set by the module while JS is listening. Payload: {"id", "action", "at"}.
  public var handler: (([String: Any]) -> Void)? {
    get { lock.lock(); defer { lock.unlock() }; return _handler }
    set { lock.lock(); defer { lock.unlock() }; _handler = newValue }
  }
  private var _handler: (([String: Any]) -> Void)?

  /// Installed by the host app (see Templates/WakeAlarmIntents.swift). Returns an AppIntent for the alarm id.
  public var stopIntentFactory: ((String) -> Any?)? {
    get { lock.lock(); defer { lock.unlock() }; return _stopIntentFactory }
    set { lock.lock(); defer { lock.unlock() }; _stopIntentFactory = newValue }
  }
  private var _stopIntentFactory: ((String) -> Any?)?

  private override init() {}

  public func record(id: String, action: String) {
    let payload: [String: Any] = ["id": id, "action": action, "at": Int(Date().timeIntervalSince1970 * 1000)]
    if let live = handler { live(payload); return }
    if let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) {
      defaults.set(json, forKey: key)
    }
  }

  public func consumeJson() -> String? {
    let v = defaults.string(forKey: key)
    if v != nil { defaults.removeObject(forKey: key) }
    return v
  }
}
