import type { Spec } from './NativeWakeAlarm';
import type {
  AlarmInput,
  ScheduledAlarm,
  ScheduleResult,
  WakeAlarmApi,
} from './types';
import type {
  NativeFiredEvent,
  NativePermissionChangedEvent,
  NativeStoppedEvent,
} from './NativeWakeAlarm';
import type {
  FiredEvent,
  PendingAction,
  PermissionChangedEvent,
  PermissionStatus,
  RingingAlarm,
  SettingsKind,
  StoppedEvent,
  Subscription,
  WakeAlarmEvent,
} from './types';
import {
  mapScheduledAlarm,
  mapScheduleResult,
  mapPermissionStatus,
  toGate,
} from './mapResult';
import { validateAlarmInput, WakeAlarmInputError } from './validate';

const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const SETTINGS_KINDS: readonly SettingsKind[] = [
  'notifications',
  'exactAlarm',
  'fullScreenIntent',
  'battery',
  'autostart',
  'alarmKit',
];
const EVENTS: readonly WakeAlarmEvent[] = [
  'fired',
  'stopped',
  'permissionChanged',
];
const STOP_SOURCES = new Set(['user', 'timeout', 'api']);
const GATE_KEYS = new Set<keyof PermissionStatus>([
  'notifications',
  'exactAlarm',
  'fullScreenIntent',
  'batteryUnrestricted',
  'alarmKit',
]);

function parseJson<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    const v: unknown = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

export function createApi(native: Spec): WakeAlarmApi {
  const api: Partial<WakeAlarmApi> = {
    async schedule(alarm: AlarmInput): Promise<ScheduleResult> {
      let normalised;
      try {
        normalised = validateAlarmInput(alarm);
      } catch (e) {
        return {
          status: 'failed',
          reason: 'invalid_input',
          message: errorMessage(e),
        };
      }
      try {
        return mapScheduleResult(await native.schedule(normalised));
      } catch (e) {
        return {
          status: 'failed',
          reason: 'native_error',
          message: errorMessage(e),
        };
      }
    },
    async cancel(id: string): Promise<void> {
      if (!ID_PATTERN.test(id))
        throw new WakeAlarmInputError(
          'id',
          'must match /^[A-Za-z0-9_.-]{1,64}$/'
        );
      await native.cancel(id);
    },
    cancelAll: () => native.cancelAll(),
    async getScheduled(): Promise<ScheduledAlarm[]> {
      return (await native.getScheduled()).map(mapScheduledAlarm);
    },
    async getPermissionStatus(): Promise<PermissionStatus> {
      return mapPermissionStatus(await native.getPermissionStatus());
    },
    async requestPermissions(): Promise<PermissionStatus> {
      return mapPermissionStatus(await native.requestPermissions());
    },
    async openSettings(kind: SettingsKind): Promise<void> {
      if (!SETTINGS_KINDS.includes(kind))
        throw new WakeAlarmInputError(
          'kind',
          `must be one of ${SETTINGS_KINDS.join(', ')}`
        );
      await native.openSettings(kind);
    },
    getRinging: (): RingingAlarm | null =>
      parseJson<RingingAlarm>(native.getRingingJson()),
    stopRinging: () => native.stopRinging(),
    consumePendingAction: (): PendingAction | null =>
      parseJson<PendingAction>(native.consumePendingActionJson()),
    addListener(event: WakeAlarmEvent, cb: (e: never) => void): Subscription {
      switch (event) {
        case 'fired':
          return native.onFired((e: NativeFiredEvent) =>
            (cb as (x: FiredEvent) => void)({ id: e.id, at: e.at })
          );
        case 'stopped':
          return native.onStopped((e: NativeStoppedEvent) =>
            (cb as (x: StoppedEvent) => void)({
              id: e.id,
              at: e.at,
              source: (STOP_SOURCES.has(e.source)
                ? e.source
                : 'api') as StoppedEvent['source'],
            })
          );
        case 'permissionChanged':
          return native.onPermissionChanged(
            (e: NativePermissionChangedEvent) => {
              if (!GATE_KEYS.has(e.gate as keyof PermissionStatus)) return;
              (cb as (x: PermissionChangedEvent) => void)({
                gate: e.gate as PermissionChangedEvent['gate'],
                value: toGate(e.value),
              });
            }
          );
        default:
          throw new WakeAlarmInputError(
            'event',
            `must be one of ${EVENTS.join(', ')}`
          );
      }
    },
  };
  return api as WakeAlarmApi;
}
