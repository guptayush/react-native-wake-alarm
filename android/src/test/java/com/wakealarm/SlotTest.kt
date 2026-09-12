package com.wakealarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SlotTest {
  private val slot = Slot("morning", 6, 30, 3, "Yoga", "Class soon", "chime", "{\"k\":\"v\"}", 600000L, 1_800_000_000_000L)

  @Test fun jsonRoundTrip() {
    assertEquals(slot, Slot.fromJson(slot.toJson()))
    assertEquals(slot.copy(weekday = null), Slot.fromJson(slot.copy(weekday = null).toJson()))
  }
  @Test fun keyDerivesFromIdAndWeekday() {
    assertEquals(SlotKey("morning", 3), slot.key)
  }
  @Test fun fromJsonRejectsGarbage() {
    assertNull(Slot.fromJson("not json"))
    assertNull(Slot.fromJson("{\"id\":\"x\"}"))
  }
}
