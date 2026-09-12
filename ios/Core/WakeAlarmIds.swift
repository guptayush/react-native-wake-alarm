import CryptoKit
import Foundation

/// Maps the package's string alarm ids onto the UUIDs AlarmKit keys alarms by.
/// Derived, not stored, so the same function works inside an App Intent on a cold start.
public enum WakeAlarmIds {
  public static func uuid(for id: String) -> UUID {
    var bytes = Array(SHA256.hash(data: Data(id.utf8)).prefix(16))
    bytes[6] = (bytes[6] & 0x0F) | 0x40
    bytes[8] = (bytes[8] & 0x3F) | 0x80
    return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                       bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
  }

  /// ISO weekday (1 = Monday … 7 = Sunday) to Foundation's Calendar weekday (1 = Sunday … 7 = Saturday).
  public static func weekday(fromIso iso: Int) -> Int { iso == 7 ? 1 : iso + 1 }
}
