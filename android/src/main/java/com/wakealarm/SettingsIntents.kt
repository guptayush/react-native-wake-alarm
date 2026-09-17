package com.wakealarm

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings

object SettingsIntents {
  private val AUTOSTART = listOf(
    "xiaomi" to ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
    "xiaomi" to ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings"),
    "oppo" to ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
    "oppo" to ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
    "realme" to ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
    "oneplus" to ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
    "vivo" to ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
    "vivo" to ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
    "samsung" to ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
    "samsung" to ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"),
    "huawei" to ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
    "huawei" to ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
    "asus" to ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
  )

  /** A vendor per-app permission page; [packageExtra] is the extra it reads the target package from. */
  data class PermissionEditor(val manufacturer: String, val component: ComponentName, val packageExtra: String)

  // These pages hold the "display pop-up windows while running in background" and "show on lock
  // screen" switches that decide whether a full-screen intent may launch the ring activity.
  private val PERMISSION_EDITORS = listOf(
    PermissionEditor("xiaomi", ComponentName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity"), "extra_pkgname"),
    PermissionEditor("xiaomi", ComponentName("com.miui.securitycenter", "com.miui.permcenter.permissions.AppPermissionsEditorActivity"), "extra_pkgname"),
    PermissionEditor("vivo", ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.SoftPermissionDetailActivity"), "packagename"),
  )

  /** Manufacturer-specific entries first, then the rest of the table, so resolution can still succeed on rebranded ROMs. */
  fun autostartCandidates(manufacturer: String): List<ComponentName> {
    val m = manufacturer.lowercase()
    val (mine, others) = AUTOSTART.partition { m.contains(it.first) }
    return (mine + others).map { it.second }.distinct()
  }

  fun permissionEditorCandidates(manufacturer: String): List<PermissionEditor> {
    val m = manufacturer.lowercase()
    val (mine, others) = PERMISSION_EDITORS.partition { m.contains(it.manufacturer) }
    return mine + others
  }

  /** True when the host manifest requests REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, which the direct dialog needs. */
  fun declaresBatteryOptimizationRequest(context: Context): Boolean = runCatching {
    val pm = context.packageManager
    val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()))
    } else {
      @Suppress("DEPRECATION") pm.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
    }
    info.requestedPermissions?.contains(Manifest.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) == true
  }.getOrDefault(false)

  fun intentFor(context: Context, kind: String): Intent? {
    val pkg = context.packageName
    val packageUri = Uri.parse("package:$pkg")
    val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
    val resolves = { intent: Intent -> context.packageManager.resolveActivity(intent, 0) != null }
    return when (kind) {
      "notifications" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg) else details
      "exactAlarm" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri) else null
      "fullScreenIntent" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri) else null
      "battery" -> if (declaresBatteryOptimizationRequest(context))
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, packageUri)
      else Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      "autostart" -> autostartCandidates(Build.MANUFACTURER)
        .map { Intent().setComponent(it) }
        .firstOrNull(resolves) ?: details
      "backgroundPopup" -> permissionEditorCandidates(Build.MANUFACTURER)
        .map { Intent().setComponent(it.component).putExtra(it.packageExtra, pkg) }
        .firstOrNull(resolves) ?: details
      "alarmKit" -> null
      else -> null
    }?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }
}
