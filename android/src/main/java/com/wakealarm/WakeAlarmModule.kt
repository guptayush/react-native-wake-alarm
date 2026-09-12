package com.wakealarm

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap

class WakeAlarmModule(reactContext: ReactApplicationContext) :
  NativeWakeAlarmSpec(reactContext) {

  override fun schedule(input: ReadableMap, promise: Promise) {
    promise.reject("not_implemented", "schedule is implemented in a later change")
  }

  override fun cancel(id: String, promise: Promise) {
    promise.reject("not_implemented", "cancel is implemented in a later change")
  }

  override fun cancelAll(promise: Promise) {
    promise.reject("not_implemented", "cancelAll is implemented in a later change")
  }

  override fun getScheduled(promise: Promise) {
    promise.reject("not_implemented", "getScheduled is implemented in a later change")
  }

  override fun getPermissionStatus(promise: Promise) {
    promise.reject("not_implemented", "getPermissionStatus is implemented in a later change")
  }

  override fun requestPermissions(promise: Promise) {
    promise.reject("not_implemented", "requestPermissions is implemented in a later change")
  }

  override fun openSettings(kind: String, promise: Promise) {
    promise.reject("not_implemented", "openSettings is implemented in a later change")
  }

  override fun getRingingJson(): String? = null

  override fun stopRinging(promise: Promise) {
    promise.reject("not_implemented", "stopRinging is implemented in a later change")
  }

  override fun consumePendingActionJson(): String? = null

  companion object {
    const val NAME = NativeWakeAlarmSpec.NAME
  }
}
