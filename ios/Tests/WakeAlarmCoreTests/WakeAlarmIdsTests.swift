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
    // SHA-256("morning") = c23b31a0179b550f8a18fb06bc52a26e…; first 16 bytes with byte 6 stamped 0x4_ and byte 8 stamped 0b10__.
    // This is the wire contract between the pod and the host's App Intent: a change here breaks every installed alarm.
    XCTAssertEqual(WakeAlarmIds.uuid(for: "morning").uuidString, "C23B31A0-179B-450F-8A18-FB06BC52A26E")
  }
  func testIsoWeekdayMapping() {
    XCTAssertEqual(WakeAlarmIds.weekday(fromIso: 1), 2) // Monday
    XCTAssertEqual(WakeAlarmIds.weekday(fromIso: 6), 7) // Saturday
    XCTAssertEqual(WakeAlarmIds.weekday(fromIso: 7), 1) // Sunday
  }
}
