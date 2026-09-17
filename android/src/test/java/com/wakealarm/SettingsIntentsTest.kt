package com.wakealarm

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.provider.Settings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class SettingsIntentsTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()

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

  @Test fun samsungCarriesBothBatteryActivityGenerations() {
    val c = SettingsIntents.autostartCandidates("samsung").take(2)
    assertEquals(listOf("com.samsung.android.lool", "com.samsung.android.lool"), c.map { it.packageName })
    assertEquals(2, c.map { it.className }.distinct().size)
  }

  @Test fun xiaomiPermissionEditorsLeadForXiaomiAndReadThePackageFromExtraPkgname() {
    val c = SettingsIntents.permissionEditorCandidates("Xiaomi")
    assertEquals("com.miui.securitycenter", c.first().component.packageName)
    assertTrue(c.takeWhile { it.manufacturer == "xiaomi" }.size >= 2)
    assertTrue(c.filter { it.manufacturer == "xiaomi" }.all { it.packageExtra == "extra_pkgname" })
  }

  @Test fun vivoPermissionEditorLeadsForVivoAndReadsThePackageFromPackagename() {
    val c = SettingsIntents.permissionEditorCandidates("vivo")
    assertEquals(
      ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.SoftPermissionDetailActivity"),
      c.first().component,
    )
    assertEquals("packagename", c.first().packageExtra)
  }

  @Test fun backgroundPopupFallsBackToAppDetailsWhenNoVendorEditorResolves() {
    val intent = SettingsIntents.intentFor(context, "backgroundPopup")!!
    assertEquals(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, intent.action)
    assertEquals(Uri.parse("package:${context.packageName}"), intent.data)
  }

  @Test fun batteryOpensTheAllAppsListWhenTheHostDoesNotDeclareTheRequestPermission() {
    assertFalse(SettingsIntents.declaresBatteryOptimizationRequest(context))
    val intent = SettingsIntents.intentFor(context, "battery")!!
    assertEquals(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, intent.action)
    assertNull(intent.data)
  }

  @Test fun batteryOpensTheDirectDialogWhenTheHostDeclaresTheRequestPermission() {
    val info = shadowOf(context.packageManager).getInternalMutablePackageInfo(context.packageName)
    info.requestedPermissions = arrayOf(Manifest.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
    assertTrue(SettingsIntents.declaresBatteryOptimizationRequest(context))
    val intent = SettingsIntents.intentFor(context, "battery")!!
    assertEquals(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, intent.action)
    assertEquals(Uri.parse("package:${context.packageName}"), intent.data)
  }

  @Test @Config(sdk = [30]) fun batteryDeclarationIsReadThroughTheLegacyPackageInfoCallBelow33() {
    assertFalse(SettingsIntents.declaresBatteryOptimizationRequest(context))
    val info = shadowOf(context.packageManager).getInternalMutablePackageInfo(context.packageName)
    info.requestedPermissions = arrayOf(Manifest.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
    assertTrue(SettingsIntents.declaresBatteryOptimizationRequest(context))
    assertEquals(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, SettingsIntents.intentFor(context, "battery")!!.action)
  }

  @Test fun unknownKindsResolveToNull() {
    assertNull(SettingsIntents.intentFor(context, "alarmKit"))
    assertNull(SettingsIntents.intentFor(context, "bogus"))
  }
}
