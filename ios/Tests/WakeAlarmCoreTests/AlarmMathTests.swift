import XCTest
@testable import WakeAlarmCore

final class AlarmMathTests: XCTestCase {
  private func cal(_ tz: String) -> Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: tz)!; return c }
  private func date(_ c: Calendar, _ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int) -> Date {
    c.date(from: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi))!
  }
  private func fmt(_ c: Calendar, _ d: Date) -> String {
    let f = DateFormatter(); f.calendar = c; f.timeZone = c.timeZone; f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd HH:mm EEE"; return f.string(from: d)
  }

  func testOnceLaterToday() {
    let c = cal("Asia/Kolkata")
    XCTAssertEqual(fmt(c, AlarmMath.nextFireDate(now: date(c, 2026, 9, 12, 5, 0), hour: 6, minute: 30, isoWeekday: nil, calendar: c)), "2026-09-12 06:30 Sat")
  }
  func testOncePassedRollsToTomorrow() {
    let c = cal("Asia/Kolkata")
    XCTAssertEqual(fmt(c, AlarmMath.nextFireDate(now: date(c, 2026, 9, 12, 6, 30), hour: 6, minute: 30, isoWeekday: nil, calendar: c)), "2026-09-13 06:30 Sun")
  }
  func testWeeklySameDayPassedGoesNextWeek() {
    let c = cal("Asia/Kolkata")
    XCTAssertEqual(fmt(c, AlarmMath.nextFireDate(now: date(c, 2026, 9, 12, 7, 0), hour: 6, minute: 30, isoWeekday: 6, calendar: c)), "2026-09-19 06:30 Sat")
  }
  func testWeeklySundayIsIsoSeven() {
    let c = cal("Asia/Kolkata")
    XCTAssertEqual(fmt(c, AlarmMath.nextFireDate(now: date(c, 2026, 9, 12, 7, 0), hour: 6, minute: 30, isoWeekday: 7, calendar: c)), "2026-09-13 06:30 Sun")
  }
  func testAcrossDstKeepsWallClock() {
    let c = cal("America/New_York")
    XCTAssertEqual(fmt(c, AlarmMath.nextFireDate(now: date(c, 2026, 3, 7, 12, 0), hour: 6, minute: 30, isoWeekday: 7, calendar: c)), "2026-03-08 06:30 Sun")
  }
}
