package com.wakealarm

import android.content.ComponentName
import android.content.Context
import android.content.Intent
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
    "huawei" to ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
    "huawei" to ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
    "asus" to ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
  )

  /** Manufacturer-specific entries first, then the rest of the table, so resolution can still succeed on rebranded ROMs. */
  fun autostartCandidates(manufacturer: String): List<ComponentName> {
    val m = manufacturer.lowercase()
    val (mine, others) = AUTOSTART.partition { m.contains(it.first) }
    return (mine + others).map { it.second }.distinct()
  }

  fun intentFor(context: Context, kind: String): Intent? {
    val pkg = context.packageName
    val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
    return when (kind) {
      "notifications" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg) else details
      "exactAlarm" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$pkg")) else null
      "fullScreenIntent" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$pkg")) else null
      "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      "autostart" -> autostartCandidates(Build.MANUFACTURER)
        .map { Intent().setComponent(it) }
        .firstOrNull { context.packageManager.resolveActivity(it, 0) != null } ?: details
      "alarmKit" -> null
      else -> null
    }?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }
}
