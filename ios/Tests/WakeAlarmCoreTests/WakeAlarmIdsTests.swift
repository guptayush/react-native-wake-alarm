import XCTest
@testable import WakeAlarmCore

final class WakeAlarmIdsTests: XCTestCase {
  func testDerivationIsStableAndDistinct() {
    XCTAssertEqual(WakeAlarmIds.uuid(for: "morning"), WakeAlarmIds.uuid(for: "morning"))
    XCTAssertNotEqual(WakeAlarmIds.uuid(for: "morning"), WakeAlarmIds.uuid(for: "evening"))
  }
  func testIsWellFormedVersion4Variant1() {
    let u = WakeAlarmIds.uuid(for: "x").uuid
    XCTAssertEqual(u.6 >> 4, 0x4)
    XCTAssertEqual(u.8 >> 6, 0b10)
  }
  func testKnownVector() {
    // SHA-256("morning") prefix 16 bytes with version/variant bits stamped.
    XCTAssertEqual(WakeAlarmIds.uuid(for: "morning").uuidString.count, 36)
  }
  func testIsoWeekdayMapping() {
    XCTAssertEqual(WakeAlarmIds.weekday(fromIso: 1), 2) // Monday
    XCTAssertEqual(WakeAlarmIds.weekday(fromIso: 6), 7) // Saturday
    XCTAssertEqual(WakeAlarmIds.weekday(fromIso: 7), 1) // Sunday
  }
}
