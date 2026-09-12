package com.wakealarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SlotKeyTest {
  @Test fun encodesWeeklyAndOnce() {
    assertEquals("morning:3", SlotKey("morning", 3).encode())
    assertEquals("morning:once", SlotKey("morning", null).encode())
  }
  @Test fun decodesRoundTrip() {
    assertEquals(SlotKey("a.b-c_d", 7), SlotKey.decode("a.b-c_d:7"))
    assertEquals(SlotKey("x", null), SlotKey.decode("x:once"))
  }
  @Test fun decodeRejectsGarbage() {
    assertNull(SlotKey.decode("nocolon"))
    assertNull(SlotKey.decode("a:8"))
    assertNull(SlotKey.decode("a:0"))
    assertNull(SlotKey.decode(":3"))
  }
  @Test fun uriAndRequestCodeAreStable() {
    val k = SlotKey("morning", 1)
    assertEquals("wakealarm://slot/morning:1", k.toUri().toString())
    assertEquals(k.requestCode, SlotKey.decode(k.encode())!!.requestCode)
  }
}
