package com.wakealarm

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test

class RingEventsTest {
  private val seen = mutableListOf<String>()
  private val listener = object : RingEvents.Listener {
    override fun onFired(id: String, at: Long) { seen += "fired:$id:$at" }
    override fun onStopped(id: String, at: Long, source: String) { seen += "stopped:$id:$at:$source" }
  }
  @After fun tearDown() { RingEvents.remove(listener) }

  @Test fun deliversToRegisteredListenersOnly() {
    RingEvents.add(listener)
    RingEvents.emitFired("a", 1)
    RingEvents.emitStopped("a", 2, "user")
    RingEvents.remove(listener)
    RingEvents.emitFired("b", 3)
    assertEquals(listOf("fired:a:1", "stopped:a:2:user"), seen)
  }

  @Test fun aThrowingListenerDoesNotBreakOthers() {
    val bad = object : RingEvents.Listener {
      override fun onFired(id: String, at: Long) { throw IllegalStateException("boom") }
      override fun onStopped(id: String, at: Long, source: String) {}
    }
    RingEvents.add(bad); RingEvents.add(listener)
    RingEvents.emitFired("a", 1)
    RingEvents.remove(bad)
    assertEquals(listOf("fired:a:1"), seen)
  }
}
