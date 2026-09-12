package com.wakealarm

import org.json.JSONObject

data class Ringing(
  val id: String, val title: String, val body: String, val payloadJson: String,
  val firedAt: Long, val scheduledFor: Long, val maxRingMs: Long, val sound: String,
)

object RingState {
  @Volatile var current: Ringing? = null
    private set

  fun set(r: Ringing) { current = r }
  fun clear() { current = null }

  fun toJson(): String? = current?.let { r ->
    JSONObject().apply {
      put("id", r.id); put("title", r.title)
      if (r.body.isNotEmpty()) put("body", r.body)
      runCatching { JSONObject(r.payloadJson) }.getOrNull()?.takeIf { it.length() > 0 }?.let { put("payload", it) }
      put("firedAt", r.firedAt); put("scheduledFor", r.scheduledFor)
    }.toString()
  }
}
