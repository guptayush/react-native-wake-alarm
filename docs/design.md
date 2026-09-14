# react-native-wake-alarm — design

A React Native library that schedules a real alarm: one that wakes the phone,
takes over the lock screen, and rings on the alarm audio stream, with the app
backgrounded or killed, in silent mode or Do Not Disturb. Android uses
`AlarmManager` plus a foreground service and a full-screen intent. iOS uses
AlarmKit on iOS 26 and later, and a time-sensitive local notification below.

One npm package, native and JavaScript together. Bare React Native and Expo.

## 1. Goals

- Fire at the scheduled minute with the app process dead, the screen off and
  the phone locked.
- Make sound through the alarm channel, not the notification channel, so it
  follows the alarm volume and passes Do Not Disturb.
- Take over the screen where the platform allows it, and degrade to the best
  the platform offers where it does not, always reporting which happened.
- Never fail silently. Every degraded state is a typed result the app can
  show to the user, and every gate the OS controls is queryable.
- Cost the host app nothing until it calls the API.
- Work in a bare React Native app and an Expo app with the same code and a
  documented, short integration.

## 2. Non-goals for v1

- Snooze.
- Server-triggered or push-triggered alarms. Scheduling is local only.
- Locked-boot re-arm on Android, before the first unlock after a reboot.
  Covering it requires edits to the host `Application`; deferred to v2 as an
  opt-in.
- Critical alerts on iOS. They need an Apple-granted entitlement most apps
  will not receive.
- Any calendar or recurrence richer than "one-off" and "these weekdays".
- Old React Native architecture. New architecture only.

## 3. Requirements

Functional:

1. Schedule an alarm by id, hour, minute, optional weekdays, title, optional
   body, optional bundled sound name, optional string payload.
2. Cancel one alarm or all alarms. List scheduled alarms from the OS, not from
   a JS cache.
3. Report permission state per gate, prompt for the gates that can be
   prompted, and deep-link to Settings for the ones that cannot.
4. Tell the app synchronously whether an alarm is ringing, let it stop the
   ring, and deliver fired/stopped events, including across a cold start.
5. Let the app register its own ring screen component; ship a plain default.

Platform floors: Android API 26 (Oreo) and later, targeting the current
release; iOS 15.1 and later, with AlarmKit used on 26 and later; React Native
0.80 and later, new architecture. 0.80 is where the `CodegenTypes` root export
the TurboModule spec relies on arrived, and it is the lowest version CI builds.

## 4. Architecture

```
┌────────────────────────── JS (src/) ──────────────────────────┐
│ index.ts        public API, result mapping, listeners           │
│ NativeWakeAlarm TurboModule spec (codegen)                       │
│ RingScreen      default ring component + registry               │
└────────────┬──────────────────────────────────┬────────────────┘
             │                                  │
   ┌─────────▼──────── android/ ───────┐ ┌──────▼──────── ios/ ─────────┐
   │ WakeAlarmModule (Kotlin, Turbo)   │ │ WakeAlarm.mm  (ObjC++ shim)  │
   │ AlarmScheduler  setAlarmClock     │ │ WakeAlarmImpl.swift          │
   │ SlotStore       SharedPreferences │ │  ├─ AlarmKitScheduler  26+   │
   │ FireReceiver → RingService (FGS)  │ │  └─ NotificationScheduler    │
   │ RingPlayer      MediaPlayer/ALARM │ │ PendingActionBridge          │
   │ BootReceiver    re-arm            │ │ WakeAlarmIntents.swift       │
   │ WakeAlarmActivity  ring UI host   │ │   (copied into the app)      │
   └───────────────────────────────────┘ └──────────────────────────────┘
```

Native is the source of truth on both platforms. JavaScript keeps nothing on
disk. `getScheduled()` reads what the OS will actually fire.

## 5. Public API

Default export `WakeAlarm`.

