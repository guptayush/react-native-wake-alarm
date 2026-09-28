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

  func testButtonTitlesDefaultToEmptyAndRoundTripThroughTheDictionary() {
    let record = AlarmRecord(dictionary: input)!
    XCTAssertEqual(record.stopButtonTitle, "")
    XCTAssertEqual(record.openButtonTitle, "")
    var titled = input; titled["stopButtonTitle"] = "Dismiss"; titled["openButtonTitle"] = "Open app"
    let t = AlarmRecord(dictionary: titled)!
    XCTAssertEqual(t.stopButtonTitle, "Dismiss")
    XCTAssertEqual(t.openButtonTitle, "Open app")
    XCTAssertEqual(t.dictionary["stopButtonTitle"] as? String, "Dismiss")
    XCTAssertEqual(t.dictionary["openButtonTitle"] as? String, "Open app")
  }

  func testDecodesARecordWithoutTheButtonTitleKeys() throws {
    let legacy = """
    {"morning":{"id":"morning","hour":6,"minute":30,"days":[1],"title":"Yoga","body":"","sound":"","payloadJson":"{}","maxRingMs":600000,"vibrate":true,"silent":false,"backend":"alarm_kit","nextFireAt":1800000000000}}
    """
    let decoded = try JSONDecoder().decode([String: AlarmRecord].self, from: Data(legacy.utf8))
    XCTAssertEqual(decoded["morning"]!.stopButtonTitle, "")
    XCTAssertEqual(decoded["morning"]!.openButtonTitle, "")
  }

  func testEncodesButtonTitlesSoTheNextDecodeKeepsThem() throws {
    var record = AlarmRecord(dictionary: input)!
    record.stopButtonTitle = "Dismiss"; record.openButtonTitle = "Open app"; record.backend = "alarm_kit"
    let data = try JSONEncoder().encode(["morning": record])
    let back = try JSONDecoder().decode([String: AlarmRecord].self, from: data)
    XCTAssertEqual(back["morning"], record)
  }

  func testMissingRequiredFieldsRejectTheDictionary() {
    XCTAssertNil(AlarmRecord(dictionary: ["id": "x"]))
  }

  func testSilentDefaultsToFalseAndRoundTripsThroughTheDictionary() {
    XCTAssertFalse(AlarmRecord(dictionary: input)!.silent)
    var silent = input; silent["silent"] = true
    XCTAssertTrue(AlarmRecord(dictionary: silent)!.silent)
    XCTAssertEqual(AlarmRecord(dictionary: silent)!.dictionary["silent"] as? Bool, true)
  }

  func testDecodesAOnePointTwoRecordWithoutTheSilentKey() throws {
    let legacy = """
    {"morning":{"id":"morning","hour":6,"minute":30,"days":[1],"title":"Yoga","body":"","sound":"","payloadJson":"{}","maxRingMs":600000,"vibrate":true,"backend":"alarm_kit","nextFireAt":1800000000000}}
    """
    let decoded = try JSONDecoder().decode([String: AlarmRecord].self, from: Data(legacy.utf8))
    XCTAssertFalse(decoded["morning"]!.silent)
  }

  func testEncodesSilentSoTheNextDecodeKeepsTrue() throws {
    var record = AlarmRecord(dictionary: input)!
    record.silent = true; record.backend = "notification"
    let data = try JSONEncoder().encode(["morning": record])
    let back = try JSONDecoder().decode([String: AlarmRecord].self, from: data)
    XCTAssertEqual(back["morning"], record)
  }
}
