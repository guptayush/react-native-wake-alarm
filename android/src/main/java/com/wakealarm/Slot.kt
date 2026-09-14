package com.wakealarm

import org.json.JSONObject

data class Slot(
  val alarmId: String,
  val hour: Int,
  val minute: Int,
  val weekday: Int?,
  val title: String,
  val body: String,
  val sound: String,
  val payloadJson: String,
  val maxRingMs: Long,
  val nextFireAt: Long,
  val vibrate: Boolean = true,
) {
  val key: SlotKey get() = SlotKey(alarmId, weekday)

  fun toJson(): String = JSONObject().apply {
    put("alarmId", alarmId); put("hour", hour); put("minute", minute)
    if (weekday != null) put("weekday", weekday)
    put("title", title); put("body", body); put("sound", sound)
    put("payloadJson", payloadJson); put("maxRingMs", maxRingMs); put("nextFireAt", nextFireAt)
    put("vibrate", vibrate)
  }.toString()

  companion object {
    fun fromJson(raw: String): Slot? = try {
      val o = JSONObject(raw)
      Slot(
        alarmId = o.getString("alarmId"), hour = o.getInt("hour"), minute = o.getInt("minute"),
        weekday = if (o.has("weekday")) o.getInt("weekday") else null,
        title = o.getString("title"), body = o.optString("body", ""), sound = o.optString("sound", ""),
        payloadJson = o.optString("payloadJson", "{}"), maxRingMs = o.getLong("maxRingMs"), nextFireAt = o.getLong("nextFireAt"),
        // Records written before 1.1 have no key and must keep vibrating.
        vibrate = o.optBoolean("vibrate", true),
      )
    } catch (_: Throwable) { null }
  }
}
