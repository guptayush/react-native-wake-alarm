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

## Required host edits

Copy the intents template into your app target — **not** into a pod or framework, App
Intents are only resolvable by the system when compiled into the app target itself:

```sh
cp node_modules/react-native-wake-alarm/ios/Templates/WakeAlarmIntents.swift ios/YourApp/
```

Add it to your Xcode target, then register it in `AppDelegate.swift`:

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

And enable the time-sensitive notifications entitlement
(`com.apple.developer.usernotifications.time-sensitive`) — needed for the notification
fallback path below iOS 26. The Expo plugin does both plist edits and the Swift
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

## Result mapping

| Result | Meaning |
| --- | --- |
| `ok / alarm_kit` | Scheduled as a real system alarm. |
| `ok_degraded / notification_fallback` | AlarmKit unavailable (below iOS 26) or not yet decided; scheduled as a notification instead. |
| `ok_degraded / no_notification_permission` | AlarmKit unavailable and notifications are also denied — the app must find another way to tell the user. |
| `failed / alarm_kit_denied` | AlarmKit exists on this device but the user denied it, and notifications are also denied. |

`requestPermissions()` requests AlarmKit authorization (iOS 26+) and then notification
authorization, and always resolves the freshly re-read `PermissionStatus` — a denied or
failed authorization prompt is reflected in the returned gates, never a rejected
promise.

## Events

`fired` and `stopped` on the AlarmKit path come from watching
`AlarmManager.shared.alarmUpdates` for alerting-state transitions — there is no native
push per event, so a listener attached late still catches every transition from the
moment it is watching. The notification fallback path has nothing observable in-process;
your app finds out only when the user taps the notification or its Stop action, via
`consumePendingAction()` on cold start or the `stopped` listener if JS is already
running.

`getRinging()` on iOS reports the currently alerting AlarmKit alarm, if any, with
`firedAt` approximated as the current time (AlarmKit does not report the original fire
instant). Below iOS 26, or once the notification path is in play, `getRinging()` returns
`null` — there is no ringing state to observe outside AlarmKit.

## Known limitations

- `openSettings` only handles `'notifications'` and `'alarmKit'` on iOS; the other kinds
  are Android-only and resolve without doing anything.
- No critical alerts. They require an Apple-granted entitlement most apps will not get,
  so this library does not use them — the AlarmKit and time-sensitive paths above are
  the ceiling on iOS.
- No snooze and no calendar-style recurrence beyond "one-off" or "these weekdays".
