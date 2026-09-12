package com.wakealarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SettingsIntentsTest {
  @Test fun xiaomiCandidatesComeFirstForXiaomi() {
    val c = SettingsIntents.autostartCandidates("Xiaomi")
    assertEquals("com.miui.securitycenter", c.first().packageName)
    assertTrue(c.size >= 2)
  }
  @Test fun unknownManufacturerGetsTheWholeTableSoResolutionCanStillHit() {
    val all = SettingsIntents.autostartCandidates("Pixel")
    assertTrue(all.map { it.packageName }.containsAll(listOf("com.miui.securitycenter", "com.coloros.safecenter", "com.vivo.permissionmanager", "com.samsung.android.lool", "com.huawei.systemmanager")))
  }
  @Test fun matchingIsCaseInsensitive() {
    assertEquals(SettingsIntents.autostartCandidates("XIAOMI"), SettingsIntents.autostartCandidates("xiaomi"))
  }
}
