import type { ComponentType } from 'react';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface AlarmInput {
  id: string;
  hour: number;
  minute: number;
  days?: Weekday[];
  title: string;
  body?: string;
  sound?: string;
  payload?: Record<string, string>;
  maxRingMs?: number;
}

export type Backend = 'alarm_manager' | 'alarm_kit' | 'notification';

export interface ScheduledAlarm extends AlarmInput {
  nextFireAt: number;
  backend: Backend;
}

export type DegradedReason =
  | 'no_full_screen_intent'
  | 'notification_fallback'
  | 'no_notification_permission';

export type FailureReason =
  | 'no_exact_alarm_permission'
  | 'alarm_kit_denied'
  | 'invalid_input'
  | 'native_error';

export type ScheduleResult =
  | { status: 'ok'; backend: Backend; nextFireAt: number }
  | {
      status: 'ok_degraded';
      backend: Backend;
      nextFireAt: number;
      reason: DegradedReason;
    }
  | { status: 'failed'; reason: FailureReason; message?: string };

export type Gate = 'granted' | 'denied' | 'not_determined' | 'not_applicable';

export interface PermissionStatus {
  notifications: Gate;
  exactAlarm: Gate;
  fullScreenIntent: Gate;
  batteryUnrestricted: Gate;
  alarmKit: Gate;
}

export type SettingsKind =
  | 'notifications'
  | 'exactAlarm'
  | 'fullScreenIntent'
  | 'battery'
  | 'autostart'
  | 'alarmKit';

export interface RingingAlarm {
  id: string;
  title: string;
  body?: string;
  payload?: Record<string, string>;
  firedAt: number;
  scheduledFor: number;
}

export interface PendingAction {
  id: string;
  action: 'stopped' | 'fired';
  at: number;
}

export interface RingScreenProps {
  alarm: RingingAlarm;
  stop: () => Promise<void>;
}

export type WakeAlarmEvent = 'fired' | 'stopped' | 'permissionChanged';

export interface FiredEvent {
  id: string;
  at: number;
}
export interface StoppedEvent {
  id: string;
  at: number;
  source: 'user' | 'timeout' | 'api';
}
export interface PermissionChangedEvent {
  gate: keyof PermissionStatus;
  value: Gate;
}

export interface Subscription {
  remove(): void;
}

export interface WakeAlarmApi {
  schedule(alarm: AlarmInput): Promise<ScheduleResult>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  getScheduled(): Promise<ScheduledAlarm[]>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  openSettings(kind: SettingsKind): Promise<void>;
  getRinging(): RingingAlarm | null;
  stopRinging(): Promise<void>;
  consumePendingAction(): PendingAction | null;
  addListener(event: 'fired', cb: (e: FiredEvent) => void): Subscription;
  addListener(event: 'stopped', cb: (e: StoppedEvent) => void): Subscription;
  addListener(
    event: 'permissionChanged',
    cb: (e: PermissionChangedEvent) => void
  ): Subscription;
  registerRingScreen(component: ComponentType<RingScreenProps>): void;
}
