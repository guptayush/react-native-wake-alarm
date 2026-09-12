# API reference

Default export `WakeAlarm`, implementing `WakeAlarmApi`.

## Methods

### `schedule(alarm: AlarmInput): Promise<ScheduleResult>`

Upsert by `id`: scheduling an id that already exists replaces it. Validates the input
first (see below); an invalid input resolves `{ status: 'failed', reason: 'invalid_input' }`
rather than throwing. A platform refusal (missing permission, AlarmKit denied, and so
on) is also a resolved `failed` or `ok_degraded` result — `schedule` only rejects for a
genuine programming error it cannot classify.

### `cancel(id: string): Promise<void>`

Cancels one alarm. Throws (a rejected promise) if `id` doesn't match the id pattern
below.

### `cancelAll(): Promise<void>`

Cancels every alarm scheduled by this library.

### `getScheduled(): Promise<ScheduledAlarm[]>`

Reads what the OS itself will actually fire — `AlarmManager`'s stored slots on Android,
`AlarmManager.shared.alarms` / pending notification requests on iOS — never a JavaScript
cache. Native is the source of truth; if a record exists locally but the OS no longer
holds it, it is dropped rather than reported.

### `getPermissionStatus(): Promise<PermissionStatus>`

Reads every gate without prompting.

### `requestPermissions(): Promise<PermissionStatus>`

Prompts for the gates that can be prompted — notifications (both platforms) and
AlarmKit (iOS 26+) — then always resolves the freshly re-read `PermissionStatus`. A
prompt call failing or throwing internally still resolves the re-read status; it is not
a rejection path. Gates with no OS prompt (`exactAlarm`, `fullScreenIntent`, `battery`,
`autostart` on Android) are unaffected by this call — use `openSettings` for those.

### `openSettings(kind: SettingsKind): Promise<void>`

Opens the Settings screen for one gate. Throws if `kind` isn't one of the values below.

### `getRinging(): RingingAlarm | null`

Synchronous read of an in-memory native flag — safe to call during render, no promise
involved.

### `stopRinging(): Promise<void>`

Stops the currently ringing alarm, if any.

### `consumePendingAction(): PendingAction | null`

Reads and clears a queued fired/stopped action that happened while JS wasn't listening
(a cold start, an App Intent, a notification tap). Call once on mount.

### `addListener(event, cb): Subscription`

`event` is `'fired'`, `'stopped'`, or `'permissionChanged'`; the callback's payload type
follows `event` (see Event payloads below). Returns `{ remove(): void }`.

### `registerRingScreen(component: ComponentType<RingScreenProps>): void`

Registers your own ring UI. Call once at startup; a plain default screen is used if you
never call this.

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
  sound?: string; // bundled resource name, no extension
  payload?: Record<string, string>; // string values only
  maxRingMs?: number; // integer 1000–3600000, default 600000 (Android give-up cap)
}
```

Validation (`src/validate.ts`) throws `WakeAlarmInputError` for the first field that
fails; `schedule()` catches it and resolves `invalid_input` instead of letting it
propagate. `days` is de-duplicated and sorted; a non-string `payload` value or an
out-of-range `days` entry is rejected, not coerced.

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
resolved value.

### `PermissionStatus` / `Gate`

```ts
type Gate = 'granted' | 'denied' | 'not_determined' | 'not_applicable';

interface PermissionStatus {
  notifications: Gate;
  exactAlarm: Gate; // Android 12+, not_applicable elsewhere
  fullScreenIntent: Gate; // Android 14+, not_applicable elsewhere
  batteryUnrestricted: Gate; // Android only
  alarmKit: Gate; // iOS 26+, not_applicable elsewhere
}
```

### `SettingsKind`

```ts
type SettingsKind =
  | 'notifications'
  | 'exactAlarm'
  | 'fullScreenIntent'
  | 'battery'
  | 'autostart'
  | 'alarmKit';
```

`exactAlarm`, `fullScreenIntent`, `battery` and `autostart` are Android-only;
`openSettings` on iOS only handles `'notifications'` and `'alarmKit'`.

### Event payloads

```ts
interface FiredEvent { id: string; at: number }
interface StoppedEvent { id: string; at: number; source: 'user' | 'timeout' | 'api' }
interface PermissionChangedEvent { gate: keyof PermissionStatus; value: Gate }
```

`permissionChanged` is not emitted on Android in this version (see
[docs/android.md](android.md)).

### `RingingAlarm` / `PendingAction`

```ts
interface RingingAlarm {
  id: string;
  title: string;
  body?: string;
  payload?: Record<string, string>;
  firedAt: number;
  scheduledFor: number;
}

interface PendingAction { id: string; action: 'stopped' | 'fired'; at: number }
```

### `RingScreenProps`

```ts
interface RingScreenProps {
  alarm: RingingAlarm;
  stop: () => Promise<void>;
}
```

### `ScheduledAlarm`

```ts
interface ScheduledAlarm extends AlarmInput {
  nextFireAt: number; // epoch ms, as the OS reports it
  backend: Backend;
}
```
