package com.wakealarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.media.AudioAttributes
import android.os.CombinedVibration
import android.os.Looper
import android.os.VibrationAttributes
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
    val previous = RingState.current
    val now = System.currentTimeMillis()
    // Publish the new session before tearing down the old one: the activity's stopped listener
    // finishes only while RingState is null, so a superseding alarm keeps the screen up.
    RingState.set(Ringing(slot.alarmId, slot.title, slot.body, slot.payloadJson, now, slot.nextFireAt, slot.maxRingMs, slot.sound))
    if (previous != null) {
      stopPlayback()
      deliverStopped(previous.id, "superseded")
    }
    RingNotification.ensureChannel(this)
    val notification = RingNotification.build(this, slot, withFullScreen = true)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(RingNotification.NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
      } else {
        startForeground(RingNotification.NOTIFICATION_ID, notification)
      }
    }
    // Without foreground status the OS kills this process within seconds; stop cleanly and leave a notification instead.
    catch (_: Throwable) {
      runCatching {
        NotificationManagerCompat.from(this)
          .notify(RingNotification.NOTIFICATION_ID, RingNotification.build(this, slot, withFullScreen = false, degraded = true))
      }
      PendingActionStore(this).record(slot.alarmId, "fired", now)
      RingState.clear()
      WakeLocks.release()
      stopSelf()
      return
    }
    player = RingPlayer(this).also { it.start(slot.sound) }
    if (slot.vibrate) startVibration()
    timeout = Runnable { stopRing("timeout") }.also { handler.postDelayed(it, slot.maxRingMs) }
    WakeLocks.release()
    deliverFired(slot.alarmId, now)
  }

  private fun stopRing(source: String) {
    tearDownSession(source)
    runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
    runCatching { NotificationManagerCompat.from(this).cancel(RingNotification.NOTIFICATION_ID) }
    WakeLocks.release()
    stopSelf()
  }

  private fun tearDownSession(source: String) {
    val ringing = RingState.current
    stopPlayback()
    RingState.clear()
    if (ringing != null) deliverStopped(ringing.id, source)
  }

  private fun stopPlayback() {
    timeout?.let(handler::removeCallbacks); timeout = null
    player?.stop(); player = null
    stopVibration()
  }

  // Always park and always emit: JS may not exist yet, or may exist without a listener attached.
  // A live listener clears the parked copy on delivery; consumePendingAction() picks it up otherwise.
  private fun deliverFired(id: String, at: Long) {
    PendingActionStore(this).record(id, "fired", at)
    RingEvents.emitFired(id, at)
  }

  private fun deliverStopped(id: String, source: String) {
    val at = System.currentTimeMillis()
    PendingActionStore(this).record(id, "stopped", at)
    RingEvents.emitStopped(id, at, source)
  }

  private fun vibratorManager(): VibratorManager? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) runCatching { getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager }.getOrNull() else null

  private fun vibrator(): Vibrator? = runCatching {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) vibratorManager()?.defaultVibrator
    else @Suppress("DEPRECATION") getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
  }.getOrNull()

  // USAGE_ALARM attributes: an attribute-less vibration is one some OEMs mute under Do Not Disturb.
  private fun startVibration() = runCatching {
    val effect = VibrationEffect.createWaveform(longArrayOf(0, 700, 400), 1)
    val manager = vibratorManager()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && manager != null) {
      manager.vibrate(CombinedVibration.createParallel(effect), VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
    } else {
      // Deprecated in 33, but the only attributed overload available from 26 to 32.
      @Suppress("DEPRECATION")
      vibrator()?.vibrate(effect, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
    }
  }

  private fun stopVibration() = runCatching {
    val manager = vibratorManager()
    if (manager != null) manager.cancel() else vibrator()?.cancel()
  }

  override fun onDestroy() {
    tearDownSession("api")
    runCatching { NotificationManagerCompat.from(this).cancel(RingNotification.NOTIFICATION_ID) }
    WakeLocks.release()
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
      // Nothing ringing means no service to reach; a fresh instance would only be created to stop itself.
      if (RingState.current == null) return
      val intent = Intent(context, RingService::class.java).setAction(ACTION_STOP).putExtra(EXTRA_SOURCE, source)
      // The service is already in the foreground, and a foreground start is never refused from the background.
      runCatching { ContextCompat.startForegroundService(context, intent) }
    }

    fun postDegraded(context: Context, slot: Slot) {
      RingNotification.ensureChannel(context)
      runCatching {
        NotificationManagerCompat.from(context)
          .notify(RingNotification.NOTIFICATION_ID, RingNotification.build(context, slot, withFullScreen = false, degraded = true))
      }
      PendingActionStore(context).record(slot.alarmId, "fired", System.currentTimeMillis())
    }
  }
}
