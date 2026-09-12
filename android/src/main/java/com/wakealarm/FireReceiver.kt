package com.wakealarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class FireReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_FIRE) return
    val key = SlotKey.fromUri(intent.data) ?: return
    WakeLocks.acquire(context)
    try {
      val slot = AlarmScheduler(context, SlotStore(context)).consumeFire(key) ?: run { WakeLocks.release(); return }
      try {
        RingService.start(context, slot)
      } catch (_: Throwable) {
        // Foreground start refused (exact-alarm permission revoked after arming, or an OEM quirk):
        // fall back to a plain notification so the member is still told. No audio in this path.
        RingService.postDegraded(context, slot)
        WakeLocks.release()
      }
    } catch (_: Throwable) {
      WakeLocks.release()
    }
  }

  companion object { const val ACTION_FIRE = "com.wakealarm.FIRE" }
}
