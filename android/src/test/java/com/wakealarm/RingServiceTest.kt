package com.wakealarm

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.os.Vibrator
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

// SDK 30: the plain Vibrator service, which Robolectric shadows; VibratorManager (31+) has no shadow in 4.14.
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class RingServiceTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  private val vibrator: Vibrator get() = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

  @After fun tearDown() { RingState.clear(); PendingActionStore(context).consumeJson() }

  private fun slot(vibrate: Boolean) = Slot("a", 6, 30, null, "T", "", "", "{}", 600_000, 1_800_000_000_000L, vibrate = vibrate)

  private fun start(slot: Slot) {
    val intent = Intent(context, RingService::class.java).setAction(RingService.ACTION_START).putExtra(RingService.EXTRA_SLOT, slot.toJson())
    Robolectric.buildService(RingService::class.java, intent).create().startCommand(0, 1)
  }

  @Test fun aVibratingSlotStartsTheVibratorOnTheAlarmUsage() {
    start(slot(vibrate = true))
    assertEquals("a", RingState.current?.id)
    assertTrue(shadowOf(vibrator).isVibrating)
    assertEquals(AudioAttributes.USAGE_ALARM, shadowOf(vibrator).audioAttributesFromLastVibration!!.usage)
  }

  @Test fun aSilentSlotRingsWithoutTouchingTheVibrator() {
    start(slot(vibrate = false))
    assertEquals("a", RingState.current?.id)
    assertFalse(shadowOf(vibrator).isVibrating)
  }
}
