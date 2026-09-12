import Foundation

final class AlarmRecordStore {
  private let defaults = UserDefaults.standard
  private let key = "wake_alarm.records_v1"
  private let lock = NSLock()
  // Decoded once; every later read is in memory so getRingingJson() never touches UserDefaults on the render path.
  private var cache: [String: AlarmRecord]?

  private func load() -> [String: AlarmRecord] {
    if let cache { return cache }
    let loaded = defaults.data(forKey: key).flatMap { try? JSONDecoder().decode([String: AlarmRecord].self, from: $0) } ?? [:]
    cache = loaded
    return loaded
  }
  private func save(_ m: [String: AlarmRecord]) {
    cache = m
    if let data = try? JSONEncoder().encode(m) { defaults.set(data, forKey: key) }
  }

  func put(_ r: AlarmRecord) { lock.lock(); defer { lock.unlock() }; var m = load(); m[r.id] = r; save(m) }
  func get(_ id: String) -> AlarmRecord? { lock.lock(); defer { lock.unlock() }; return load()[id] }
  func remove(_ id: String) { lock.lock(); defer { lock.unlock() }; var m = load(); m.removeValue(forKey: id); save(m) }
  func all() -> [AlarmRecord] { lock.lock(); defer { lock.unlock() }; return Array(load().values).sorted { $0.nextFireAt < $1.nextFireAt } }
  func clear() { lock.lock(); defer { lock.unlock() }; cache = [:]; defaults.removeObject(forKey: key) }
}
