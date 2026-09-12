package com.wakealarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat

object PermissionGates {
  const val GRANTED = "granted"; const val DENIED = "denied"; const val NOT_APPLICABLE = "not_applicable"

  fun notifications(c: Context): String =
    if (runCatching { NotificationManagerCompat.from(c).areNotificationsEnabled() }.getOrDefault(false)) GRANTED else DENIED

  fun exactAlarm(c: Context): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return NOT_APPLICABLE
    val am = c.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return DENIED
    return if (runCatching { am.canScheduleExactAlarms() }.getOrDefault(false)) GRANTED else DENIED
  }

  fun fullScreenIntent(c: Context): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return NOT_APPLICABLE
    val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return DENIED
    return if (runCatching { nm.canUseFullScreenIntent() }.getOrDefault(false)) GRANTED else DENIED
  }

  fun batteryUnrestricted(c: Context): String {
    val pm = c.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return DENIED
    return if (runCatching { pm.isIgnoringBatteryOptimizations(c.packageName) }.getOrDefault(false)) GRANTED else DENIED
  }
}