```ts
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO, 1 = Monday

interface AlarmInput {
  id: string;                     // app-chosen, stable, 1–64 chars
  hour: number;                   // 0–23, device local time
  minute: number;                 // 0–59
  days?: Weekday[];               // empty or omitted = one-off
  title: string;
  body?: string;
  sound?: string;                 // bundled resource name, no extension
  payload?: Record<string, string>;
  maxRingMs?: number;             // Android give-up cap, default 600000
  vibrate?: boolean;              // default true; Android only, iOS stores and echoes it
}

interface ScheduledAlarm extends AlarmInput {
  nextFireAt: number;             // epoch ms, as the OS reports it
  backend: 'alarm_manager' | 'alarm_kit' | 'notification';
}

type ScheduleResult =
  | { status: 'ok'; backend: ScheduledAlarm['backend']; nextFireAt: number }
  | { status: 'ok_degraded'; backend: ScheduledAlarm['backend']; nextFireAt: number;
      reason: 'no_full_screen_intent' | 'notification_fallback' | 'no_notification_permission' }
  | { status: 'failed';
      reason: 'no_exact_alarm_permission' | 'alarm_kit_denied' | 'invalid_input' | 'native_error';
      message?: string };

type Gate = 'granted' | 'denied' | 'not_determined' | 'not_applicable';

interface PermissionStatus {
  notifications: Gate;
  exactAlarm: Gate;        // Android 12+
  fullScreenIntent: Gate;  // Android 14+
  batteryUnrestricted: Gate;
  alarmKit: Gate;          // iOS 26+
}

type SettingsKind =
  | 'notifications' | 'exactAlarm' | 'fullScreenIntent' | 'battery'
  | 'autostart' | 'alarmKit';

interface RingingAlarm { id: string; title: string; body?: string;
  payload?: Record<string, string>; firedAt: number; scheduledFor: number }

interface PendingAction { id: string; action: 'stopped' | 'fired'; at: number }

interface RingScreenProps { alarm: RingingAlarm; stop: () => Promise<void> }

interface WakeAlarmApi {
  schedule(alarm: AlarmInput): Promise<ScheduleResult>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  getScheduled(): Promise<ScheduledAlarm[]>;

  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  openSettings(kind: SettingsKind): Promise<void>;

  getRinging(): RingingAlarm | null;          // synchronous
  stopRinging(): Promise<void>;
  consumePendingAction(): PendingAction | null;
  addListener(event: 'fired' | 'stopped' | 'permissionChanged',
              cb: (payload: unknown) => void): { remove(): void };

  registerRingScreen(component: React.ComponentType<RingScreenProps>): void;
}
```

Rules:

- `schedule` is an upsert by `id`. Scheduling an id that exists replaces it.
- `schedule` never throws for a platform refusal. It resolves to `failed`.
  It rejects only for a programming error, and even then `invalid_input` is
  preferred when the input can be checked.
- `requestPermissions` prompts for notifications (both platforms) and
  AlarmKit (iOS 26+). Exact alarm, full-screen intent, battery and autostart
  have no prompt; the app calls `openSettings` for those. The returned status
  is re-read after prompting.
- `getRinging` is a synchronous in-memory read. It is safe to call during
  render. On Android that is the service's `RingState`; on iOS it is a map of
  alerting alarm ids to fire instants that the module keeps from
  `AlarmManager.shared.alarmUpdates` (seeded once at module start), plus a
  cached record for title, body and payload. No AlarmKit query per call.
- Payload values are strings only, so they survive `PendingIntent` extras
  and AlarmKit metadata without serialisation surprises.
- `autostart` is a `SettingsKind` but not a `PermissionStatus` field because
  no Android API reports whether an OEM autostart grant exists. The app can
  only offer the Settings link; the guide recommends showing it once.

## 6. Android

### Scheduling

`AlarmManager.setAlarmClock(AlarmClockInfo(triggerAt, showIntent), operation)`.
It is exempt from Doze, never coalesced, and shows the alarm icon in the
status bar. It requires `SCHEDULE_EXACT_ALARM`, declared in the library
manifest. `USE_EXACT_ALARM` is not declared; Play restricts it to alarm and
calendar apps and the host can add it if it qualifies.

Each alarm expands to one slot per weekday, or one slot for a one-off. A slot
is keyed `"<id>:<weekday|once>"` and its `PendingIntent` carries that key as
the intent `data` URI, because `PendingIntent` identity ignores extras.

`SlotStore` keeps slots in `SharedPreferences` (`wake_alarm_slots_v1`) as
`hour`, `minute`, `weekday`, `title`, `body`, `sound`, `payload`, `vibrate`
(absent in records written before 1.1, read as `true`), and a `nextFireAt` epoch
that is only a cache. Writes use `commit()` on the
schedule and cancel paths so the record is on disk before the alarm is armed.

Next-fire computation uses `java.util.Calendar` in the device zone, never
epoch arithmetic, so a weekly re-arm across a DST change stays at the same
wall-clock minute.

### Firing with the process dead

`FireReceiver` (`BroadcastReceiver`) receives the slot key, acquires a
partial wake lock capped at 60 seconds, reads the one slot, re-arms it if it
is weekly (`AlarmScheduler.consumeFire`: next occurrence of the slot's own
weekday after `max(nextFireAt, now)`, so a late delivery never moves the
alarm to another day), and calls `startForegroundService(RingService)`.
Starting a foreground service from an exact alarm is permitted on Android 12
and later.

