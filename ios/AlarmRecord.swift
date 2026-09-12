import Foundation

struct AlarmRecord: Codable, Equatable {
  var id: String
  var hour: Int
  var minute: Int
  var days: [Int]
  var title: String
  var body: String
  var sound: String
  var payloadJson: String
  var maxRingMs: Int
  var backend: String   // "alarm_kit" | "notification"
  var nextFireAt: Int   // epoch ms, cached for getScheduled

  init?(dictionary d: [String: Any]) {
    guard let id = d["id"] as? String, let hour = d["hour"] as? Int, let minute = d["minute"] as? Int,
          let title = d["title"] as? String else { return nil }
    self.id = id; self.hour = hour; self.minute = minute
    self.days = (d["days"] as? [Int]) ?? (d["days"] as? [NSNumber])?.map { $0.intValue } ?? []
    self.title = title
    self.body = d["body"] as? String ?? ""
    self.sound = d["sound"] as? String ?? ""
    self.payloadJson = d["payloadJson"] as? String ?? "{}"
    self.maxRingMs = (d["maxRingMs"] as? Int) ?? Int((d["maxRingMs"] as? Double) ?? 600_000)
    self.backend = ""
    self.nextFireAt = 0
  }

  var dictionary: [String: Any] {
    ["id": id, "hour": hour, "minute": minute, "days": days, "title": title, "body": body, "sound": sound,
     "payloadJson": payloadJson, "maxRingMs": maxRingMs, "backend": backend, "nextFireAt": nextFireAt]
  }
}
