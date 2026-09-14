# iOS

## Two paths

- **iOS 26 and later — AlarmKit.** A real system alarm. It breaks through the silent
  switch and every Focus mode. `schedule()` resolves `{ status: 'ok', backend: 'alarm_kit' }`.
- **Below iOS 26, or when AlarmKit is unavailable or denied — a time-sensitive local
  notification.** It passes Focus modes but **not** the silent switch. `schedule()`
  resolves `ok_degraded` with a reason your app should surface (tell the user to keep
  the ringer on).

All AlarmKit code is gated behind `#if canImport(AlarmKit)` and `if #available(iOS 26.0, *)`,
so the same binary runs on the library's 15.1 deployment target and uses AlarmKit only
where the OS actually has it.

AlarmKit alarms use a **relative** schedule — wall-clock hour/minute plus optional
weekdays, never a fixed date (`Alarm.Schedule.relative` in `AlarmKitScheduler.swift`).
A timezone change or a DST transition is picked up the next time the same wall-clock
time comes around; nothing needs to re-schedule.

## Required host edits

Copy the intents template into your app target — **not** into a pod or framework, App
Intents are only resolvable by the system when compiled into the app target itself:

```sh
cp node_modules/react-native-wake-alarm/ios/Templates/WakeAlarmIntents.swift ios/YourApp/
```

Add it to your Xcode target, then register it in `AppDelegate.swift`. The same call also
installs the library's notification delegate (below) early enough to see a cold-start
tap; put it after any other library that sets `UNUserNotificationCenter.current().delegate`:

```swift
import WakeAlarm

func application(
  _ application: UIApplication,
  didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
) -> Bool {
  WakeAlarmIntentsRegistration.install()
  // ...
}
```

Add to `Info.plist`:

```xml
<key>NSAlarmKitUsageDescription</key>
<string>Alarms you set can ring even when the phone is silent or in a Focus mode.</string>
```

Add the time-sensitive notifications entitlement, needed for the notification fallback
path below iOS 26, to your `.entitlements` file:

```xml
<key>com.apple.developer.usernotifications.time-sensitive</key>
<true/>
```

Make sure that file is wired up as `CODE_SIGN_ENTITLEMENTS` for your target's build
settings (Xcode: Signing & Capabilities → "+ Capability" → Time Sensitive
Notifications adds both for you) — the example app's target does this via its own
`WakeAlarmExample.entitlements`. The Expo plugin does both plist edits and the Swift
injection for you; see [docs/expo.md](expo.md).

## Sounds

Bundle a `.caf`, `.wav` or `.aiff` file in the app target and pass its base name (no
extension) as `sound`. Both AlarmKit and the notification fallback look for the file in
that order of extension and fall back to the default system sound if none match.
Notification sounds are capped at 30 seconds by iOS; AlarmKit has no such cap. On
exactly **iOS 26.0** a custom sound is never used — the default tone plays regardless of
what you pass, because custom AlarmKit sounds are broken on that release.

## What the system alert shows

AlarmKit presents an alert-only UI: a title, a **Stop** button, and a tint colour. There
is no countdown presentation and no custom media — that would require a widget
extension, which is out of scope for this library. The notification fallback shows a
standard time-sensitive banner with a **Stop** action.

`vibrate` is accepted and echoed back by `getScheduled()` for parity with Android, but
neither AlarmKit nor the notification fallback exposes vibration control — the system
decides, and `vibrate: false` changes nothing on iOS.

## Result mapping

| Result | Meaning |
| --- | --- |
| `ok / alarm_kit` | Scheduled as a real system alarm. |
| `ok_degraded / notification_fallback` | Scheduled as a notification instead of AlarmKit — either AlarmKit is unavailable (below iOS 26) or not yet decided, **or** AlarmKit is available but the user denied it while notifications are still granted. |
| `ok_degraded / no_notification_permission` | AlarmKit unavailable and notifications are also denied — the app must find another way to tell the user. |
| `failed / alarm_kit_denied` | AlarmKit exists on this device but the user denied it, and notifications are also denied. Nothing is scheduled and nothing is persisted; a previous alarm with the same `id` is cancelled (upsert). |

