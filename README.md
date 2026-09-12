# react-native-wake-alarm

Real alarms for React Native. Wakes the phone, takes over the lock screen, and rings through silent mode and Do Not Disturb, with the app backgrounded or killed.

- **Android**: exact `AlarmManager` alarm → foreground service on the alarm audio stream → full-screen takeover. No JavaScript in the audible path.
- **iOS 26+**: AlarmKit system alarm. Breaks through the silent switch and Focus.
- **iOS < 26**: time-sensitive local notification with a Stop action (passes Focus, not the silent switch), reported to you as a degraded result.
- Bare React Native and Expo. One package. New architecture.

## Install

```sh
npm install react-native-wake-alarm
cd ios && pod install
```

Expo: `npx expo install react-native-wake-alarm` and add `"react-native-wake-alarm"` to `plugins` in `app.json`. See [docs/expo.md](docs/expo.md).

iOS also needs a short Swift file copied into your app target and an Info.plist key plus an entitlement. See [docs/ios.md](docs/ios.md).

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

## Tested on

| Device | OS | Backgrounded | Killed | Locked | Silent/DND | Reboot |
| --- | --- | --- | --- | --- | --- | --- |
| Android emulator (`Medium_Phone_API_36.1`), example app | API 36 (Android 16) | ✓ (Δ 106 ms; heads-up banner, tap opened full-screen ring, Stop tore it down; full-screen not auto-granted (heads-up, then full-screen after tap)) | not yet run | not yet run | not yet run | not yet run |
| iOS Simulator, example app | iOS 26.2 (Xcode 26.2) | simulator crashes on alert playback (Apple bug); needs hardware | not yet run | not yet run | simulator crashes on alert playback (Apple bug); needs hardware | not yet run |

On the iOS simulator, the AlarmKit authorization prompt, scheduling, Live Activity creation
and alert posting were all verified; only alert playback crashes the simulator's SpringBoard
(an Apple bug), so sound and Stop still need a real device.

Real-device results are collected with [`docs/device-testing.md`](docs/device-testing.md).

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
