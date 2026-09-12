package com.wakealarm

import android.content.Context
import android.content.SharedPreferences

class SlotStore(context: Context) {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences("wake_alarm_slots_v1", Context.MODE_PRIVATE)

  fun put(slot: Slot) { prefs.edit().putString(slot.key.encode(), slot.toJson()).commit() }
  fun get(key: SlotKey): Slot? = prefs.getString(key.encode(), null)?.let(Slot::fromJson)
  fun remove(key: SlotKey) { prefs.edit().remove(key.encode()).commit() }

  fun removeAlarm(alarmId: String): List<SlotKey> {
    val keys = prefs.all.keys.mapNotNull(SlotKey::decode).filter { it.alarmId == alarmId }
    val e = prefs.edit(); keys.forEach { e.remove(it.encode()) }; e.commit()
    return keys
  }

  fun all(): List<Slot> = prefs.all.values.mapNotNull { (it as? String)?.let(Slot::fromJson) }
  fun clear() { prefs.edit().clear().commit() }
}
