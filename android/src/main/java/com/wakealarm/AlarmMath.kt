package com.wakealarm

import java.util.Calendar
import java.util.TimeZone

object AlarmMath {
  fun isoToCalendarDay(iso: Int): Int = if (iso == 7) Calendar.SUNDAY else iso + 1

  private fun atWallClock(baseMs: Long, hour: Int, minute: Int, zone: TimeZone): Calendar =
    Calendar.getInstance(zone).apply {
      timeInMillis = baseMs
      set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }

  fun nextFireAt(nowMs: Long, hour: Int, minute: Int, isoWeekday: Int?, zone: TimeZone = TimeZone.getDefault()): Long {
    val cal = atWallClock(nowMs, hour, minute, zone)
    if (isoWeekday == null) {
      if (cal.timeInMillis <= nowMs) cal.add(Calendar.DAY_OF_MONTH, 1)
      return cal.timeInMillis
    }
    var delta = (isoToCalendarDay(isoWeekday) - cal.get(Calendar.DAY_OF_WEEK) + 7) % 7
    if (delta == 0 && cal.timeInMillis <= nowMs) delta = 7
    cal.add(Calendar.DAY_OF_MONTH, delta)
    return cal.timeInMillis
  }

  fun plusOneWeek(fireAtMs: Long, hour: Int, minute: Int, zone: TimeZone = TimeZone.getDefault()): Long =
    atWallClock(fireAtMs, hour, minute, zone).apply { add(Calendar.WEEK_OF_YEAR, 1) }.timeInMillis
}
