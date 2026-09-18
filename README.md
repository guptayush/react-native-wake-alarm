# react-native-wake-alarm

Real alarms for React Native. Wakes the phone, takes over the lock screen, and rings through
silent mode and Do Not Disturb, with the app backgrounded or killed.

A notification library schedules a notification and hopes the device shows it. This schedules an
alarm: `AlarmManager.setAlarmClock` and a foreground service on Android, AlarmKit on iOS 26, and a
time-sensitive notification on older iOS, all behind one typed API that tells you exactly what the
platform did.

## What you get

- **Rings on time**, in Doze, from a killed app, through silent mode and Do Not Disturb.
- **Lock-screen takeover** on Android with a ring screen you can replace with your own React component.
- **Typed results**, never silent failures: every call resolves `ok`, `ok_degraded` or `failed` with a reason.
- **Permission gates for the real world**: exact alarms, full-screen intent, battery, and the Xiaomi, Vivo, Oppo and Realme switches that stock Android cannot see.
- **Survives reboot**, app update, and time or time-zone changes.
- **Cold-start handoff**: what fired or stopped while JavaScript was not running is waiting for you on launch.
- **Weekly repeats** in device local time, custom bundled sounds, vibration on the alarm channel.
- **Bare React Native and Expo**, one package, a TurboModule with an Expo config plugin, a Jest mock included.

## Requirements

| | Minimum |
| --- | --- |
| React Native | 0.80, new architecture |
| Android | API 26 (Android 8.0) |
| iOS | 15.1 to build; 26 for AlarmKit, older versions get the notification fallback |
| Expo | SDK 53 or newer, development build (not Expo Go) |

## Install

**Bare React Native**

```sh
npm install react-native-wake-alarm
cd ios && pod install
```

Then copy one Swift file into your iOS app target and add an Info.plist key and an
entitlement, as described in [docs/ios.md](docs/ios.md). Android needs nothing else.

**Expo**

```sh
npx expo install react-native-wake-alarm
```

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-wake-alarm",
        { "alarmKitUsageDescription": "Alarms you set can ring even when the phone is silent." }
      ]
    ]
  }
}
```

Then `npx expo prebuild`. The plugin adds the permissions, the Swift file, the plist key and the
entitlement, and can bundle a folder of sounds. Options in [docs/expo.md](docs/expo.md).

**Both**: import the package from a module your entry file reaches (`index.js` or `App.tsx`), not
lazily inside a screen. The import registers the lock-screen ring component, and that is all it
does at launch.

## Quick start

```ts
import WakeAlarm from 'react-native-wake-alarm';

await WakeAlarm.requestPermissions();

const result = await WakeAlarm.schedule({
  id: 'morning',
  hour: 6, minute: 30,
  days: [1, 2, 3, 4, 5],          // ISO weekdays; omit for a one-off
  title: 'Morning session',
  body: 'Starts in 15 minutes',
  sound: 'chime',                 // bundled sound name, optional
});

switch (result.status) {
  case 'ok':                                       // armed; result.nextFireAt is the next fire time
    break;
  case 'ok_degraded':                              // armed, but weaker: e.g. 'no_full_screen_intent' rings as a banner
    console.warn('alarm degraded:', result.reason);
    break;
  case 'failed':                                   // nothing armed: e.g. 'no_exact_alarm_permission'
    if (result.reason === 'no_exact_alarm_permission') await WakeAlarm.openSettings('exactAlarm');
    break;
}
```

### Every method

```ts
// Permissions — read, prompt, or send the user to the right Settings screen
const status = await WakeAlarm.getPermissionStatus();  // every gate, never prompts
const after = await WakeAlarm.requestPermissions();    // prompts notifications (+ AlarmKit on iOS 26), returns the re-read gates
if (after.exactAlarm === 'denied') await WakeAlarm.openSettings('exactAlarm');
if (after.fullScreenIntent === 'denied') await WakeAlarm.openSettings('fullScreenIntent');
if (after.backgroundPopup === 'not_determined') await WakeAlarm.openSettings('backgroundPopup'); // once, Xiaomi/Vivo/Oppo/Realme
// other kinds: 'notifications' | 'battery' | 'autostart' | 'alarmKit'