`RingService` is a foreground service of type `systemExempted` on Android 14
and later. In `onStartCommand` it:

1. Sets the in-memory `RingState` (id, title, body, payload, firedAt).
2. Creates the channel `wake_alarm_ring` once: `IMPORTANCE_HIGH`, no sound,
   no vibration, `setBypassDnd(true)`, `VISIBILITY_PUBLIC`. The channel is
   silent on purpose; the service plays the audio itself.
3. Posts the notification: `CATEGORY_ALARM`, ongoing, title and body from the
   slot, a Stop action that targets the service, and
   `setFullScreenIntent(WakeAlarmActivity, true)`. `true` keeps the heads-up
   visible when the full-screen intent is not granted, which on Android 14 is
   the entire degraded alarm.
4. Calls `startForeground`, then `RingPlayer.start(sound)`.
5. Starts vibration with `USAGE_ALARM` attributes unless the slot's `vibrate`
   is false, and schedules a give-up at `maxRingMs` (default 10 minutes,
   configurable per alarm).
6. Returns `START_NOT_STICKY`.

`RingPlayer` wraps `MediaPlayer` with `AudioAttributes(USAGE_ALARM,
CONTENT_TYPE_SONIFICATION)`, `isLooping = true`, `setWakeMode(PARTIAL)`, and
`prepareAsync()` so the service thread is never blocked. If the named sound
is not found in `res/raw`, it plays the system default alarm ringtone. If
`MediaPlayer` reports an error mid-ring it retries once with the default.

Stop: the notification action, `stopRinging()` from JS, or the timeout all
route to `ACTION_STOP`, which stops the player, cancels vibration, clears
`RingState`, delivers `stopped`, stops foreground, and stops the service.
Every `fired` and `stopped` is delivered the same way: written to the
single-slot pending store **and** emitted to JS, with no check for native
listeners. A live JS listener clears the parked copy on delivery, so
`consumePendingAction()` returns only what nobody was listening for.

### Screen takeover

`WakeAlarmActivity` is declared in the library manifest with
`showWhenLocked="true"`, `turnScreenOn="true"`, `excludeFromRecents="true"`,
`launchMode="singleTask"`, and `exported="false"`. It extends `ReactActivity`
and hosts the component `WakeAlarmRing`. The JS side registers that component
with `AppRegistry` **at import time, unconditionally**: when the alarm fires
with the process dead, the activity evaluates only the bundle's module scope
before starting the surface, so a registration deferred to an API call would
never happen. `registerRingScreen` swaps the inner component rendered by that
root; it never re-registers. The host must import the package from a module
its entry file reaches.

Android shows a full-screen intent as a heads-up banner whenever the screen
is on and unlocked; the automatic takeover happens only with the screen off or
the keyguard showing. If a second alarm fires while one rings, the service
publishes the new `RingState` before tearing down the old session, so the
activity (which finishes only while `RingState` is null) stays up; the old
session reports `stopped` with source `superseded`.

The activity is the package's own, so the host `MainActivity` is untouched
and a normal notification tap can never bypass the lock screen. It finishes
itself when the ring stops, from any source. Hardware Back is swallowed while
ringing.

### Degraded matrix

| Condition | What happens | `schedule` result |
| --- | --- | --- |
| Full-screen intent revoked (Android 14+) | heads-up notification, audio already playing, tap opens the ring activity | `ok_degraded / no_full_screen_intent` |
| Exact alarm not granted (Android 12+) | nothing is armed | `failed / no_exact_alarm_permission` |
| Notifications denied (Android 13+) | service still rings audio; no notification, no Stop action; app must stop via API | `ok_degraded / no_notification_permission` |
| Sound resource missing | system alarm ringtone | `ok` |
| Battery restricted / OEM autostart off | may not fire; reported via `getPermissionStatus().batteryUnrestricted` and `openSettings('autostart')` | unchanged |

### Reboot and time changes

`BootReceiver` handles `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`,
`TIMEZONE_CHANGED`, `TIME_SET`, and
`SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`. It re-arms every slot from
`SlotStore`, rolling past-due slots forward and dropping past-due one-offs.
Re-arming is idempotent because `PendingIntent` identity is the slot key.

### Permissions

