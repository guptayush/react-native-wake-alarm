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

**Import the package from a module your entry file reaches** (`index.js`, `App.tsx`, or
anything they import at module scope) — not lazily inside a screen. When the alarm
fires with the process dead, the ring activity evaluates the bundle's module scope and
starts the `WakeAlarmRing` surface; the import is what registers that component with
`AppRegistry`. A `require()` deferred until a screen mounts never runs in that activity.

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

## Sounds and vibration

Put a sound file at `android/app/src/main/res/raw/<name>.mp3` (or `.wav`) in your app,
lowercase resource name, and pass that name as `sound` in `schedule()`. If the name
can't be resolved as a raw resource, `RingService` falls back to the system default
alarm ringtone; if `MediaPlayer` errors mid-ring it retries once on the default tone.

Vibration runs alongside the audio with alarm attributes — `VibrationAttributes.USAGE_ALARM`
through `VibratorManager` on Android 13+, `AudioAttributes(USAGE_ALARM)` on 8–12 — so an OEM
Do Not Disturb filter treats it like the sound rather than like a notification buzz.
`vibrate: false` skips it and rings audio only. Slots stored before 1.1 carry no flag and
keep vibrating.

## The ring screen

Call `WakeAlarm.registerRingScreen(MyRingScreen)` once at startup to render your own UI;
otherwise a plain default screen is used. Either way, `WakeAlarmActivity` hosts a single
React root with the registered component — no navigation container. The `WakeAlarmRing`
component itself is registered when the package is imported; `registerRingScreen` only
swaps what renders inside it.

**When the takeover happens.** Android shows a full-screen intent as a heads-up banner
whenever the screen is on and unlocked, on every version; tapping the banner opens the
ring activity. The automatic takeover — screen turning on, activity over the keyguard —
happens only when the screen is off or the lock screen is showing. That is platform
behaviour, not a permission state: `fullScreenIntent: granted` still means heads-up on
an unlocked, lit screen.

Xiaomi, Vivo, Oppo and Realme ROMs add their own per-app "display pop-up windows while
running in background" and "show on lock screen" switches on top, off by default, and
demote the full-screen intent to a heads-up while either is off. The library cannot read
them; `getPermissionStatus().backgroundPopup` is `not_determined` on those manufacturers
and `openSettings('backgroundPopup')` opens the vendor page where they live.

The activity finishes itself as soon as the ring stops, from any source (Stop button,
`stopRinging()`, or the `maxRingMs` timeout). Back is swallowed while an alarm is ringing —
the hardware key and, on Android 13+ with predictive back enabled, the gesture.

## Degraded matrix

| Condition | What happens | `schedule` result |
| --- | --- | --- |
| Full-screen intent revoked (Android 14+) | heads-up notification, audio already playing, tap opens the ring activity | `ok_degraded / no_full_screen_intent` |
| Vendor background pop-up / lock-screen switch off (Xiaomi, Vivo, Oppo, Realme) | heads-up notification, audio plays, tap opens the ring activity; not detectable — `backgroundPopup` reads `not_determined` on these ROMs | `ok` |
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
ringing, the new one supersedes the first: the new `RingState` is published first, then
the old player, vibration and timeout are torn down and the old session reports
`"stopped"` with source `"superseded"`. The ring activity stays up and re-reads
`getRinging()` for the new alarm.

## Events and the pending action

`RingService` handles every `fired` and `stopped` the same way: it writes the action to
the single-slot pending store **and** emits it to JavaScript. If a JS listener receives
the live event it clears the parked copy, so `consumePendingAction()` on the next launch
sees only what nobody was listening for. The slot holds one action — the latest write
wins, so `fired` followed by `stopped` with JS absent yields `stopped`.

## Reboot and time changes

`BootReceiver` handles `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIMEZONE_CHANGED`,
`TIME_SET`, and the exact-alarm permission state changing (which also emits
`permissionChanged { gate: 'exactAlarm' }`). On any of these it re-arms
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
- **OEM background pop-up / lock-screen switches** cannot be queried either.
  `backgroundPopup` only reports which manufacturers have them, and
  `openSettings('backgroundPopup')` opens the Xiaomi or Vivo permission editor for the app,
  falling back to the app's details screen.
- `openSettings('battery')` opens the system-wide battery optimisation list unless the
  host manifest declares `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, in which case it opens the
  direct per-app dialog. The library does not add that permission: Play restricts it to
  apps whose core function needs it, so the host decides.
- `permissionChanged` covers `exactAlarm` only: `BootReceiver` emits it after re-arming on
  the exact-alarm permission broadcast. Every other gate has no system broadcast, so poll
  `getPermissionStatus()` (for example after returning from `openSettings`).

## Performance notes

Importing the package does one thing: `AppRegistry.registerComponent('WakeAlarmRing', …)`,
a map insert with a lazy provider. The TurboModule is resolved on the first API call, and
no listener, timer or storage read happens on import. In the fire path, the receiver does one
`SharedPreferences` read and one `startForegroundService` call; `MediaPlayer` starts
playback from its prepared callback, so the notification and the ring activity follow
the audio rather than gate it. The target is audible sound under 500 ms after the alarm
fires on a mid-range device with the process cold.
