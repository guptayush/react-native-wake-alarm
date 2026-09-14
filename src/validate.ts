import type { AlarmInput, Weekday } from './types';
import type { NativeAlarmInput } from './NativeWakeAlarm';

export const DEFAULT_MAX_RING_MS = 600_000;
const MIN_RING_MS = 1_000;
const MAX_RING_MS = 3_600_000;
export const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
// The Android raw-resource rule; iOS accepts more, but a name must be loadable on both platforms.
export const SOUND_PATTERN = /^[a-z][a-z0-9_]*$/;

export class WakeAlarmInputError extends Error {
  readonly code = 'invalid_input' as const;
  constructor(
    readonly field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
    this.name = 'WakeAlarmInputError';
  }
}

const isInt = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

export function validateAlarmInput(input: AlarmInput): NativeAlarmInput {
  if (typeof input.id !== 'string' || !ID_PATTERN.test(input.id)) {
    throw new WakeAlarmInputError('id', 'must match /^[A-Za-z0-9_.-]{1,64}$/');
  }
  if (!isInt(input.hour, 0, 23))
    throw new WakeAlarmInputError('hour', 'must be an integer 0–23');
  if (!isInt(input.minute, 0, 59))
    throw new WakeAlarmInputError('minute', 'must be an integer 0–59');
  if (typeof input.title !== 'string' || input.title.length === 0) {
    throw new WakeAlarmInputError('title', 'must be a non-empty string');
  }
  const days = input.days ?? [];
  if (!Array.isArray(days) || days.some((d) => !isInt(d, 1, 7))) {
    throw new WakeAlarmInputError('days', 'must be ISO weekdays 1–7');
  }
  const payload = input.payload ?? {};
  if (Object.values(payload).some((v) => typeof v !== 'string')) {
    throw new WakeAlarmInputError('payload', 'values must be strings');
  }
  const maxRingMs = input.maxRingMs ?? DEFAULT_MAX_RING_MS;
  if (!isInt(maxRingMs, MIN_RING_MS, MAX_RING_MS)) {
    throw new WakeAlarmInputError(
      'maxRingMs',
      `must be an integer ${MIN_RING_MS}–${MAX_RING_MS}`
    );
  }
  const sound = input.sound ?? '';
  if (
    typeof sound !== 'string' ||
    (sound !== '' && !SOUND_PATTERN.test(sound))
  ) {
    throw new WakeAlarmInputError(
      'sound',
      'must be a bundled resource name matching /^[a-z][a-z0-9_]*$/, no extension'
    );
  }
  const sortedPayload = Object.fromEntries(
    Object.keys(payload)
      .sort()
      .map((k) => [k, payload[k] as string])
  );
  const vibrate = input.vibrate ?? true;
  if (typeof vibrate !== 'boolean') {
    throw new WakeAlarmInputError('vibrate', 'must be a boolean');
  }
  return {
    id: input.id,
    hour: input.hour,
    minute: input.minute,
    days: [...new Set(days as Weekday[])].sort((a, b) => a - b),
    title: input.title,
    body: input.body ?? '',
    sound,
    payloadJson: JSON.stringify(sortedPayload),
    maxRingMs,
    vibrate,
  };
}
