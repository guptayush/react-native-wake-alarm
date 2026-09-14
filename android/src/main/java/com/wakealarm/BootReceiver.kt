package com.wakealarm

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in HANDLED) return
    runCatching { AlarmScheduler(context, SlotStore(context)).rearmAll() }
    // Informational only: nothing is parked for it, a JS listener that is not attached simply misses it.
    if (intent.action == AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED) {
      RingEvents.emitPermissionChanged(GATE_EXACT_ALARM, PermissionGates.exactAlarm(context))
    }
  }

  companion object {
    const val GATE_EXACT_ALARM = "exactAlarm"
    private val HANDLED = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_TIME_CHANGED,
      AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED,
    )
  }
}
