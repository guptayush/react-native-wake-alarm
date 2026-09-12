package com.wakealarm

import android.app.AlarmManager
import android.content.Context
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AlarmSchedulerTest {
  private val zone = TimeZone.getTimeZone("Asia/Kolkata")
  private lateinit var originalZone: TimeZone
  private lateinit var context: Context
  private lateinit var store: SlotStore
  private lateinit var alarmManager: AlarmManager

  @Before fun setUp() {
    originalZone = TimeZone.getDefault()
    TimeZone.setDefault(zone)
    context = RuntimeEnvironment.getApplication()
    store = SlotStore(context)
    store.clear()
    alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  }

  @After fun tearDown() {
    store.clear()
    TimeZone.setDefault(originalZone)
  }

  private fun at(y: Int, m: Int, d: Int, h: Int, min: Int): Long =
    Calendar.getInstance(zone).apply { clear(); set(y, m - 1, d, h, min, 0) }.timeInMillis

  private fun fmt(ms: Long): String =
    SimpleDateFormat("yyyy-MM-dd HH:mm EEE", Locale.US).apply { timeZone = zone }.format(ms)

  private fun slot(id: String, weekday: Int?, nextFireAt: Long) =
    Slot(id, 6, 30, weekday, "T", "", "", "{}", 600_000, nextFireAt)

  private fun scheduler(armer: ExactAlarmArmer? = null) =
    if (armer == null) AlarmScheduler(context, store) else AlarmScheduler(context, store, armer)

  private fun armedTriggers(): List<String> = shadowOf(alarmManager).scheduledAlarms.map { fmt(it.triggerAtMs) }

  // 2026-09-14 is a Monday (ISO 1).
  private val monday = at(2026, 9, 14, 6, 30)

  @Test fun consumeFireOnTimeReArmsTheWeeklySlotOneWeekLater() {
    val key = SlotKey("a", 1)
    store.put(slot("a", 1, monday))
    val fired = scheduler().consumeFire(key, nowMs = monday)
    assertEquals(monday, fired!!.nextFireAt)
    assertEquals("2026-09-21 06:30 Mon", fmt(store.get(key)!!.nextFireAt))
    assertEquals(listOf("2026-09-21 06:30 Mon"), armedTriggers())
  }

  @Test fun consumeFireOneDayLateStaysOnTheSlotsWeekday() {
    val key = SlotKey("a", 1)
    store.put(slot("a", 1, monday))
    scheduler().consumeFire(key, nowMs = at(2026, 9, 15, 8, 0)) // Tuesday
    assertEquals("2026-09-21 06:30 Mon", fmt(store.get(key)!!.nextFireAt))
    assertEquals(listOf("2026-09-21 06:30 Mon"), armedTriggers())
  }

  @Test fun consumeFireEightDaysLateSkipsTheMissedWeekButKeepsTheWeekday() {
    val key = SlotKey("a", 1)
    store.put(slot("a", 1, monday))
    scheduler().consumeFire(key, nowMs = at(2026, 9, 22, 8, 0)) // Tuesday, eight days on
    assertEquals("2026-09-28 06:30 Mon", fmt(store.get(key)!!.nextFireAt))
    assertEquals(listOf("2026-09-28 06:30 Mon"), armedTriggers())
  }

  @Test fun consumeFireRemovesAOneOffAndReturnsIt() {
    val key = SlotKey("o", null)
    store.put(slot("o", null, monday))
    val fired = scheduler().consumeFire(key, nowMs = monday)
    assertEquals("o", fired!!.alarmId)
    assertNull(store.get(key))
    assertTrue(armedTriggers().isEmpty())
  }

  @Test fun consumeFireForAnUnknownKeyReturnsNull() {
    assertNull(scheduler().consumeFire(SlotKey("missing", null), nowMs = monday))
  }

  @Test fun rearmAllDropsAPastDueOneOffAndRollsAWeeklySlotForward() {
    store.put(slot("late", null, at(2026, 9, 13, 6, 30)))
    store.put(slot("soon", null, at(2026, 9, 15, 6, 30)))
    store.put(slot("weekly", 1, at(2026, 9, 7, 6, 30))) // a Monday already in the past
    scheduler().rearmAll(nowMs = monday + 60_000) // Monday 06:31
    assertNull(store.get(SlotKey("late", null)))
    assertEquals("2026-09-15 06:30 Tue", fmt(store.get(SlotKey("soon", null))!!.nextFireAt))
    assertEquals("2026-09-21 06:30 Mon", fmt(store.get(SlotKey("weekly", 1))!!.nextFireAt))
    assertEquals(listOf("2026-09-15 06:30 Tue", "2026-09-21 06:30 Mon"), armedTriggers().sorted())
  }

  @Test fun scheduleAllRollsBackWhenTheSecondArmIsRefused() {
    val real = AlarmManagerArmer(alarmManager)
    var calls = 0
    val refusesSecond = ExactAlarmArmer { triggerAtMs, showIntent, operation ->
      calls += 1
      if (calls == 2) false else real.arm(triggerAtMs, showIntent, operation)
    }
    val slots = listOf(slot("w", 1, monday), slot("w", 3, at(2026, 9, 16, 6, 30)), slot("w", 5, at(2026, 9, 18, 6, 30)))
    assertFalse(scheduler(refusesSecond).scheduleAll(slots))
    assertEquals(2, calls)
    assertTrue(store.all().isEmpty())
    assertTrue(shadowOf(alarmManager).scheduledAlarms.isEmpty())
  }

  @Test fun scheduleAllArmsEverySlotWhenNothingIsRefused() {
    val slots = listOf(slot("w", 1, monday), slot("w", 3, at(2026, 9, 16, 6, 30)))
    assertTrue(scheduler().scheduleAll(slots))
    assertEquals(2, store.all().size)
    assertEquals(listOf("2026-09-14 06:30 Mon", "2026-09-16 06:30 Wed"), armedTriggers().sorted())
    val first = shadowOf(alarmManager).scheduledAlarms.first()
    assertEquals(AlarmManager.RTC_WAKEUP, first.getType())
  }

  @Test fun cancelAlarmDisarmsAndForgetsEverySlotOfThatId() {
    scheduler().scheduleAll(listOf(slot("w", 1, monday), slot("w", 3, at(2026, 9, 16, 6, 30))))
    scheduler().scheduleAll(listOf(slot("other", null, at(2026, 9, 15, 6, 30))))
    scheduler().cancelAlarm("w")
    assertEquals(listOf("other"), store.all().map { it.alarmId })
    assertEquals(listOf("2026-09-15 06:30 Tue"), armedTriggers())
  }
}
