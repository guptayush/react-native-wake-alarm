package com.wakealarm

import android.content.ComponentName
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

  @Test fun everyMiuiEntryPrecedesEveryNonMiuiEntryForXiaomi() {
    val c = SettingsIntents.autostartCandidates("Xiaomi")
    val isMiui = c.map { it.packageName.startsWith("com.miui.") }
    val lastMiuiIndex = isMiui.lastIndexOf(true)
    val firstNonMiuiIndex = isMiui.indexOf(false)
    assertTrue(firstNonMiuiIndex == -1 || lastMiuiIndex < firstNonMiuiIndex)
  }

  @Test fun vivoCandidatesLeadWithVivoThenIqooInTableOrder() {
    val c = SettingsIntents.autostartCandidates("vivo")
    assertEquals(
      listOf(
        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
        ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
      ),
      c.take(2),
    )
  }

  @Test fun realmeSharesTheOppoComponentButOnlyOnce() {
    val c = SettingsIntents.autostartCandidates("realme")
    val shared = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
    assertEquals(1, c.count { it == shared })
    assertEquals(c.distinct(), c)
  }

  @Test fun unknownManufacturerGetsTheWholeTableSoResolutionCanStillHit() {
    val all = SettingsIntents.autostartCandidates("Pixel")
    assertTrue(all.map { it.packageName }.containsAll(listOf("com.miui.securitycenter", "com.coloros.safecenter", "com.vivo.permissionmanager", "com.samsung.android.lool", "com.huawei.systemmanager")))
  }

  @Test fun matchingIsCaseInsensitive() {
    assertEquals(SettingsIntents.autostartCandidates("XIAOMI"), SettingsIntents.autostartCandidates("xiaomi"))
  }
}
