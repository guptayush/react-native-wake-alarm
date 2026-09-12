package com.wakealarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object RingNotification {
  const val CHANNEL_ID = "wake_alarm_ring"
  const val NOTIFICATION_ID = 0x57414B45 // "WAKE"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Alarm ringing"
      setSound(null, null)
      enableVibration(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      runCatching { setBypassDnd(true) }
    }
    runCatching { nm.createNotificationChannel(channel) }
  }

  fun build(context: Context, slot: Slot, withFullScreen: Boolean, degraded: Boolean = false): Notification {
    val open = if (degraded) {
      context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
    } else {
      Intent(context, WakeAlarmActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val openPi = PendingIntent.getActivity(context, 1, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val stop = Intent(context, RingService::class.java).setAction(RingService.ACTION_STOP).putExtra(RingService.EXTRA_SOURCE, "user")
    val stopPi = PendingIntent.getService(context, 2, stop, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val b = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_wake_alarm)
      .setContentTitle(slot.title)
      .setContentText(slot.body.ifEmpty { "Alarm" })
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(!degraded)
      .setAutoCancel(degraded)
      .setShowWhen(false)
      .setContentIntent(openPi)
    if (!degraded) b.addAction(0, "Stop", stopPi)
    if (withFullScreen && !degraded) b.setFullScreenIntent(openPi, true)
    return b.build()
  }

  fun notificationsEnabled(context: Context): Boolean =
    runCatching { NotificationManagerCompat.from(context).areNotificationsEnabled() }.getOrDefault(false)
}
