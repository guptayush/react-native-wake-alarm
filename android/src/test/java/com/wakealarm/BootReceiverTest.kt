package com.wakealarm

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BootReceiverTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  private val seen = mutableListOf<String>()
  private val listener = object : RingEvents.Listener {
    override fun onFired(id: String, at: Long) {}
    override fun onStopped(id: String, at: Long, source: String) {}
    override fun onPermissionChanged(gate: String, value: String) { seen += "$gate:$value" }
  }

  @Before fun setUp() { RingEvents.add(listener); SlotStore(context).clear() }
  @After fun tearDown() { RingEvents.remove(listener); SlotStore(context).clear() }

  @Test fun anExactAlarmPermissionChangeReArmsAndReportsTheGate() {
    BootReceiver().onReceive(context, Intent(AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED))
    assertEquals(listOf("exactAlarm:${PermissionGates.exactAlarm(context)}"), seen)
  }

  @Test fun otherHandledBroadcastsReArmSilently() {
    BootReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))
    BootReceiver().onReceive(context, Intent(Intent.ACTION_TIME_CHANGED))
    BootReceiver().onReceive(context, Intent("com.example.UNRELATED"))
    assertTrue(seen.isEmpty())
  }
}