Library manifest declares `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`,
`POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_SYSTEM_EXEMPTED`, `WAKE_LOCK`, `VIBRATE`,
`RECEIVE_BOOT_COMPLETED`. Queries: `canScheduleExactAlarms()`,
`canUseFullScreenIntent()`, `NotificationManagerCompat.areNotificationsEnabled()`,
`PowerManager.isIgnoringBatteryOptimizations()`. Settings intents:
`ACTION_REQUEST_SCHEDULE_EXACT_ALARM`,
`ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`,
`ACTION_APP_NOTIFICATION_SETTINGS`,
`ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`, and for `autostart` a
best-effort table of OEM component names (Xiaomi, Oppo, Vivo, Huawei,
Samsung) falling back to app details.

## 7. iOS

### iOS 26 and later — AlarmKit

All AlarmKit code sits behind `#if canImport(AlarmKit)` and
`if #available(iOS 26.0, *)`, so the pod builds against a 15.1 deployment
target and one binary serves every supported version.

- Ids: AlarmKit keys alarms by `UUID`. The string id is mapped by a
  truncated SHA-256 stamped with RFC 4122 version and variant bits, so the
  mapping is derivable inside an App Intent during cold start with no table.
- Schedule: `Alarm.Schedule.relative(time, repeats: .never | .weekly(days))`.
  Relative, not fixed, so timezone and DST changes heal themselves.
- Presentation: alert only, `AlarmPresentation.Alert(title, stopButton)`,
  tint colour configurable at module level. No countdown presentation, which
  would require a widget extension.
- Sound: `.named("<sound>.caf")` if the file is in the main bundle, else
  `.default`. On exactly iOS 26.0, `.default` always, because custom sounds
  are broken on that release.
- Vibration: not controllable through AlarmKit or `UNNotificationRequest`;
  `vibrate` is persisted in the record and echoed by `getScheduled`, nothing
  more.
- Upsert: `cancel(id:)` then `schedule(id:configuration:)`, because a second
  schedule with the same id is refused.
- `getScheduled` reads `AlarmManager.shared.alarms`.
- Authorization: `requestAuthorization()` on the main actor. Already-decided
  states are not re-requested.
- Denied: AlarmKit denied with notifications granted falls back to the
  notification path and reports `ok_degraded / notification_fallback`.
  AlarmKit denied **and** notifications denied is `failed / alarm_kit_denied`:
  nothing is scheduled, nothing is persisted, and a previous alarm with the
  same id is cancelled (upsert).

### Below iOS 26 — notification fallback

`UNNotificationRequest` with a `UNCalendarNotificationTrigger` (repeating per
weekday, or one-off), `interruptionLevel = .timeSensitive`, sound
`UNNotificationSound(named: "<sound>.caf")` if bundled else `.default`, and a
category `WAKE_ALARM` with a `STOP` action. This passes Focus but not the
silent switch. `schedule` returns `ok_degraded / notification_fallback`.
The app should tell the user to keep the ringer on.

The module owns `UNUserNotificationCenter.current().delegate` for that
category through a proxy: `willPresent` returns banner, list and sound so a
foreground alarm is shown; `didReceive` records `stopped` for the `STOP`
action and the default tap; everything else is forwarded to the delegate the
host had installed, which is restored when the module stops. The host's
`WakeAlarmIntentsRegistration.install()` installs the proxy at launch so a
cold-start tap is seen before the module loads.

The time-sensitive entitlement must be enabled by the host, documented and
set by the Expo plugin.

### Stop intent and cold start

`WakeAlarmBridge` is a process-wide singleton. An App Intent, a notification
response, an AlarmKit alerting transition, or JS `stopRinging` records
`{id, action, at}`. Every record is parked for `consumePendingAction()` **and**
forwarded to the module; a live JS listener clears the parked copy. The slot
holds one action, latest write wins.

App Intents declared inside a static-library pod are reported unresolvable by
the AppIntents runtime at run time even though build-time metadata looks
correct. The package therefore ships `WakeAlarmIntents.swift` (a
`LiveActivityIntent` Stop intent that calls the bridge) for the host to add to
its app target, plus a one-line registration in `AppDelegate`. The Expo plugin
injects both. Implementation task: verify whether a framework-style pod
(`use_frameworks!`) resolves the intent; if it does on every supported
CocoaPods integration, remove the host step.

## 8. Expo config plugin

`app.plugin.js` applies:

- iOS: `NSAlarmKitUsageDescription` (configurable string) and the
  time-sensitive entitlement; copies `WakeAlarmIntents.swift` into the target
  and injects the registration into `AppDelegate.swift`; copies sound files
  from a configured folder into the bundle.
- Android: copies the same sound files into `res/raw`.

Injected regions are fenced with revisioned markers so a non-clean
`expo prebuild` re-applies changes rather than skipping an already-patched
file.

## 9. Host integration steps

The `docs/` directory carries one guide per topic. Summary:

