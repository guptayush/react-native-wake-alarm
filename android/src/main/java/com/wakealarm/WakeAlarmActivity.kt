package com.wakealarm

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
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

  // Predictive back (API 33+, host opted in with enableOnBackInvokedCallback) bypasses onBackPressed;
  // this callback applies the same rule and is registered only while the activity is alive.
  private var backCallback: OnBackInvokedCallback? = null

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
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val callback = OnBackInvokedCallback { if (backShouldFinish(RingState.current == null)) finish() }
      onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)
      backCallback = callback
    }
  }

  override fun onDestroy() {
    RingEvents.remove(finishOnStop)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      backCallback?.let(onBackInvokedDispatcher::unregisterOnBackInvokedCallback)
      backCallback = null
    }
    super.onDestroy()
  }

  override fun invokeDefaultOnBackPressed() {
    if (backShouldFinish(RingState.current == null)) super.invokeDefaultOnBackPressed()
  }

  companion object {
    const val MAIN_COMPONENT = "WakeAlarmRing"

    /** A stopped event closes the screen only when nothing is ringing any more; a superseding alarm keeps it up. */
    fun shouldFinishOnStopped(currentIsNull: Boolean): Boolean = currentIsNull

    /** Back — hardware or predictive — is swallowed while an alarm rings and closes the screen once it has stopped. */
    fun backShouldFinish(currentIsNull: Boolean): Boolean = currentIsNull
  }
}
