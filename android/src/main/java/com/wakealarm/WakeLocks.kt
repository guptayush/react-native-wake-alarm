package com.wakealarm

import android.content.Context
import android.os.PowerManager

object WakeLocks {
  private const val TAG = "wakealarm:fire"
  private const val MAX_HOLD_MS = 60_000L
  private var lock: PowerManager.WakeLock? = null

  @Synchronized fun acquire(context: Context) {
    if (lock?.isHeld == true) return
    val pm = context.applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG).apply {
      setReferenceCounted(false)
      runCatching { acquire(MAX_HOLD_MS) }
    }
  }

  @Synchronized fun release() {
    lock?.let { if (it.isHeld) runCatching { it.release() } }
    lock = null
  }
}
