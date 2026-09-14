# Expo

```jsonc
{
  "plugins": [
    [
      "react-native-wake-alarm",
      {
        "alarmKitUsageDescription": "Alarms you set can ring even when the phone is silent or in a Focus mode.",
        "sounds": "./assets/alarm-sounds"
      }
    ]
  ]
}
```

Both props are optional.

- `alarmKitUsageDescription` — the string shown to the user in the AlarmKit
  authorization prompt. Falls back to a default sentence if omitted.
- `sounds` — a folder (relative to the project root) of sound files to bundle. iOS files
  (`.caf`, `.wav`, `.aiff`) are copied into the app target and added to the Xcode
  project; Android files (`.mp3`, `.wav`, `.ogg`) are copied into
  `android/app/src/main/res/raw`. Android resource names must match
  `^[a-z][a-z0-9_]*$` — the build fails with the offending file names listed if one
  doesn't, and a folder that does not exist fails prebuild naming the resolved path.

## What each mod does

- **`NSAlarmKitUsageDescription`** is added to `Info.plist`.
- **The time-sensitive notifications entitlement**
  (`com.apple.developer.usernotifications.time-sensitive`) is added to your
  entitlements file.
- **`WakeAlarmIntents.swift`** is copied from the package into your iOS app target and
  added to the Xcode project, and a call to `WakeAlarmIntentsRegistration.install()` is
  injected into `AppDelegate.swift`'s `application(_:didFinishLaunchingWithOptions:)`.
- **Sound files** from the `sounds` folder are copied into both the iOS app target and
  `res/raw` on Android, as above.

## Requirements

Expo SDK 53 or newer, because the AppDelegate injection only understands a **Swift**
`AppDelegate.swift` (the default since SDK 53). A project still on the Objective-C
template fails prebuild with an explicit error naming this requirement, as does an
`AppDelegate.swift` with no `import` line to anchor the injected import on.

The plugin resolves config-plugins through `expo/config-plugins` first, so it shares the
copy your app already has, and falls back to `@expo/config-plugins` only when `expo` is
not installed.

## Prebuild

```sh
npx expo prebuild --clean
```

A clean prebuild regenerates `ios/` and `android/` from scratch, so every mod above
reapplies in full every time.

A **non-clean** `npx expo prebuild` re-runs the mods against the existing native
projects. The AppDelegate injection is idempotent: the inserted import and the
`WakeAlarmIntentsRegistration.install()` call are wrapped in revisioned marker comments
(`// >>> wake-alarm:intents r1 <part>` … `// <<< wake-alarm:intents <part>`), so a
second run finds its own previous edit, removes it, and reinserts the current version
instead of duplicating it or leaving a stale copy behind.