// Scheduling
const result = await WakeAlarm.schedule({ id: 'nap', hour: 14, minute: 0, title: 'Nap over' }); // ok | ok_degraded | failed
const alarms = await WakeAlarm.getScheduled();         // [{ ...input, nextFireAt, backend }]
await WakeAlarm.cancel('nap');
await WakeAlarm.cancelAll();

// While an alarm rings
const ringing = WakeAlarm.getRinging();                // sync; { id, title, body, payload, firedAt, scheduledFor } | null
await WakeAlarm.stopRinging();                         // stops audio and vibration, closes the ring screen

// On launch — what happened while JavaScript was not running, handed over once
const pending = WakeAlarm.consumePendingAction();      // { id, action: 'fired' | 'stopped', at } | null

// Events — each returns { remove() }; remove on unmount
const fired = WakeAlarm.addListener('fired', ({ id, at }) => {});
const stopped = WakeAlarm.addListener('stopped', ({ id, at, source }) => {}); // source: user | timeout | api | superseded
const gates = WakeAlarm.addListener('permissionChanged', ({ gate, value }) => {}); // Android, gate 'exactAlarm'
fired.remove(); stopped.remove(); gates.remove();

// Ring screen (Android) — your component receives { alarm, stop }
WakeAlarm.registerRingScreen(MyRingScreen);            // once, at startup
```

### Listening from a component

Subscribe once, high in the tree, from a component that lives as long as you need the events,
and remove on unmount. Two live `fired` listeners both run.

```ts
useEffect(() => {
  const fired = WakeAlarm.addListener('fired', ({ id }) => openAlarmScreen(id));
  const stopped = WakeAlarm.addListener('stopped', ({ id }) => closeAlarmScreen(id));
  return () => { fired.remove(); stopped.remove(); };
}, []);
```

Events only reach a live JavaScript runtime; `consumePendingAction()` covers the cold start.

### Your own ring screen (Android)

```tsx
import WakeAlarm, { type RingScreenProps } from 'react-native-wake-alarm';

