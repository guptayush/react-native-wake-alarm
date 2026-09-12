package com.wakealarm

import android.content.Context
import org.json.JSONObject

class PendingActionStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("wake_alarm_pending_v1", Context.MODE_PRIVATE)

  fun record(id: String, action: String, at: Long) {
    val json = JSONObject().put("id", id).put("action", action).put("at", at).toString()
    prefs.edit().putString(KEY, json).commit()
  }

  fun consumeJson(): String? {
    val v = prefs.getString(KEY, null) ?: return null
    prefs.edit().remove(KEY).commit()
    return v
  }

  private companion object { const val KEY = "pending" }
}
