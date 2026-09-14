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
  var vibrate: Bool
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
    self.vibrate = d["vibrate"] as? Bool ?? true
    self.backend = ""
    self.nextFireAt = 0
  }

  // Records persisted by 1.0 have no `vibrate` key; a synthesized decoder would drop the whole store.
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    hour = try c.decode(Int.self, forKey: .hour)
    minute = try c.decode(Int.self, forKey: .minute)
    days = try c.decode([Int].self, forKey: .days)
    title = try c.decode(String.self, forKey: .title)
    body = try c.decode(String.self, forKey: .body)
    sound = try c.decode(String.self, forKey: .sound)
    payloadJson = try c.decode(String.self, forKey: .payloadJson)
    maxRingMs = try c.decode(Int.self, forKey: .maxRingMs)
    vibrate = try c.decodeIfPresent(Bool.self, forKey: .vibrate) ?? true
    backend = try c.decode(String.self, forKey: .backend)
    nextFireAt = try c.decode(Int.self, forKey: .nextFireAt)
  }

  var dictionary: [String: Any] {
    ["id": id, "hour": hour, "minute": minute, "days": days, "title": title, "body": body, "sound": sound,
     "payloadJson": payloadJson, "maxRingMs": maxRingMs, "vibrate": vibrate, "backend": backend, "nextFireAt": nextFireAt]
  }
}
