# react-native-wake-alarm

Real alarms for React Native. Wakes the phone, takes over the lock screen, and rings through silent mode and Do Not Disturb, with the app backgrounded or killed.

- **Android**: exact `AlarmManager` alarm → foreground service on the alarm audio stream → full-screen takeover. No JavaScript in the audible path.
- **iOS 26+**: AlarmKit system alarm. Breaks through the silent switch and Focus.
- **iOS < 26**: time-sensitive local notification with a Stop action (passes Focus, not the silent switch), reported to you as a degraded result.
- Bare React Native and Expo. One package. New architecture, React Native 0.80 or later.

## Install

```sh
npm install react-native-wake-alarm
cd ios && pod install
```

Expo: `npx expo install react-native-wake-alarm` and add `"react-native-wake-alarm"` to `plugins` in `app.json`. See [docs/expo.md](docs/expo.md).

iOS also needs a short Swift file copied into your app target and an Info.plist key plus an entitlement. See [docs/ios.md](docs/ios.md).

Import the package from a module your entry file reaches (`index.js` or `App.tsx`), not lazily inside a screen: the import registers the lock-screen ring component, and that is all it does at launch. See [docs/android.md](docs/android.md#the-ring-screen).

## Use

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

if (result.status === 'failed') showFix(result.reason);
if (result.status === 'ok_degraded') explain(result.reason);

WakeAlarm.addListener('fired', ({ id }) => {});
WakeAlarm.addListener('stopped', ({ id, source }) => {});
```

Every platform refusal is a typed result, never a silent failure. [docs/api.md](docs/api.md) lists every method, result and reason.

## What the user has to grant

| Gate | Android | iOS |
| --- | --- | --- |
| Notifications | prompt (13+) | prompt |
| Exact alarms | Settings toggle (12+), `openSettings('exactAlarm')` | n/a |
| Full-screen alerts | Settings toggle (14+); revoked at install for non-alarm apps | n/a |
| Battery unrestricted / autostart | Settings, OEM dependent | n/a |
| AlarmKit | n/a | prompt (26+) |

[docs/permissions-and-store-policy.md](docs/permissions-and-store-policy.md) explains each gate and the Play Console declarations you must file.

## Props

### `schedule(alarm)` — `AlarmInput`

| Prop | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `string` | yes | — | Stable, app-chosen. `/^[A-Za-z0-9_.-]{1,64}$/`. Scheduling an existing id replaces it. |
| `hour` | `number` | yes | — | 0–23, device local time. |
| `minute` | `number` | yes | — | 0–59. |
| `days` | `Weekday[]` | no | one-off | ISO weekdays, `1` = Monday … `7` = Sunday. Omitted or empty fires once. |
| `title` | `string` | yes | — | Shown on the ring screen and the iOS alert. |
| `body` | `string` | no | — | Second line on the notification and ring screen. |
| `sound` | `string` | no | system alarm tone | Bundled resource name without extension: Android `res/raw/<name>.mp3\|wav`, iOS `<name>.caf\|wav\|aiff` in the app bundle. |
| `payload` | `Record<string, string>` | no | `{}` | String values only; returned on the ringing alarm and in events. |
| `maxRingMs` | `number` | no | `600000` | Android give-up cap, 1000–3600000 ms. |

Resolves to a `ScheduleResult`, never rejects for a platform refusal: `ok`, `ok_degraded` with `reason` `no_full_screen_intent` \| `notification_fallback` \| `no_notification_permission`, or `failed` with `reason` `no_exact_alarm_permission` \| `alarm_kit_denied` \| `invalid_input` \| `native_error`.

### `registerRingScreen(Component)` — `RingScreenProps` (Android)

| Prop | Type | Notes |
| --- | --- | --- |
| `alarm.id` / `alarm.title` / `alarm.body` / `alarm.payload` | as scheduled | The ringing alarm. |
| `alarm.firedAt` / `alarm.scheduledFor` | `number` | Epoch ms; their difference is the delivery delay. |
| `stop` | `() => Promise<void>` | Stops audio and vibration, closes the ring screen. |

The default screen shows the time, title, body and a Stop button. On iOS the alert is Apple's system UI, with no slot for custom content.

### Events — `addListener(event, cb)`

| Event | Payload |
| --- | --- |
| `fired` | `{ id, at }` |
| `stopped` | `{ id, at, source: 'user' \| 'timeout' \| 'api' \| 'superseded' }` |
| `permissionChanged` | reserved; not emitted in this version |

Other methods: `cancel(id)`, `cancelAll()`, `getScheduled()`, `getPermissionStatus()`, `requestPermissions()`, `openSettings(kind)`, `getRinging()` (synchronous), `stopRinging()`, `consumePendingAction()`. Full signatures and every result value: [docs/api.md](docs/api.md).

Verified behaviour per platform and case is recorded in [docs/device-testing.md](docs/device-testing.md#6-results-so-far).

## Docs

[Android](docs/android.md) · [iOS](docs/ios.md) · [Expo](docs/expo.md) · [Permissions & store policy](docs/permissions-and-store-policy.md) · [API](docs/api.md) · [Device testing](docs/device-testing.md) · [Design](docs/design.md)

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
