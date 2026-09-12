import UIKit

enum SettingsOpener {
  /// Returns false for kinds that do not exist on iOS so the caller can resolve without doing anything.
  @MainActor static func open(_ kind: String) -> Bool {
    let urlString: String
    switch kind {
    case "notifications":
      if #available(iOS 16.0, *) { urlString = UIApplication.openNotificationSettingsURLString } else { urlString = UIApplication.openSettingsURLString }
    case "alarmKit": urlString = UIApplication.openSettingsURLString
    default: return false // exactAlarm, fullScreenIntent, battery, autostart are Android-only
    }
    guard let url = URL(string: urlString) else { return false }
    UIApplication.shared.open(url)
    return true
  }
}
