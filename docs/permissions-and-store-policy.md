# Permissions and store policy

## Gates

Each row is a field on `PermissionStatus`, read with `getPermissionStatus()` or
`requestPermissions()`. A gate's value is `granted` / `denied` / `not_determined` /
`not_applicable` — the last one means the OS version or platform doesn't have that gate
at all.

### `notifications`

- **Controls**: whether the ringing notification (and its Stop action) can be shown at
  all. Audio still plays on Android without it; the app just has no way to stop the
  alarm except the API.
- **Query**: `notifications` field.
- **Fix**: `requestPermissions()` prompts on both platforms (Android 13+, iOS all
  versions); already-decided states are not re-prompted, so a denied user needs
  `openSettings('notifications')`.
- **Default**: on iOS, `not_determined` until first asked. **On Android this gate is
  only ever `granted` or `denied`** — `NotificationManagerCompat.areNotificationsEnabled()`
  has no "not yet asked" state, so before the very first prompt on Android 13+ it reads
  `denied`, same as after a real refusal; below Android 13 it reads `granted` (there is
  no runtime prompt to deny). `not_determined` is an iOS-only value for this gate.

### `exactAlarm` (Android only)

- **Controls**: whether `AlarmManager.setAlarmClock` is allowed at all. Without it,
  `schedule()` resolves `failed / no_exact_alarm_permission` and nothing is armed.
- **Query**: `exactAlarm` field.
- **Fix**: no runtime prompt — `openSettings('exactAlarm')` opens the per-app toggle.
- **Default**: `not_applicable` below Android 12; on 12+, granted by default until the
  user or a Play policy revokes it, but treat it as adversarial and check.

### `fullScreenIntent` (Android only)

- **Controls**: whether the ring notification's full-screen intent is honoured. Denied
  means a heads-up banner instead of taking over the lock screen; audio still plays.
- **Query**: `fullScreenIntent` field.
- **Fix**: no runtime prompt — `openSettings('fullScreenIntent')`.
- **Default**: `not_applicable` below Android 14. On 14+, **revoked by default** for
  apps not classified as alarm or calling apps at install time — expect to ask for this
  explicitly, in context, the first time a user schedules an alarm.

### `batteryUnrestricted` (Android only)

- **Controls**: whether the OS may defer or kill the alarm path under battery
  restrictions. Not required for `AlarmManager.setAlarmClock` itself, but affects
  reliability on OEMs that restrict background work more aggressively than stock
  Android.
- **Query**: `batteryUnrestricted` field.
- **Fix**: no runtime prompt — `openSettings('battery')`.
- **Default**: varies by OEM; never assume granted.

### `autostart` (Android, `SettingsKind` only — not a `PermissionStatus` field)

- **Controls**: whether the OEM allows the app to run in the background at all after a
  reboot or force-stop. No Android API reports this state, so it cannot be a
  `PermissionStatus` gate — only `openSettings('autostart')` exists, opening a
  best-effort vendor screen (Xiaomi, Oppo, Realme, OnePlus, Vivo, Samsung, Huawei, Asus)
  or the app's details screen as a fallback. Recommend showing this once, not on every
  screen.

### `alarmKit` (iOS only)

- **Controls**: whether AlarmKit will accept a schedule. Denied (with AlarmKit
  available) plus denied notifications resolves `failed / alarm_kit_denied`. Scheduled
  as a notification instead of AlarmKit (`ok_degraded / notification_fallback`) covers
  two cases: AlarmKit is unavailable (below iOS 26) or not yet decided, **or** AlarmKit
  is available but the user denied it while notifications are still granted.
- **Query**: `alarmKit` field.
- **Fix**: `requestPermissions()` prompts (iOS 26+ only); otherwise
  `openSettings('alarmKit')` opens the app's Settings page.
- **Default**: `not_applicable` below iOS 26.

## Play Console

File all three of these before releasing, or the store review flags the app:

- **Full-screen intent declaration** (Android 14+ / target SDK 34+). Play's review
  classifies most apps as "not an alarm or calling app" by default, which is exactly why
  `USE_FULL_SCREEN_INTENT` is revoked at install for them — the user has to grant it
  manually in Settings. Declare the permission's use honestly (alarm functionality) so
  the review doesn't reject the build outright.
- **Exact alarm declaration**, for `SCHEDULE_EXACT_ALARM`. Play requires a declared use
  case; "alarm clock" is the accurate one here.
- **Foreground service type declaration** (target SDK 34+). This library's manifest
  adds `RingService` with `foregroundServiceType="systemExempted"`, so Play's
  "Foreground service permissions" form must be completed for the `systemExempted`
  type even if your app declares no other service. Pick the alarm-clock use case
  ("a user-scheduled alarm that must ring at an exact time and take over the screen,
  started from `AlarmManager.setAlarmClock`"), and attach the demo video Play asks for —
  a screen recording of scheduling an alarm and the ring screen taking over the lock
  screen is what reviewers expect. A host that does not know the library added a
  foreground service is rejected on first upload.

Also tell your users, or your product team, that `setAlarmClock` shows the system
alarm icon in the status bar from the moment an alarm is armed until it fires — a
non-alarm app displaying that icon is the first thing a reviewer or a user notices.

`USE_EXACT_ALARM` (the alternative to `SCHEDULE_EXACT_ALARM` that skips the user-facing
toggle) is **not** declared by this package — Play restricts it to apps whose core
function is an alarm or calendar, and granting it to every consumer of this library
would misrepresent apps that merely use alarms as one feature. A host app may add
`USE_EXACT_ALARM` itself in its own manifest if it genuinely qualifies under Play's
policy.

## App Store

AlarmKit needs **no entitlement and no extra review step** beyond the
`NSAlarmKitUsageDescription` Info.plist key and the system authorization prompt — Apple
treats it as a standard local capability, not a restricted one.

This library deliberately does **not** use critical alerts. They require Apple to grant
a dedicated entitlement that most apps will never receive, and the AlarmKit and
time-sensitive-notification paths already cover the intended use case without it.
