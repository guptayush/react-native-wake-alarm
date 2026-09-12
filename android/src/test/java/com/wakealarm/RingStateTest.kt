package com.wakealarm

import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RingStateTest {
  @After fun tearDown() = RingState.clear()

  @Test fun setThenJsonThenClear() {
    assertNull(RingState.toJson())
    RingState.set(Ringing("a", "T", "B", "{\"k\":\"v\"}", 10, 9, 600000, "chime"))
    val o = JSONObject(RingState.toJson()!!)
    assertEquals("a", o.getString("id")); assertEquals("T", o.getString("title")); assertEquals("B", o.getString("body"))
    assertEquals("v", o.getJSONObject("payload").getString("k"))
    assertEquals(10L, o.getLong("firedAt")); assertEquals(9L, o.getLong("scheduledFor"))
    RingState.clear()
    assertNull(RingState.current)
  }

  @Test fun emptyBodyAndBadPayloadAreOmitted() {
    RingState.set(Ringing("a", "T", "", "nope", 1, 1, 1000, ""))
    val o = JSONObject(RingState.toJson()!!)
    assertEquals(false, o.has("body")); assertEquals(false, o.has("payload"))
  }
}
