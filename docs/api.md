# API reference

Default export `WakeAlarm`, implementing `WakeAlarmApi`. Import it from a module your
entry file reaches (see [Android → The ring screen](android.md#the-ring-screen)): the
import registers the `WakeAlarmRing` component the lock-screen activity starts.

## Methods

### `schedule(alarm: AlarmInput): Promise<ScheduleResult>`

Upsert by `id`: scheduling an id that already exists replaces it. Validates the input
first (see below); an invalid input resolves `{ status: 'failed', reason: 'invalid_input' }`
rather than throwing. A platform refusal (missing permission, AlarmKit denied, and so
on) is also a resolved `failed` or `ok_degraded` result — `schedule` only rejects for a
genuine programming error it cannot classify.

`failed` always means nothing from that call will fire and nothing is listed. On Android,
`days` expands into one alarm slot per weekday, armed one at a time; if any slot is
refused, every slot already armed for this `id` is disarmed and the `id` removed from
the store before resolving `failed`/`native_error`. On iOS, `failed / alarm_kit_denied`
schedules no notification and persists no record.

### `cancel(id: string): Promise<void>`

Cancels one alarm. Throws (a rejected promise) if `id` doesn't match the id pattern below.

### `cancelAll(): Promise<void>`

Cancels every alarm scheduled by this library.

### `getScheduled(): Promise<ScheduledAlarm[]>`

Never a JavaScript cache. iOS lists the library's records still held by
`AlarmManager.shared.alarms` or pending in `UNUserNotificationCenter`, with `nextFireAt`
recomputed at read time. Android has no `AlarmManager` listing API, so it reads the
library's persisted slots — after an exact-alarm revocation the OS has cancelled the
alarms but they stay listed until the grant returns and `BootReceiver` re-arms them.

### `getPermissionStatus(): Promise<PermissionStatus>`

Reads every gate without prompting.

### `requestPermissions(): Promise<PermissionStatus>`

Prompts for the gates that can be prompted — notifications (both platforms) and
AlarmKit (iOS 26+) — then always resolves the freshly re-read `PermissionStatus`. A
prompt call failing or throwing internally still resolves the re-read status; it is not
a rejection path. Gates with no OS prompt (`exactAlarm`, `fullScreenIntent`, `battery`,
`autostart` on Android) are unaffected by this call — use `openSettings` for those.

### `openSettings(kind: SettingsKind): Promise<void>`

Opens the Settings screen for one gate; throws if `kind` isn't a `SettingsKind`.

### `getRinging(): RingingAlarm | null`

Synchronous, in-memory, safe to call during render. Android reads the service's
`RingState`. iOS reads a map of alerting AlarmKit alarms that the module keeps from
`AlarmManager.shared.alarmUpdates` (seeded once when the module loads), then the cached
record for title, body and payload — no AlarmKit query and no store decode per call.
`firedAt` is the observed transition instant; for an alert that began before the module
loaded it is the moment the module first saw it. Below iOS 26 it returns `null`.

### `stopRinging(): Promise<void>`

Stops the currently ringing alarm, if any. Resolves without effect when nothing rings.

### `consumePendingAction(): PendingAction | null`

Reads and clears the parked action. Native parks **every** `fired` and `stopped` in a
single slot and emits it too; a JS listener that receives the live event clears the
parked copy, so what you read here is what nobody was listening for (cold start, an
App Intent, a notification tap). One slot: the latest write wins, so `fired` then
`stopped` with JS absent yields only `stopped`. Call once on mount.

### `addListener(event, cb): Subscription`

`event` is `'fired'`, `'stopped'`, or `'permissionChanged'`; the callback's payload type
follows `event` (see Event payloads below). Returns `{ remove(): void }`.

### `registerRingScreen(component: ComponentType<RingScreenProps>): void`

Registers your own ring UI. Call once at startup; a plain default screen is used if you
never call this. It swaps the inner component only — the `WakeAlarmRing` root is
registered with `AppRegistry` when the package is imported.

## Types

### `AlarmInput`

```ts
interface AlarmInput {
  id: string; // 1–64 chars, /^[A-Za-z0-9_.-]{1,64}$/
  hour: number; // integer 0–23
  minute: number; // integer 0–59
  days?: Weekday[]; // ISO 1 (Monday) – 7 (Sunday); empty or omitted = one-off
  title: string; // non-empty
  body?: string;
  sound?: string; // bundled resource name, no extension, /^[a-z][a-z0-9_]*$/
  payload?: Record<string, string>; // string values only
  maxRingMs?: number; // integer 1000–3600000, default 600000 (Android give-up cap)
  vibrate?: boolean; // default true; Android only — iOS stores and returns it, nothing more
}
```

Validation (`src/validate.ts`) throws `WakeAlarmInputError` for the first field that
fails; `schedule()` catches it and resolves `invalid_input` instead of letting it
propagate. `days` is de-duplicated and sorted; a non-string `payload` value, an
out-of-range `days` entry or a `sound` outside the Android resource rule (uppercase, a
hyphen, an extension) is rejected, not coerced — a bad name fails here, not at fire time.
A non-boolean `vibrate` is rejected the same way. On Android `vibrate: false` rings audio
only; AlarmKit and the iOS notification fallback have no vibration switch, so on iOS the
flag is persisted, echoed by `getScheduled()` and otherwise ignored.

### `ScheduleResult`

```ts
type ScheduleResult =
  | { status: 'ok'; backend: Backend; nextFireAt: number }
  | { status: 'ok_degraded'; backend: Backend; nextFireAt: number; reason: DegradedReason }
  | { status: 'failed'; reason: FailureReason; message?: string };

type Backend = 'alarm_manager' | 'alarm_kit' | 'notification';
type DegradedReason =
  | 'no_full_screen_intent'
  | 'notification_fallback'
  | 'no_notification_permission';
type FailureReason =
  | 'no_exact_alarm_permission'
  | 'alarm_kit_denied'
  | 'invalid_input'
  | 'native_error';
```

`schedule()` never rejects for a platform refusal — every one of the above is a
resolved value. A native result whose `status`, `reason` or `backend` is outside these
unions maps to `failed / native_error` with the offending value in `message`.
`notification_fallback` covers two iOS cases: AlarmKit is unavailable (below iOS 26) or
not yet decided — `schedule()` prompts for it only while the app is active — **or**
AlarmKit is available but the user denied it while notifications are still granted.

### `PermissionStatus` / `Gate`

```ts
type Gate = 'granted' | 'denied' | 'not_determined' | 'not_applicable';

interface PermissionStatus {
  notifications: Gate;
  exactAlarm: Gate; // Android 12+, not_applicable elsewhere
  fullScreenIntent: Gate; // Android 14+, not_applicable elsewhere
  batteryUnrestricted: Gate; // Android only
  backgroundPopup: Gate; // not_determined on Xiaomi/Vivo/Oppo/Realme (unreadable vendor switches), not_applicable elsewhere
  alarmKit: Gate; // iOS 26+, not_applicable elsewhere
}
```

### `SettingsKind`

```ts
type SettingsKind =
  | 'notifications' | 'exactAlarm' | 'fullScreenIntent' | 'battery'
  | 'autostart' | 'backgroundPopup' | 'alarmKit';
```

`exactAlarm`, `fullScreenIntent`, `battery`, `autostart` and `backgroundPopup` are Android-only;
`openSettings` on iOS only handles `'notifications'` and `'alarmKit'`.

### Event payloads

```ts
interface FiredEvent { id: string; at: number }
interface StoppedEvent { id: string; at: number; source: 'user' | 'timeout' | 'api' | 'superseded' }
interface PermissionChangedEvent { gate: keyof PermissionStatus; value: Gate }
```

`source` is `user` for the Stop button, notification action or system alert; `timeout`
for the Android `maxRingMs` cap; `api` for `stopRinging()`; `superseded` when another
alarm fired while this one was ringing (Android). An unknown native source is reported
as `api`. `permissionChanged` fires on Android for `gate: 'exactAlarm'` only, from the
system's `SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` broadcast after the library has
re-armed its slots; it is informational and never parked for `consumePendingAction()`.
iOS emits nothing yet — poll `getPermissionStatus()` for every other gate.

### `RingingAlarm` / `PendingAction` / `RingScreenProps` / `ScheduledAlarm`

```ts
interface RingingAlarm {
  id: string; title: string; body?: string; payload?: Record<string, string>;
  firedAt: number; scheduledFor: number;
}
interface PendingAction { id: string; action: 'stopped' | 'fired'; at: number }
interface RingScreenProps { alarm: RingingAlarm; stop: () => Promise<void> }
interface ScheduledAlarm extends AlarmInput {
  nextFireAt: number; // epoch ms, as the OS reports it
  backend: Backend;
}
```