`requestPermissions()` requests AlarmKit authorization (iOS 26+) and then notification
authorization, and always resolves the freshly re-read `PermissionStatus` — a denied or
failed authorization prompt is reflected in the returned gates, never a rejected
promise. `schedule()` prompts for AlarmKit only while the app is active: the system sheet
never appears for a backgrounded app and the call would hang, so an undecided AlarmKit
state in the background falls to the notification path (`ok_degraded / notification_fallback`).
Call `requestPermissions()` from the foreground first.

`getScheduled()` recomputes `nextFireAt` from each record's wall-clock schedule at read
time — AlarmKit and `UNUserNotificationCenter` report no next-fire instant, and the
schedule-time value would go stale after a weekly alarm's first fire.

## Events

`fired` and `stopped` on the AlarmKit path come from watching
`AlarmManager.shared.alarmUpdates` for alerting-state transitions — there is no native
push per event, so a listener attached late still catches every transition from the
moment it is watching.

On the notification path the library owns `UNUserNotificationCenter.current().delegate`
for its own `WAKE_ALARM` category through `WakeAlarmNotificationProxy`. It is installed
by `WakeAlarmIntentsRegistration.install()` at launch and again when the module loads
(idempotent), and it forwards every other notification to whichever delegate your app or
another library had set — that delegate is restored if the module is torn down. For an
alarm notification it returns `[.banner, .list, .sound]` from `willPresent`, so an
alarm that lands while the app is in the foreground is still shown and heard, and it
records `stopped` when the user taps **Stop** or the notification itself. If your app
sets its own delegate *after* `install()`, the alarm handling is off until the module
loads on the first API call. The `WAKE_ALARM` category is registered as a union with
whatever categories exist, but `setNotificationCategories` replaces the whole set: a host
that calls it later wipes the Stop action. Call `WakeAlarm.requestPermissions()` or
schedule again afterwards to restore it.

Every `fired` and `stopped` — from AlarmKit, the Stop App Intent, a notification
response or `stopRinging()` — is parked for `consumePendingAction()` **and** emitted;
a live JS listener clears the parked copy on delivery. The slot holds one action.

`getRinging()` on iOS reads an in-memory map of alerting AlarmKit alarms kept by the
update watcher and seeded once when the module loads, plus the cached record for title,
body and payload. `firedAt` is the observed alerting transition (or the seed time for an
alert older than the module). Below iOS 26, or on the notification path, it returns
`null` — there is no ringing state to observe outside AlarmKit.

## Simulator limitation

In the iOS 26.x simulator, SpringBoard crashes with
`-[AVAudioSession reporterID]: unrecognized selector` when an AlarmKit alert starts
playing — a simulator runtime bug, not a library bug (the same failure class is reported
against Apple's critical-alert sounds on real hardware too, but only in the simulator
here). Scheduling, authorization and Live Activity creation all work in the simulator;
only alert playback needs a real device. See
[docs/device-testing.md](device-testing.md#4-ios-cases) for the verified run.

## Known limitations

- `openSettings` only handles `'notifications'` and `'alarmKit'` on iOS; the other kinds
  are Android-only and resolve without doing anything.
- `permissionChanged` is not emitted on iOS; Android emits it for `exactAlarm` only (see
  [docs/android.md](android.md#known-limitations)). Poll `getPermissionStatus()`.
- No critical alerts. They require an Apple-granted entitlement most apps will not get,
  so this library does not use them — the AlarmKit and time-sensitive paths above are
  the ceiling on iOS.
- No snooze and no calendar-style recurrence beyond "one-off" or "these weekdays".
