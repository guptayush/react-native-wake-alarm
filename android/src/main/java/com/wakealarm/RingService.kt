package com.wakealarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder

class RingService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null
  companion object {
    fun start(context: Context, slot: Slot) {}
    fun postDegraded(context: Context, slot: Slot) {}
  }
}
