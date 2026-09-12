package com.wakealarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

class AlarmScheduler(private val context: Context, private val store: SlotStore) {
  private val app = context.applicationContext
  private val alarmManager: AlarmManager? get() = app.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

  fun canScheduleExact(): Boolean {
    val am = alarmManager ?: return false
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
  }

  /** Persists then arms every slot. Returns false if any arm was refused; slots stay persisted so a later re-arm can retry. */
  fun scheduleAll(slots: List<Slot>): Boolean {
    slots.forEach(store::put)
    return slots.map(::arm).all { it }
  }

  fun cancelAlarm(alarmId: String) {
    store.removeAlarm(alarmId).forEach(::disarm)
  }

  fun cancelAll() {
    store.all().forEach { disarm(it.key) }
    store.clear()
  }

  /** Re-derives every slot's instant from its wall-clock fields and arms it. Past-due one-offs are dropped. */
  fun rearmAll(nowMs: Long = System.currentTimeMillis()) {
    for (slot in store.all()) {
      if (slot.weekday == null && slot.nextFireAt <= nowMs) { store.remove(slot.key); continue }
      val next = AlarmMath.nextFireAt(nowMs, slot.hour, slot.minute, slot.weekday)
      val updated = slot.copy(nextFireAt = next)
      store.put(updated)
      arm(updated)
    }
  }

  /** Called by FireReceiver. Returns the slot to ring, after re-arming a weekly slot for next week or removing a one-off. */
  fun consumeFire(key: SlotKey, nowMs: Long = System.currentTimeMillis()): Slot? {
    val slot = store.get(key) ?: return null
    if (slot.weekday == null) {
      store.remove(key)
    } else {
      val next = AlarmMath.plusOneWeek(maxOf(slot.nextFireAt, nowMs), slot.hour, slot.minute)
      val updated = slot.copy(nextFireAt = next)
      store.put(updated)
      arm(updated)
    }
    return slot
  }

  private fun arm(slot: Slot): Boolean {
    val am = alarmManager ?: return false
    return try {
      am.setAlarmClock(AlarmManager.AlarmClockInfo(slot.nextFireAt, showIntent()), operation(slot.key))
      true
    } catch (_: SecurityException) {
      false
    } catch (_: Throwable) {
      false
    }
  }

  private fun disarm(key: SlotKey) {
    runCatching { alarmManager?.cancel(operation(key)) }
  }

  private fun operation(key: SlotKey): PendingIntent {
    val intent = Intent(app, FireReceiver::class.java).setAction(FireReceiver.ACTION_FIRE).setData(key.toUri())
    return PendingIntent.getBroadcast(app, key.requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun showIntent(): PendingIntent {
    val launch = app.packageManager.getLaunchIntentForPackage(app.packageName) ?: Intent()
    return PendingIntent.getActivity(app, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
