import type { ComponentType } from 'react';
import type { Spec } from './NativeWakeAlarm';
import type {
  AlarmInput,
  RingScreenProps,
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
import { setRegisteredRingScreen } from './ringScreen/current';
import {
  ID_PATTERN,
  validateAlarmInput,
  WakeAlarmInputError,
} from './validate';

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
export const STOP_SOURCES: ReadonlySet<string> = new Set<
  StoppedEvent['source']
>(['user', 'timeout', 'api', 'superseded']);
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

export function createApi(getNative: () => Spec): WakeAlarmApi {
  // Native parks every fired/stopped action for consumePendingAction() and emits it too.
  // Once a live listener has seen an event, the parked copy is a duplicate: clear it once.
  let lastCleared = '';
  const clearParkedDuplicate = (action: string, id: string, at: number) => {
    const key = `${action}:${id}:${at}`;
    if (key === lastCleared) return;
    lastCleared = key;
    getNative().consumePendingActionJson();
  };

  const api = {
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
        return mapScheduleResult(await getNative().schedule(normalised));
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
      await getNative().cancel(id);
    },
    cancelAll: () => getNative().cancelAll(),
    async getScheduled(): Promise<ScheduledAlarm[]> {
      return (await getNative().getScheduled()).map(mapScheduledAlarm);
    },
    async getPermissionStatus(): Promise<PermissionStatus> {
      return mapPermissionStatus(await getNative().getPermissionStatus());
    },
    async requestPermissions(): Promise<PermissionStatus> {
      return mapPermissionStatus(await getNative().requestPermissions());
    },
    async openSettings(kind: SettingsKind): Promise<void> {
      if (!SETTINGS_KINDS.includes(kind))
        throw new WakeAlarmInputError(
          'kind',
          `must be one of ${SETTINGS_KINDS.join(', ')}`
        );
      await getNative().openSettings(kind);
    },
    getRinging: (): RingingAlarm | null =>
      parseJson<RingingAlarm>(getNative().getRingingJson()),
    stopRinging: () => getNative().stopRinging(),
    consumePendingAction: (): PendingAction | null =>
      parseJson<PendingAction>(getNative().consumePendingActionJson()),
    addListener(event: WakeAlarmEvent, cb: (e: never) => void): Subscription {
      switch (event) {
        case 'fired':
          return getNative().onFired((e: NativeFiredEvent) => {
            clearParkedDuplicate('fired', e.id, e.at);
            (cb as (x: FiredEvent) => void)({ id: e.id, at: e.at });
          });
        case 'stopped':
          return getNative().onStopped((e: NativeStoppedEvent) => {
            clearParkedDuplicate('stopped', e.id, e.at);
            (cb as (x: StoppedEvent) => void)({
              id: e.id,
              at: e.at,
              source: (STOP_SOURCES.has(e.source)
                ? e.source
                : 'api') as StoppedEvent['source'],
            });
          });
        case 'permissionChanged':
          return getNative().onPermissionChanged(
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
    registerRingScreen(component: ComponentType<RingScreenProps>) {
      setRegisteredRingScreen(component);
    },
  } as WakeAlarmApi;
  return api;
}
