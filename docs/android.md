# Android

## How it works

1. `AlarmManager.setAlarmClock(...)` fires an exact, non-coalesced alarm even in Doze,
   and shows the alarm icon in the status bar.
2. `FireReceiver` (a `BroadcastReceiver`) wakes up, re-arms a weekly slot for next week,
   and starts `RingService` as a foreground service.
3. `RingService` plays the sound on `MediaPlayer` with `AudioAttributes(USAGE_ALARM)` —
   the alarm stream, not the notification stream — and posts a notification with a
   full-screen intent.
4. The full-screen intent launches `WakeAlarmActivity`, the library's own activity, over
   the lock screen.

No JavaScript runs in this path. The receiver, the service and the activity are all
native; React Native is only mounted once the ring activity is on screen, to render the
ring UI.

## What is merged into your app

Everything below comes from the library's own `AndroidManifest.xml` via manifest
merging. There is nothing to add or edit in your app's manifest.

- Permissions: `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`, `WAKE_LOCK`, `VIBRATE`,
  `RECEIVE_BOOT_COMPLETED`.
- `RingService`, a foreground service of type `systemExempted` (Android 14+).
- `FireReceiver` (not exported) and `BootReceiver` (exported, system broadcasts only).
- `WakeAlarmActivity`: `showWhenLocked`, `turnScreenOn`, `excludeFromRecents`,
  `singleTask`, not exported. It is the library's own activity — your `MainActivity` is
  never touched, so a normal notification tap can never bypass the lock screen.

`USE_EXACT_ALARM` is **not** declared. Play restricts it to alarm and calendar apps; add
it yourself in your app's manifest if your app qualifies.

## Sounds

Put a sound file at `android/app/src/main/res/raw/<name>.mp3` (or `.wav`) in your app,
lowercase resource name, and pass that name as `sound` in `schedule()`. If the name
can't be resolved as a raw resource, `RingService` falls back to the system default
alarm ringtone; if `MediaPlayer` errors mid-ring it retries once on the default tone.

## The ring screen

Call `WakeAlarm.registerRingScreen(MyRingScreen)` once at startup to render your own UI;
otherwise a plain default screen is used. Either way, `WakeAlarmActivity` hosts a single
React root with the registered component — no navigation container.

The activity finishes itself as soon as the ring stops, from any source (Stop button,
`stopRinging()`, or the `maxRingMs` timeout). Hardware Back is swallowed while an alarm
is ringing.

## Degraded matrix

| Condition | What happens | `schedule` result |
| --- | --- | --- |
| Full-screen intent revoked (Android 14+) | heads-up notification, audio already playing, tap opens the ring activity | `ok_degraded / no_full_screen_intent` |
| Exact alarm not granted (Android 12+) | nothing is armed | `failed / no_exact_alarm_permission` |
| Notifications denied (Android 13+) | service still rings audio; no notification, no Stop action; app must stop via the API | `ok_degraded / no_notification_permission` |
| Sound resource missing | system alarm ringtone | `ok` |
| Battery restricted / OEM autostart off | may not fire; surfaced via `getPermissionStatus().batteryUnrestricted` and `openSettings('autostart')` | unchanged |
| Foreground service start refused at fire time (permission revoked after arming, OEM quirk) | plain notification, no audio, app is told a `fired` pending action | n/a — this happens after `schedule` already resolved |
| One weekday slot refused by `AlarmManager` while arming the rest | every slot armed so far for this `id` is disarmed and removed from the store — all-or-nothing | `failed / native_error` |

If starting the foreground service throws when the alarm actually fires, the receiver
falls back to posting a plain (non-full-screen) notification with no audio, and records
a `fired` pending action for the app to read on next launch via
`consumePendingAction()`.

`schedule()` expands weekdays into one slot per day and arms them one at a time
(`AlarmScheduler.scheduleAll`). If any slot's `setAlarmClock` call is refused, every
slot already armed for that alarm is disarmed again and the whole `id` is removed from
the store before `schedule()` resolves `failed`/`native_error` — a caller told `failed`
can trust that nothing from that call will fire, not even the days that armed
successfully before the failure.

Scheduling the same `id` again replaces it. If a second alarm fires while one is already
ringing, the new one supersedes the first — the old session is torn down (as a
`"stopped"` with source `"api"`) before the new one starts.

## Reboot and time changes

`BootReceiver` handles `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIMEZONE_CHANGED`,
`TIME_SET`, and the exact-alarm permission state changing. On any of these it re-arms
every stored slot from its wall-clock `hour`/`minute`/`weekday`, rolling weekly slots
forward and dropping one-offs that are already past due. Re-arming is idempotent, so a
receiver firing twice for the same event does not double-schedule.

Next-fire times are computed with `java.util.Calendar` in the device's time zone, never
raw epoch arithmetic, so a weekly alarm stays at the same wall-clock minute across a DST
change.

## Known limitations

- **Locked boot**: if the device reboots and is not unlocked before the alarm is due, the
  alarm is not covered in this version. Covering it needs the host `Application` to be
  involved, which is deferred to a future release.
- **OEM autostart** cannot be queried — there is no Android API for it. `openSettings('autostart')`
  opens a best-effort table of vendor screens (Xiaomi, Oppo, Realme, OnePlus, Vivo,
  Samsung, Huawei, Asus), falling back to the app's details screen.
- `permissionChanged` is not emitted by either platform in this version and is reserved
  for future use; poll `getPermissionStatus()` instead (for example after returning from
  `openSettings`).

## Performance notes

Nothing runs at app launch — the module is a lazily-loaded TurboModule and no listener,
timer or storage read happens on import. In the fire path, the receiver does one
`SharedPreferences` read and one `startForegroundService` call; `MediaPlayer` starts
playback from its prepared callback, so the notification and the ring activity follow
the audio rather than gate it. The target is audible sound under 500 ms after the alarm
fires on a mid-range device with the process cold.
