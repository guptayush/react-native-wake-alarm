import type {
  NativePermissionStatus,
  NativeScheduledAlarm,
  NativeScheduleResult,
} from './NativeWakeAlarm';
import type {
  Backend,
  DegradedReason,
  FailureReason,
  Gate,
  PermissionStatus,
  ScheduledAlarm,
  ScheduleResult,
  Weekday,
} from './types';

const BACKENDS: ReadonlySet<string> = new Set<Backend>([
  'alarm_manager',
  'alarm_kit',
  'notification',
]);
const DEGRADED: ReadonlySet<string> = new Set<DegradedReason>([
  'no_full_screen_intent',
  'notification_fallback',
  'no_notification_permission',
]);
const FAILURES: ReadonlySet<string> = new Set<FailureReason>([
  'no_exact_alarm_permission',
  'alarm_kit_denied',
  'invalid_input',
  'native_error',
]);
const GATES: ReadonlySet<string> = new Set<Gate>([
  'granted',
  'denied',
  'not_determined',
  'not_applicable',
]);

const nativeError = (message: string): ScheduleResult => ({
  status: 'failed',
  reason: 'native_error',
  message,
});
const asBackend = (b: string): Backend =>
  BACKENDS.has(b) ? (b as Backend) : 'alarm_manager';

export function mapScheduleResult(n: NativeScheduleResult): ScheduleResult {
  switch (n.status) {
    case 'ok':
      if (!BACKENDS.has(n.backend))
        return nativeError(`unknown backend: ${n.backend}`);
      return {
        status: 'ok',
        backend: n.backend as Backend,
        nextFireAt: n.nextFireAt,
      };
    case 'ok_degraded':
      if (!DEGRADED.has(n.reason))
        return nativeError(`unknown reason: ${n.reason}`);
      if (!BACKENDS.has(n.backend))
        return nativeError(`unknown backend: ${n.backend}`);
      return {
        status: 'ok_degraded',
        backend: n.backend as Backend,
        nextFireAt: n.nextFireAt,
        reason: n.reason as DegradedReason,
      };
    case 'failed':
      if (!FAILURES.has(n.reason))
        return nativeError(`unknown reason: ${n.reason}`);
      return n.message
        ? {
            status: 'failed',
            reason: n.reason as FailureReason,
            message: n.message,
          }
        : { status: 'failed', reason: n.reason as FailureReason };
    default:
      return nativeError(`unknown status: ${n.status}`);
  }
}

function parsePayload(json: string): Record<string, string> | undefined {
  try {
    const v: unknown = JSON.parse(json);
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length > 0
    )
      return v as Record<string, string>;
  } catch {
    /* fall through */
  }
  return undefined;
}

export function mapScheduledAlarm(n: NativeScheduledAlarm): ScheduledAlarm {
  const out: ScheduledAlarm = {
    id: n.id,
    hour: n.hour,
    minute: n.minute,
    days: n.days as Weekday[],
    title: n.title,
    maxRingMs: n.maxRingMs,
    nextFireAt: n.nextFireAt,
    backend: asBackend(n.backend),
  };
  if (n.body) out.body = n.body;
  if (n.sound) out.sound = n.sound;
  const payload = parsePayload(n.payloadJson);
  if (payload) out.payload = payload;
  return out;
}

export const toGate = (s: string): Gate =>
  GATES.has(s) ? (s as Gate) : 'not_applicable';

export function mapPermissionStatus(
  n: NativePermissionStatus
): PermissionStatus {
  return {
    notifications: toGate(n.notifications),
    exactAlarm: toGate(n.exactAlarm),
    fullScreenIntent: toGate(n.fullScreenIntent),
    batteryUnrestricted: toGate(n.batteryUnrestricted),
    alarmKit: toGate(n.alarmKit),
  };
}
