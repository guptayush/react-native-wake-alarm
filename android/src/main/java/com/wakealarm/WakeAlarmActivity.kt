package com.wakealarm

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate

class WakeAlarmActivity : ReactActivity() {
  private val finishOnStop = object : RingEvents.Listener {
    override fun onFired(id: String, at: Long) {}
    override fun onStopped(id: String, at: Long, source: String) {
      runOnUiThread { if (!isFinishing && shouldFinishOnStopped(RingState.current == null)) finish() }
    }
  }

  override fun getMainComponentName(): String = MAIN_COMPONENT

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, DefaultNewArchitectureEntryPoint.fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    if (RingState.current == null) { finish(); return }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) { setShowWhenLocked(true); setTurnScreenOn(true) }
    @Suppress("DEPRECATION")
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    RingEvents.add(finishOnStop)
  }

  override fun onDestroy() {
    RingEvents.remove(finishOnStop)
    super.onDestroy()
  }

  override fun invokeDefaultOnBackPressed() {
    if (RingState.current == null) super.invokeDefaultOnBackPressed()
  }

  companion object {
    const val MAIN_COMPONENT = "WakeAlarmRing"

    /** A stopped event closes the screen only when nothing is ringing any more; a superseding alarm keeps it up. */
    fun shouldFinishOnStopped(currentIsNull: Boolean): Boolean = currentIsNull
  }
}
