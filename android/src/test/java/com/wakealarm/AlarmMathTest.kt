package com.wakealarm

import org.junit.Assert.assertEquals
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class AlarmMathTest {
  private val kolkata = TimeZone.getTimeZone("Asia/Kolkata")
  private val newYork = TimeZone.getTimeZone("America/New_York")

  private fun at(zone: TimeZone, y: Int, m: Int, d: Int, h: Int, min: Int): Long =
    Calendar.getInstance(zone).apply { clear(); set(y, m - 1, d, h, min, 0) }.timeInMillis

  private fun fmt(zone: TimeZone, ms: Long): String =
    SimpleDateFormat("yyyy-MM-dd HH:mm EEE", Locale.US).apply { timeZone = zone }.format(ms)

  @Test fun onceLaterTodayStaysToday() {
    val now = at(kolkata, 2026, 9, 12, 5, 0)
    assertEquals("2026-09-12 06:30 Sat", fmt(kolkata, AlarmMath.nextFireAt(now, 6, 30, null, kolkata)))
  }
  @Test fun onceAlreadyPassedRollsToTomorrow() {
    val now = at(kolkata, 2026, 9, 12, 6, 30)
    assertEquals("2026-09-13 06:30 Sun", fmt(kolkata, AlarmMath.nextFireAt(now, 6, 30, null, kolkata)))
  }
  @Test fun weeklySameDayLaterToday() {
    val now = at(kolkata, 2026, 9, 12, 5, 0) // Saturday = ISO 6
    assertEquals("2026-09-12 06:30 Sat", fmt(kolkata, AlarmMath.nextFireAt(now, 6, 30, 6, kolkata)))
  }
  @Test fun weeklySameDayAlreadyPassedGoesNextWeek() {
    val now = at(kolkata, 2026, 9, 12, 7, 0)
    assertEquals("2026-09-19 06:30 Sat", fmt(kolkata, AlarmMath.nextFireAt(now, 6, 30, 6, kolkata)))
  }
  @Test fun weeklyOtherDayAndSundayIsIsoSeven() {
    val now = at(kolkata, 2026, 9, 12, 7, 0)
    assertEquals("2026-09-13 06:30 Sun", fmt(kolkata, AlarmMath.nextFireAt(now, 6, 30, 7, kolkata)))
    assertEquals("2026-09-14 06:30 Mon", fmt(kolkata, AlarmMath.nextFireAt(now, 6, 30, 1, kolkata)))
  }
  @Test fun weeklyAcrossDstKeepsWallClock() {
    // US DST starts 2026-03-08 02:00 in New York.
    val now = at(newYork, 2026, 3, 7, 12, 0) // Saturday
    val sunday = AlarmMath.nextFireAt(now, 6, 30, 7, newYork)
    assertEquals("2026-03-08 06:30 Sun", fmt(newYork, sunday))
    assertEquals("2026-03-15 06:30 Sun", fmt(newYork, AlarmMath.plusOneWeek(sunday, 6, 30, newYork)))
    // 23-hour day: the delta is not 7*24h.
    assertEquals(7L * 24 * 3600 * 1000 - 3600 * 1000, AlarmMath.plusOneWeek(at(newYork, 2026, 3, 1, 6, 30), 6, 30, newYork) - at(newYork, 2026, 3, 1, 6, 30))
  }
  @Test fun isoToCalendarDay() {
    assertEquals(Calendar.MONDAY, AlarmMath.isoToCalendarDay(1))
    assertEquals(Calendar.SATURDAY, AlarmMath.isoToCalendarDay(6))
    assertEquals(Calendar.SUNDAY, AlarmMath.isoToCalendarDay(7))
  }
}
