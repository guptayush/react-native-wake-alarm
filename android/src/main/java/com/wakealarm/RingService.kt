package com.wakealarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

class RingService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var player: RingPlayer? = null
  private var timeout: Runnable? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> { stopRing(intent.getStringExtra(EXTRA_SOURCE) ?: "user"); return START_NOT_STICKY }
      ACTION_START -> {
        val slot = intent.getStringExtra(EXTRA_SLOT)?.let(Slot::fromJson)
        if (slot == null) { stopSelf(); return START_NOT_STICKY }
        startRing(slot)
        return START_NOT_STICKY
      }
      else -> { stopSelf(); return START_NOT_STICKY }
    }
  }

  private fun startRing(slot: Slot) {
    val now = System.currentTimeMillis()
    RingState.set(Ringing(slot.alarmId, slot.title, slot.body, slot.payloadJson, now, slot.nextFireAt, slot.maxRingMs, slot.sound))
    RingNotification.ensureChannel(this)
    val notification = RingNotification.build(this, slot, withFullScreen = true)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(RingNotification.NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
      } else {
        startForeground(RingNotification.NOTIFICATION_ID, notification)
      }
    } catch (_: Throwable) {
      runCatching { NotificationManagerCompat.from(this).notify(RingNotification.NOTIFICATION_ID, notification) }
    }
    player = RingPlayer(this).also { it.start(slot.sound) }
    startVibration()
    timeout = Runnable { stopRing("timeout") }.also { handler.postDelayed(it, slot.maxRingMs) }
    WakeLocks.release()
    if (RingEvents.hasListeners()) RingEvents.emitFired(slot.alarmId, now) else PendingActionStore(this).record(slot.alarmId, "fired", now)
  }

  private fun stopRing(source: String) {
    val ringing = RingState.current
    timeout?.let(handler::removeCallbacks); timeout = null
    player?.stop(); player = null
    stopVibration()
    RingState.clear()
    val at = System.currentTimeMillis()
    if (ringing != null) {
      if (RingEvents.hasListeners()) RingEvents.emitStopped(ringing.id, at, source) else PendingActionStore(this).record(ringing.id, "stopped", at)
    }
    runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
    runCatching { NotificationManagerCompat.from(this).cancel(RingNotification.NOTIFICATION_ID) }
    WakeLocks.release()
    stopSelf()
  }

  private fun vibrator(): Vibrator? = runCatching {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    else @Suppress("DEPRECATION") getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
  }.getOrNull()

  private fun startVibration() = runCatching {
    vibrator()?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 700, 400), 1))
  }

  private fun stopVibration() = runCatching { vibrator()?.cancel() }

  override fun onDestroy() {
    timeout?.let(handler::removeCallbacks)
    player?.stop()
    stopVibration()
    super.onDestroy()
  }

  companion object {
    const val ACTION_START = "com.wakealarm.RING_START"
    const val ACTION_STOP = "com.wakealarm.RING_STOP"
    const val EXTRA_SLOT = "slot"
    const val EXTRA_SOURCE = "source"

    fun start(context: Context, slot: Slot) {
      val intent = Intent(context, RingService::class.java).setAction(ACTION_START).putExtra(EXTRA_SLOT, slot.toJson())
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context, source: String) {
      val intent = Intent(context, RingService::class.java).setAction(ACTION_STOP).putExtra(EXTRA_SOURCE, source)
      runCatching { context.startService(intent) }
    }

    fun postDegraded(context: Context, slot: Slot) {
      RingNotification.ensureChannel(context)
      runCatching { NotificationManagerCompat.from(context).notify(RingNotification.NOTIFICATION_ID, RingNotification.build(context, slot, withFullScreen = false)) }
    }
  }
}
