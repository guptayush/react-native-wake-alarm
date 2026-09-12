package com.wakealarm

import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class WakeAlarmActivityTest {
  @After fun tearDown() = RingState.clear()

  @Test fun aStoppedEventDoesNotFinishWhileAnotherAlarmIsRinging() {
    // A superseding alarm publishes its RingState before the old session's stopped event is emitted.
    RingState.set(Ringing("second", "T", "", "{}", 2, 2, 600_000, ""))
    assertFalse(WakeAlarmActivity.shouldFinishOnStopped(RingState.current == null))
  }

  @Test fun aStoppedEventFinishesOnceNothingIsRinging() {
    RingState.clear()
    assertTrue(WakeAlarmActivity.shouldFinishOnStopped(RingState.current == null))
  }
}