function RingScreen({ alarm, stop }: RingScreenProps) {
  return <MyFullScreenAlarm title={alarm.title} onStop={stop} />;
}
WakeAlarm.registerRingScreen(RingScreen); // once, at startup
```

On iOS the ringing surface is Apple's; use the events and the pending action to open your own
screen inside the app when the user taps the alert.

## Platform support

| Capability | Android | iOS 26+ | iOS < 26 |
| --- | :---: | :---: | :---: |
| Rings from a killed app, in Doze | ✅ | ✅ | ✅ |
| Through silent mode | ✅ | ✅ | ❌ (Focus yes, silent switch no) |
| Lock-screen takeover | ✅ screen off or locked | ✅ system alert | banner |
| Custom ring screen | ✅ React component | ❌ system UI | ❌ system UI |
| Weekly repeats | ✅ | ✅ | ✅ |
| Custom sound | ✅ `res/raw` | ✅ bundle | ✅ bundle |
| Vibration | ✅ | system | system |
| Stop from the alert | ✅ | ✅ | ✅ action |
| Survives reboot | ✅ after first unlock | ✅ | ✅ |
| Snooze | not yet | not yet | not yet |

Android shows a full-screen intent as a heads-up banner while the screen is on and unlocked; the
automatic takeover happens with the screen off or locked. That is platform behaviour on every
Android version, not a permission state.

## What the user has to grant

| Gate | Android | iOS |
| --- | --- | --- |
| Notifications | prompt (13+) | prompt |
| Exact alarms | Settings toggle (12+), `openSettings('exactAlarm')` | n/a |
| Full-screen alerts | Settings toggle (14+); revoked at install by Play for non-alarm apps, kept by sideloaded builds | n/a |
| Background pop-ups / lock screen (Xiaomi, Vivo, Oppo, Realme) | vendor switch, `openSettings('backgroundPopup')` | n/a |
| Battery unrestricted / autostart | Settings, OEM dependent | n/a |
| AlarmKit | n/a | prompt (26+) |

Ask in context the first time the user sets an alarm, one gate per dialog, in the order the
[permissions guide](docs/permissions-and-store-policy.md#recommended-prompt-order) lists. It also
covers the Play Console declarations you must file.

## API

### `schedule(alarm)` — `AlarmInput`

| Prop | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `string` | yes | — | Stable, app-chosen. `/^[A-Za-z0-9_.-]{1,64}$/`. Scheduling an existing id replaces it. |
| `hour` | `number` | yes | — | 0–23, device local time. |
| `minute` | `number` | yes | — | 0–59. |
| `days` | `Weekday[]` | no | one-off | ISO weekdays, `1` = Monday … `7` = Sunday. Omitted or empty fires once. |
| `title` | `string` | yes | — | Shown on the ring screen and the iOS alert. |
| `body` | `string` | no | — | Second line on the notification and ring screen. |
| `sound` | `string` | no | system alarm tone | Bundled resource name without extension, `/^[a-z][a-z0-9_]*$/`: Android `res/raw/<name>.mp3\|wav`, iOS `<name>.caf\|wav\|aiff` in the app bundle. Anything else is `failed / invalid_input`. |
| `payload` | `Record<string, string>` | no | `{}` | String values only; returned on the ringing alarm and in events. |
| `maxRingMs` | `number` | no | `600000` | Android give-up cap, 1000–3600000 ms. |
| `vibrate` | `boolean` | no | `true` | Android: vibrate on the alarm usage while ringing. iOS: stored and echoed, no control over the system alert. |

Resolves to a `ScheduleResult`: `ok`, `ok_degraded` with `reason` `no_full_screen_intent` \|
`notification_fallback` \| `no_notification_permission`, or `failed` with `reason`
`no_exact_alarm_permission` \| `alarm_kit_denied` \| `invalid_input` \| `native_error`.

### Events — `addListener(event, cb)`

| Event | Payload |
| --- | --- |
| `fired` | `{ id, at }` |
| `stopped` | `{ id, at, source: 'user' \| 'timeout' \| 'api' \| 'superseded' }` |
| `permissionChanged` | `{ gate, value }` — Android, `gate: 'exactAlarm'` when the grant changes |

### Everything else

`cancel(id)`, `cancelAll()`, `getScheduled()`, `getPermissionStatus()`, `requestPermissions()`,
`openSettings(kind)`, `getRinging()`, `stopRinging()`, `consumePendingAction()`,
`registerRingScreen(Component)`. Signatures, every result value and `RingScreenProps` are in
[docs/api.md](docs/api.md).

## Testing your app

The TurboModule resolves on the first call, which throws under Jest. Use the bundled mock: every
method is a `jest.fn()` with a sensible resolved value.

```js
jest.mock('react-native-wake-alarm', () => require('react-native-wake-alarm/jest'));
```

## Known limitations

- **Locked boot**: an alarm due between power-on and the first unlock cannot ring; re-arming runs after the unlock.
- **OEM switches cannot be read**: on Xiaomi, Vivo, Oppo and Realme the `backgroundPopup` gate says the switches exist, not whether they are on.
- **iOS below 26** passes Focus but not the silent switch, and there is no ringing surface to customise.
- **iOS 26 Simulator** crashes on AlarmKit alert playback (an Apple bug); test AlarmKit on a device.
- **No snooze yet**; it is the next feature.

## Docs

[Android](docs/android.md) · [iOS](docs/ios.md) · [Expo](docs/expo.md) ·
[Permissions & store policy](docs/permissions-and-store-policy.md) · [API](docs/api.md) ·
[Device testing](docs/device-testing.md) · [Design](docs/design.md) · [Changelog](CHANGELOG.md)

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
