# Changelog

## 1.0.0

First release. New architecture only (TurboModule), bare React Native and Expo,
React Native 0.80 or later.

### Capabilities

- Schedule an alarm by id, hour, minute, optional weekdays, title, body, bundled sound
  and string payload; cancel one or all; list what the OS actually holds.
- Android: exact `AlarmManager.setAlarmClock` alarm, a foreground service on the alarm
  audio stream, and a full-screen takeover via the library's own activity — no
  JavaScript in the audible path. Re-arms across reboot, package replacement, timezone
  and clock changes.
- iOS 26+: AlarmKit system alarms, breaking through the silent switch and Focus.
  iOS < 26, or AlarmKit unavailable/denied: a time-sensitive local notification
  fallback, reported as a degraded result.
- Every platform refusal is a typed `ScheduleResult` or `PermissionStatus` gate, never a
  silent failure or an unexplained rejection.
- Query and request permissions per gate; deep-link to the right Settings screen for the
  gates that have no prompt, including a best-effort OEM autostart table on Android.
- Synchronous `getRinging()`, `stopRinging()`, fired/stopped events, and
  `consumePendingAction()` for actions that happen while JavaScript isn't running (cold
  start, an App Intent, a notification tap).
- An overridable ring screen (`registerRingScreen`) with a plain default. The
  `WakeAlarmRing` root is registered with `AppRegistry` when the package is imported,
  so the lock-screen activity has a component to start even when the alarm fires with
  the app process dead; `registerRingScreen` swaps only the inner component.
- Import costs one `AppRegistry.registerComponent`; the TurboModule is resolved on the
  first API call.
- Every `fired`/`stopped` is parked for `consumePendingAction()` **and** emitted; a
  live listener clears the parked copy. `StoppedEvent.source` includes `superseded`
  for an Android alarm cut short by a second one firing, which keeps the ring screen up.
- iOS < 26: the library's `UNUserNotificationCenterDelegate` proxy shows the alarm
  banner in the foreground and records `stopped` for the Stop action and the tap,
  forwarding everything else to the host's delegate.
- An Expo config plugin: Info.plist and entitlement edits, the iOS Stop-intent Swift
  file and `AppDelegate` registration, and sound file copying for both platforms.

### Known limitations

- No snooze.
- No server- or push-triggered alarms; scheduling is local only.
- Android: re-arming after reboot does not cover the window before the device's first
  unlock (locked boot). Deferred to a future release.
- `permissionChanged` is not emitted by either platform; poll `getPermissionStatus()`
  instead. Reserved for a future release.
- Android: OEM autostart state cannot be queried, only linked to from Settings.
- iOS: no critical alerts — they need an Apple-granted entitlement most apps will not
  receive.
- No calendar-style recurrence richer than "one-off" or "these weekdays".
- iOS 26.x simulator: SpringBoard crashes on AlarmKit alert playback (Apple bug);
  verify on real hardware.
