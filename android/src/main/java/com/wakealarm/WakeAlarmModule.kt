package com.wakealarm

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class WakeAlarmModule(reactContext: ReactApplicationContext) : NativeWakeAlarmSpec(reactContext), RingEvents.Listener {
  private val app get() = reactApplicationContext.applicationContext
  private val store by lazy { SlotStore(app) }
  private val scheduler by lazy { AlarmScheduler(app, store) }
  private val requestCodes = AtomicInteger(0x5741)

  override fun initialize() { super.initialize(); RingEvents.add(this) }
  override fun invalidate() { RingEvents.remove(this); super.invalidate() }

  // ---- RingEvents.Listener -> JS events
  override fun onFired(id: String, at: Long) {
    emitOnFired(Arguments.createMap().apply { putString("id", id); putDouble("at", at.toDouble()) })
  }
  override fun onStopped(id: String, at: Long, source: String) {
    emitOnStopped(Arguments.createMap().apply { putString("id", id); putDouble("at", at.toDouble()); putString("source", source) })
  }
  override fun onPermissionChanged(gate: String, value: String) {
    emitOnPermissionChanged(Arguments.createMap().apply { putString("gate", gate); putString("value", value) })
  }

  // ---- scheduling
  override fun schedule(input: ReadableMap, promise: Promise) {
    try {
      val id = input.getString("id") ?: return promise.resolve(failed("invalid_input", "id missing"))
      if (!input.hasKey("hour") || !input.hasKey("minute") || !input.hasKey("maxRingMs")) {
        return promise.resolve(failed("invalid_input", "hour, minute and maxRingMs are required"))
      }
      if (!scheduler.canScheduleExact()) return promise.resolve(failed("no_exact_alarm_permission"))
      val days = input.getArray("days")?.let { a -> (0 until a.size()).map { a.getInt(it) } } ?: emptyList()
      val hour = input.getInt("hour"); val minute = input.getInt("minute")
      val now = System.currentTimeMillis()
      val base = Slot(
        alarmId = id, hour = hour, minute = minute, weekday = null,
        title = input.getString("title") ?: "", body = input.getString("body") ?: "", sound = input.getString("sound") ?: "",
        payloadJson = input.getString("payloadJson") ?: "{}", maxRingMs = input.getDouble("maxRingMs").toLong(), nextFireAt = 0,
        vibrate = if (input.hasKey("vibrate")) input.getBoolean("vibrate") else true,
      )
      val slots = if (days.isEmpty()) listOf(base.copy(nextFireAt = AlarmMath.nextFireAt(now, hour, minute, null)))
        else days.map { d -> base.copy(weekday = d, nextFireAt = AlarmMath.nextFireAt(now, hour, minute, d)) }
      scheduler.cancelAlarm(id)
      if (!scheduler.scheduleAll(slots)) return promise.resolve(failed("native_error", "AlarmManager refused setAlarmClock"))
      val next = slots.minOf { it.nextFireAt }
      val result = Arguments.createMap().apply {
        putString("backend", "alarm_manager"); putDouble("nextFireAt", next.toDouble()); putString("message", "")
        when {
          PermissionGates.notifications(app) == PermissionGates.DENIED -> { putString("status", "ok_degraded"); putString("reason", "no_notification_permission") }
          PermissionGates.fullScreenIntent(app) == PermissionGates.DENIED -> { putString("status", "ok_degraded"); putString("reason", "no_full_screen_intent") }
          else -> { putString("status", "ok"); putString("reason", "") }
        }
      }
      promise.resolve(result)
    } catch (t: Throwable) {
      promise.resolve(failed("native_error", t.message ?: t.javaClass.simpleName))
    }
  }

  override fun cancel(id: String, promise: Promise) = safely(promise) { scheduler.cancelAlarm(id); null }
  override fun cancelAll(promise: Promise) = safely(promise) { scheduler.cancelAll(); null }

  override fun getScheduled(promise: Promise) = safely(promise) {
    val arr = Arguments.createArray()
    store.all().groupBy { it.alarmId }.values.forEach { slots ->
      val s = slots.minBy { it.nextFireAt }
      arr.pushMap(Arguments.createMap().apply {
        putString("id", s.alarmId); putInt("hour", s.hour); putInt("minute", s.minute)
        putArray("days", Arguments.createArray().also { a -> slots.mapNotNull { it.weekday }.sorted().forEach(a::pushInt) })
        putString("title", s.title); putString("body", s.body); putString("sound", s.sound); putString("payloadJson", s.payloadJson)
        putDouble("maxRingMs", s.maxRingMs.toDouble()); putDouble("nextFireAt", s.nextFireAt.toDouble()); putString("backend", "alarm_manager")
        putBoolean("vibrate", s.vibrate)
      })
    }
    arr
  }

  // ---- permissions
  private fun status(): WritableMap = Arguments.createMap().apply {
    putString("notifications", PermissionGates.notifications(app))
    putString("exactAlarm", PermissionGates.exactAlarm(app))
    putString("fullScreenIntent", PermissionGates.fullScreenIntent(app))
    putString("batteryUnrestricted", PermissionGates.batteryUnrestricted(app))
    putString("backgroundPopup", PermissionGates.backgroundPopup())
    putString("alarmKit", PermissionGates.NOT_APPLICABLE)
  }

  override fun getPermissionStatus(promise: Promise) = safely(promise) { status() }

  override fun requestPermissions(promise: Promise) {
    val activity = reactApplicationContext.currentActivity as? PermissionAwareActivity
    val needsPrompt = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      app.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    if (activity == null || !needsPrompt) return promise.resolve(status())
    val code = requestCodes.incrementAndGet()
    val resolved = AtomicBoolean(false)
    val listener = PermissionListener { requestCode, _, _ ->
      if (requestCode == code) { if (resolved.compareAndSet(false, true)) promise.resolve(status()); true } else false
    }
    runCatching { activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), code, listener) }
      .onFailure { if (resolved.compareAndSet(false, true)) promise.resolve(status()) }
  }

  override fun openSettings(kind: String, promise: Promise) = safely(promise) {
    val intent = SettingsIntents.intentFor(app, kind) ?: return@safely null
    (reactApplicationContext.currentActivity ?: app).startActivity(intent)
    null
  }

  // ---- ring lifecycle
  override fun getRingingJson(): String? = RingState.toJson()
  override fun stopRinging(promise: Promise) = safely(promise) { RingService.stop(app, "api"); null }
  override fun consumePendingActionJson(): String? = PendingActionStore(app).consumeJson()

  // ---- helpers
  private inline fun safely(promise: Promise, block: () -> Any?) {
    try { promise.resolve(block()) } catch (t: Throwable) { promise.reject("native_error", t.message ?: t.javaClass.simpleName, t) }
  }

  private fun failed(reason: String, message: String = ""): WritableMap = Arguments.createMap().apply {
    putString("status", "failed"); putString("backend", ""); putString("reason", reason); putDouble("nextFireAt", 0.0); putString("message", message)
  }

  companion object { const val NAME = NativeWakeAlarmSpec.NAME }
}
