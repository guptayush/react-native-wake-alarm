# Device testing checklist

Manual verification for `react-native-wake-alarm` using the `example` app. This is not
automated — AlarmKit and exact-alarm scheduling only behave correctly on real hardware
(and AlarmKit only on iOS 26+ real devices), so every case below is a human running the
app and reading the device.

## 1. Build

```bash
yarn example android   # device or emulator API 34+
yarn example ios       # simulator for a build check; AlarmKit needs a real device
```

## 2. Grant gates

Open the app and use the **Permissions** panel at the top. Tap **Request prompts** first,
then **Fix** on any row still red, until every row reads `granted` (or `not_applicable`
where the OS doesn't have that gate).

## 3. Android cases

Each case: schedule with the **Schedule** card ("Fire in 1 min" unless noted), then put
the app in the described state and observe.

Android shows a full-screen intent as a heads-up banner whenever the screen is on and
unlocked; the automatic takeover only happens with the screen off or the keyguard showing.
So the **Locked, screen off** case is the one that verifies the takeover; the foreground
and backgrounded/screen-on cases are expected to show a heads-up.

- **Foreground** — schedule, keep the app open → heads-up banner + audio; tapping the
  banner opens the ring activity. No automatic takeover (screen on and unlocked).
- **Backgrounded, screen on** — press Home → heads-up banner, audio on the alarm stream,
  full-screen after tap. Expected; not a takeover failure.
- **Killed** — swipe the app away from recents, then sleep the display as in the locked
  case → the alarm rings from the native service and the ring screen appears with no tap.
  Proof: `adb shell dumpsys activity services | grep RingService` shows the service
  running; the Δ shown on the ring screen is under 1000 ms.
- **Locked, screen off** — `adb shell input keyevent 26` before the scheduled minute →
  the screen turns on and `WakeAlarmActivity` takes over the lock screen with no tap.
  This is the case that proves the takeover.
- **Silent / DND** —
  ```bash
  adb shell cmd notification set_dnd on
  adb shell media volume --stream 4 --set 7   # stream 4 is ALARM
  ```
  → still rings. Afterwards: `adb shell cmd notification set_dnd off`.
- **Doze** — after scheduling: `adb shell dumpsys deviceidle force-idle` → still fires
  (`setAlarmClock` is exempt from Doze). Afterwards: `adb shell dumpsys deviceidle unforce`.
- **Reboot** — schedule 3 minutes out, `adb reboot`, unlock the device before it fires →
  fires. Note the locked-boot limitation: an alarm scheduled for a time before the device
  is unlocked once after reboot cannot ring (`BootReceiver` only re-arms after unlock).
- **Full-screen intent revoked (Android 14+)** — revoke "Full screen notifications" for
  the app in Settings, then schedule → heads-up only, no full-screen takeover;
  `schedule()` returns `ok_degraded` / `no_full_screen_intent`.
- **Notifications denied (Android 13+)** — deny the notification permission, then
  schedule → audio still rings; `schedule()` returns `ok_degraded` /
  `no_notification_permission`.
- **Exact alarm revoked (Android 12+)** —
  ```bash
  adb shell appops set <pkg> SCHEDULE_EXACT_ALARM deny
  ```
  → `schedule()` returns `failed` / `no_exact_alarm_permission`. Re-grant the permission
  and confirm `BootReceiver` re-arms any previously scheduled alarms.
- **OEM table** — run the killed case on each vendor below; record pass/fail and OS
  version in the README table:

  | OEM             | Device | OS version | Killed case | Notes |
  | --------------- | ------ | ---------- | ------------ | ----- |
  | Xiaomi / Redmi  |        |            |              |       |
  | Oppo / Realme   |        |            |              |       |
  | Vivo            |        |            |              |       |
  | Samsung         |        |            |              |       |

- **Timing** — `adb logcat -s ActivityManager:I | grep RingService` gives the service
  start timestamp; compare it against the scheduled minute to sanity-check the delta
  independently of the ring screen's own Δ line.

## 4. iOS cases

- **iOS 26 device** — authorize AlarmKit in the Permissions panel, schedule 1 minute out,
  lock the phone, flip the silent switch → the system alarm alert fires with a Stop
  button; opening the app afterwards shows a `stopped` pending action in the Events log.
  iOS 26.0 specifically only supports the default alarm sound (`sound: 'chime'` is
  ignored on that point release).
- **iOS < 26 device** — time-sensitive notification banner, no sound while the ringer is
  silenced (expected — this is the notification fallback, not AlarmKit); a Focus mode
  that allows time-sensitive notifications still lets it through.

### Simulator limitation

The iOS 26.x simulator's SpringBoard crashes with
`-[AVAudioSession reporterID]: unrecognized selector` the moment an AlarmKit alert
starts playing. Scheduling, authorization and Live Activity creation can still be
checked in the simulator — only alert playback needs a real device.

## 5. Recording

Screen-record every must-pass case above. The Δ line on the ring screen
(`CustomRingScreen`, or the default ring screen) is the timing evidence — it needs no
separate log capture to prove a case passed.

## 6. Results so far

Emulator runs on 2026-09-12 with the example app; real-device rows are still open.

| Device | OS | Backgrounded | Killed | Locked | Silent/DND | Reboot |
| --- | --- | --- | --- | --- | --- | --- |
| Android emulator (`WakeAlarm_API_26`), example app | API 26 (Android 8.0) | ✓ heads-up, full-screen after tap | ✓ swiped away: heads-up + audio with screen on (ring screen after tap); automatic takeover 73 ms after fire with screen off | ✓ display asleep before the minute: screen woke, `WakeAlarmActivity` took over the lock screen with no tap; `RingService` on the alarm stream, Stop cleaned up, no exception | not yet run | not yet run |
| Android emulator (`Medium_Phone_API_36.1`), example app | API 36 (Android 16) | ✓ Δ 106 ms; heads-up, full-screen after tap, Stop tore it down | not yet run | ✓ with the full-screen gate granted in Settings: screen woke, takeover with no tap, service ran, no exception | not yet run | not yet run |
| iOS Simulator, example app | iOS 26.2 (Xcode 26.2) | simulator crashes on alert playback (Apple bug); needs hardware | not yet run | not yet run | simulator crashes on alert playback (Apple bug); needs hardware | not yet run |

Android shows a full-screen intent as a heads-up banner whenever the screen is on and unlocked; the automatic takeover happens only with the screen off or the keyguard showing, which is why the Locked column is the one that proves it.

On the iOS simulator, the AlarmKit authorization prompt, scheduling, Live Activity creation
and alert posting were all verified; only alert playback crashes the simulator's SpringBoard
(an Apple bug), so sound and Stop still need a real device.


