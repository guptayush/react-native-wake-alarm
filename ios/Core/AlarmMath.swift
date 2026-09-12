import Foundation

public enum AlarmMath {
  public static func nextFireDate(now: Date, hour: Int, minute: Int, isoWeekday: Int?, calendar: Calendar) -> Date {
    var comps = DateComponents(hour: hour, minute: minute, second: 0)
    if let iso = isoWeekday { comps.weekday = WakeAlarmIds.weekday(fromIso: iso) }
    // nextDate never returns `now` itself, so an alarm at exactly this minute rolls forward, matching Android.
    return calendar.nextDate(after: now, matching: comps, matchingPolicy: .nextTimePreservingSmallerComponents, direction: .forward) ?? now
  }
}
