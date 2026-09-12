import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type NativeAlarmInput = {
  id: string;
  hour: number;
  minute: number;
  days: number[];
  title: string;
  body: string;
  sound: string;
  payloadJson: string;
  maxRingMs: number;
};

export type NativeScheduleResult = {
  status: string;
  backend: string;
  reason: string;
  nextFireAt: number;
  message: string;
};

export type NativeScheduledAlarm = {
  id: string;
  hour: number;
  minute: number;
  days: number[];
  title: string;
  body: string;
  sound: string;
  payloadJson: string;
  maxRingMs: number;
  nextFireAt: number;
  backend: string;
};

export type NativePermissionStatus = {
  notifications: string;
  exactAlarm: string;
  fullScreenIntent: string;
  batteryUnrestricted: string;
  alarmKit: string;
};

export type NativeFiredEvent = { id: string; at: number };
export type NativeStoppedEvent = { id: string; at: number; source: string };
export type NativePermissionChangedEvent = { gate: string; value: string };

export interface Spec extends TurboModule {
  schedule(input: NativeAlarmInput): Promise<NativeScheduleResult>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  getScheduled(): Promise<NativeScheduledAlarm[]>;
  getPermissionStatus(): Promise<NativePermissionStatus>;
  requestPermissions(): Promise<NativePermissionStatus>;
  openSettings(kind: string): Promise<void>;
  getRingingJson(): string | null;
  stopRinging(): Promise<void>;
  consumePendingActionJson(): string | null;
  readonly onFired: CodegenTypes.EventEmitter<NativeFiredEvent>;
  readonly onStopped: CodegenTypes.EventEmitter<NativeStoppedEvent>;
  readonly onPermissionChanged: CodegenTypes.EventEmitter<NativePermissionChangedEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('WakeAlarm');
