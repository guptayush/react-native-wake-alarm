package com.wakealarm

import java.util.concurrent.CopyOnWriteArraySet

object RingEvents {
  interface Listener {
    fun onFired(id: String, at: Long)
    fun onStopped(id: String, at: Long, source: String)
    fun onPermissionChanged(gate: String, value: String) {}
  }

  private val listeners = CopyOnWriteArraySet<Listener>()

  fun add(l: Listener) { listeners.add(l) }
  fun remove(l: Listener) { listeners.remove(l) }

  fun emitFired(id: String, at: Long) = listeners.forEach { runCatching { it.onFired(id, at) } }
  fun emitStopped(id: String, at: Long, source: String) = listeners.forEach { runCatching { it.onStopped(id, at, source) } }
  fun emitPermissionChanged(gate: String, value: String) = listeners.forEach { runCatching { it.onPermissionChanged(gate, value) } }
}
