# Changelog

## 1.2.0

### Added

- `PermissionStatus.backgroundPopup`: `not_determined` on Xiaomi, Vivo, Oppo and Realme
  ROMs, whose own per-app "display pop-up windows while running in background" and
  "show on lock screen" switches demote a full-screen intent to a heads-up even with
  `fullScreenIntent: granted`; `not_applicable` elsewhere and on iOS. The switches cannot
  be read, so the gate names the ROMs that have them.
- `openSettings('backgroundPopup')` opens the app's page in the Xiaomi or Vivo permission
  manager where those switches live, falling back to the app's details screen.
- A recommended prompt order and copy notes in `docs/permissions-and-store-policy.md`.

### Changed

- `openSettings('battery')` opens the direct per-app dialog when the host manifest
  declares `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`; otherwise the system-wide list, as
  before. The library still does not add that permission.
- The Samsung autostart entry also tries the newer One UI battery activity.
- Docs: sideloaded builds keep `USE_FULL_SCREEN_INTENT` granted (only Play revokes it), so a
  CLI or emulator install never shows the full-screen prompt.

## 1.1.0

### Added

- `AlarmInput.vibrate` (default `true`). Android vibrates on the alarm usage —
  `VibrationAttributes.USAGE_ALARM` on 13+, the `AudioAttributes(USAGE_ALARM)` overload
  on 8–12 — so OEM Do Not Disturb filters treat it like the sound; `false` rings audio
  only. Slots stored by 1.0 keep vibrating. iOS stores and echoes the flag through
  `getScheduled()`; AlarmKit and the notification fallback expose no vibration control.
- `permissionChanged` is emitted on Android for `gate: 'exactAlarm'` after `BootReceiver`
  re-arms on the exact-alarm permission broadcast. Informational, never parked. iOS still
  emits nothing.
- `react-native-wake-alarm/jest`: a consumer mock with every `WakeAlarmApi` method as a
  `jest.fn()` and stubs for the named exports.
- `ID_PATTERN` and `SOUND_PATTERN` are exported from `src/validate.ts`.

### Changed

- `sound` is validated in JavaScript against the Android resource rule
  `/^[a-z][a-z0-9_]*$/` on both platforms; anything else resolves
  `failed / invalid_input` at schedule time instead of failing at fire time.
- iOS `schedule()` prompts for AlarmKit only while the app is active. From the
  background the system sheet never appears and the promise used to hang; an undecided
  state now falls to the notification path and resolves `ok_degraded` (`notification_fallback`,
  or `no_notification_permission` when notifications are denied too) — `failed /
  alarm_kit_denied` is reserved for an actual denial. `requestPermissions()` still prompts.
- iOS `getScheduled()` recomputes `nextFireAt` at read time; the schedule-time value went
  stale after a weekly alarm's first fire.
- Android `WakeAlarmActivity` swallows predictive back (API 33+) while ringing, matching
  the hardware key.
- Expo plugin: the AppDelegate import is anchored on a real import line (clear error
  when there is none), a missing `sounds` folder fails with the resolved path, and
  config-plugins resolves through `expo/config-plugins` before `@expo/config-plugins`.
- Stop intent template: `openAppWhenRun` → `supportedModes` (iOS 26 SDK).
- Release workflow runs the Android and Swift test suites before publishing.

### Documented

- Android `getScheduled()` reads the library's persisted slots (there is no
  `AlarmManager` listing API) and can list alarms the OS cancelled after an exact-alarm
  revocation until the grant returns.
- iOS: a host calling `setNotificationCategories` replaces the `WAKE_ALARM` category.

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
