import type { Spec } from './NativeWakeAlarm';
import type {
  AlarmInput,
  ScheduledAlarm,
  ScheduleResult,
  WakeAlarmApi,
} from './types';
import { mapScheduledAlarm, mapScheduleResult } from './mapResult';
import { validateAlarmInput, WakeAlarmInputError } from './validate';

const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

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
  };
  return api as WakeAlarmApi;
}
