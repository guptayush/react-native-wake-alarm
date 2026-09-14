import XCTest
@testable import WakeAlarmCore

final class AlarmRecordTests: XCTestCase {
  private let input: [String: Any] = ["id": "morning", "hour": 6, "minute": 30, "days": [1, 3], "title": "Yoga",
                                      "body": "", "sound": "chime", "payloadJson": "{}", "maxRingMs": 600_000]

  func testVibrateDefaultsToTrueAndRoundTripsThroughTheDictionary() {
    let record = AlarmRecord(dictionary: input)!
    XCTAssertTrue(record.vibrate)
    var silent = input; silent["vibrate"] = false
    XCTAssertFalse(AlarmRecord(dictionary: silent)!.vibrate)
    XCTAssertEqual(AlarmRecord(dictionary: silent)!.dictionary["vibrate"] as? Bool, false)
  }

  func testDecodesAOnePointZeroRecordWithoutTheVibrateKey() throws {
    // The exact JSON shape 1.0 persisted in UserDefaults; a decode failure here would drop every stored alarm on upgrade.
    let legacy = """
    {"morning":{"id":"morning","hour":6,"minute":30,"days":[1],"title":"Yoga","body":"","sound":"","payloadJson":"{}","maxRingMs":600000,"backend":"alarm_kit","nextFireAt":1800000000000}}
    """
    let decoded = try JSONDecoder().decode([String: AlarmRecord].self, from: Data(legacy.utf8))
    XCTAssertTrue(decoded["morning"]!.vibrate)
    XCTAssertEqual(decoded["morning"]!.backend, "alarm_kit")
  }

  func testEncodesVibrateSoTheNextDecodeKeepsFalse() throws {
    var record = AlarmRecord(dictionary: input)!
    record.vibrate = false; record.backend = "notification"
    let data = try JSONEncoder().encode(["morning": record])
    let back = try JSONDecoder().decode([String: AlarmRecord].self, from: data)
    XCTAssertEqual(back["morning"], record)
  }

  func testMissingRequiredFieldsRejectTheDictionary() {
    XCTAssertNil(AlarmRecord(dictionary: ["id": "x"]))
  }
}
