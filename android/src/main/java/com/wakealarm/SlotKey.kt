package com.wakealarm

import android.net.Uri

data class SlotKey(val alarmId: String, val weekday: Int?) {
  fun encode(): String = "$alarmId:${weekday ?: ONCE}"
  fun toUri(): Uri = Uri.parse("$SCHEME://slot/${encode()}")
  val requestCode: Int get() = encode().hashCode()

  companion object {
    const val SCHEME = "wakealarm"
    private const val ONCE = "once"
    private val ID = Regex("^[A-Za-z0-9_.-]{1,64}$")

    fun decode(raw: String): SlotKey? {
      val idx = raw.lastIndexOf(':')
      if (idx <= 0) return null
      val id = raw.substring(0, idx)
      val tail = raw.substring(idx + 1)
      if (!ID.matches(id)) return null
      if (tail == ONCE) return SlotKey(id, null)
      val day = tail.toIntOrNull() ?: return null
      return if (day in 1..7) SlotKey(id, day) else null
    }

    fun fromUri(uri: Uri?): SlotKey? = uri?.lastPathSegment?.let(::decode)
  }
}
