import Foundation

final class AlarmRecordStore {
  private let defaults = UserDefaults.standard
  private let key = "wake_alarm.records_v1"

  private func load() -> [String: AlarmRecord] {
    guard let data = defaults.data(forKey: key) else { return [:] }
    return (try? JSONDecoder().decode([String: AlarmRecord].self, from: data)) ?? [:]
  }
  private func save(_ m: [String: AlarmRecord]) {
    if let data = try? JSONEncoder().encode(m) { defaults.set(data, forKey: key) }
  }

  func put(_ r: AlarmRecord) { var m = load(); m[r.id] = r; save(m) }
  func get(_ id: String) -> AlarmRecord? { load()[id] }
  func remove(_ id: String) { var m = load(); m.removeValue(forKey: id); save(m) }
  func all() -> [AlarmRecord] { Array(load().values).sorted { $0.nextFireAt < $1.nextFireAt } }
  func clear() { defaults.removeObject(forKey: key) }
}
