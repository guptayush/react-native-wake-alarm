package com.wakealarm

import com.facebook.react.bridge.ReactApplicationContext

class WakeAlarmModule(reactContext: ReactApplicationContext) :
  NativeWakeAlarmSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeWakeAlarmSpec.NAME
  }
}