| Step | Bare React Native | Expo |
| --- | --- | --- |
| Install | `npm i react-native-wake-alarm && cd ios && pod install` | `npx expo install react-native-wake-alarm`, add to `plugins` |
| Android permissions | merged from the library manifest | automatic |
| iOS Info.plist and entitlement | add `NSAlarmKitUsageDescription`, enable time-sensitive notifications | plugin |
| iOS Stop intent | copy `WakeAlarmIntents.swift`, one line in `AppDelegate` | plugin |
| Sounds | `res/raw/*.mp3` and `*.caf` in the bundle | plugin copies from `sounds/` |
| Ring screen | optional `WakeAlarm.registerRingScreen(...)` at startup | same |
| Cold start | call `consumePendingAction()` once on mount | same |
| Store forms | Play Console full-screen-intent and exact-alarm declarations, App Store nothing | same |

## 10. Performance budgets

- Near-zero cost at app launch. The one action permitted on import is
  `AppRegistry.registerComponent('WakeAlarmRing', …)` — a map insert with a
  lazy provider, required by §6 because the ring activity evaluates only
  module scope. No other initializer, no listener, no storage read on import.
  The TurboModule is resolved on the first API call.
- No runtime dependencies. JS bundle under 10 KB minified.
- Fire to first audible sound under 500 ms with the process dead, cold, on a
  mid-range Android device. Receiver does one prefs read and one
  `startForegroundService`; `MediaPlayer.prepareAsync` starts audio on the
  prepared callback; notification and activity follow audio, not precede it.
- No polling and no JS timers anywhere. `getRinging` is a synchronous read.
- Wake locks: receiver-to-service lock capped at 60 s, released when the
  service is in foreground; playback wake mode for the clip; nothing held
  after stop.
- Storage writes only on schedule, cancel and weekly re-arm.
- The ring activity hosts one React root with the registered component, no
  navigation container, and finishes on stop.
- iOS: all AlarmKit calls async off the main thread except the authorization
  prompt.

## 11. Error handling

- Every native failure surfaces as a typed `ScheduleResult` or a rejected
  promise with a stable `code` string. No swallowed exceptions.
- Native catches `Throwable` at every OS boundary in the fire path, so an OEM
  quirk degrades the ring rather than crashing a foreground service, which
  would count against Play vitals.
- Missing sound, missing permission, missing activity are all degraded
  paths with a defined outcome in the matrices above.

## 12. Testing

- Jest on `src/` with the native module mocked. Threshold 100 percent.
- JUnit on `AlarmMath`: next occurrence, weekly roll-forward, timezone
  recompute, DST. Robolectric JUnit on `AlarmScheduler`: `consumeFire` on
  time, one day late and eight days late; `rearmAll` dropping a past-due
  one-off and rolling a weekly slot forward; `scheduleAll` rollback when a
  later slot is refused (nothing armed, store empty). JVM only.
- XCTest on id-to-UUID derivation and availability gating.
- Example bare React Native app under `example/` exercising every API, with
  a "fire in 30 s" button and a status panel per permission gate.
- `docs/device-testing.md`: checklist for backgrounded, killed, locked,
  silent, DND, reboot, Xiaomi, Oppo, Vivo, Samsung, with the `adb` commands
  to force Doze and read fire-to-sound timestamps from logcat.

## 13. Documentation

`README.md` quick start under thirty lines. `docs/android.md`,
`docs/ios.md`, `docs/expo.md`, `docs/permissions-and-store-policy.md`,
`docs/device-testing.md`, `docs/api.md`, `CHANGELOG.md`, `CONTRIBUTING.md`.

## 14. CI and release

GitHub Actions on push and pull request: lint, `tsc`, Jest, Android library
build with JUnit, iOS library build with XCTest on macOS. A release workflow
on tag `v*` reruns the checks and publishes to npm with provenance using an
`NPM_TOKEN` secret. First release is `1.0.0` with a "tested on" table.

## 15. Repository layout

```
react-native-wake-alarm/
  src/                 TypeScript API, spec, default ring screen
  android/             Kotlin module, service, receivers, activity, manifest
  ios/                 ObjC++ shim, Swift implementation, intents template
  app.plugin.js        Expo config plugin
  example/             bare RN example app
  docs/                integration guides and this design
  .github/workflows/   ci.yml, release.yml
```

## 16. Verification items during implementation

1. Whether App Intents inside the pod resolve at run time under
   `use_frameworks!`. Decides whether the host Swift file step stays.
2. Whether `create-react-native-library`'s current TurboModule template
   accepts a Swift implementation directly or needs the ObjC++ shim written
   by hand.
3. Measured fire-to-sound latency on a physical device with the process
   killed, recorded in the README.
