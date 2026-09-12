import { describe, expect, it } from '@jest/globals';
import { validateAlarmInput, WakeAlarmInputError } from '../validate';

const base = { id: 'morning', hour: 6, minute: 30, title: 'Yoga' };

describe('validateAlarmInput', () => {
  it('normalises a minimal one-off alarm', () => {
    expect(validateAlarmInput(base)).toEqual({
      id: 'morning',
      hour: 6,
      minute: 30,
      days: [],
      title: 'Yoga',
      body: '',
      sound: '',
      payloadJson: '{}',
      maxRingMs: 600000,
    });
  });

  it('sorts and dedupes days', () => {
    expect(validateAlarmInput({ ...base, days: [5, 1, 5, 3] }).days).toEqual([
      1, 3, 5,
    ]);
  });

  it('serialises payload and keeps maxRingMs', () => {
    const out = validateAlarmInput({
      ...base,
      payload: { b: '2', a: '1' },
      maxRingMs: 1000,
      body: 'b',
      sound: 's',
    });
    expect(out.payloadJson).toBe('{"a":"1","b":"2"}');
    expect(out).toMatchObject({ maxRingMs: 1000, body: 'b', sound: 's' });
  });

  it.each([
    [{ ...base, id: '' }, 'id'],
    [{ ...base, id: 'x'.repeat(65) }, 'id'],
    [{ ...base, id: 'a:b' }, 'id'],
    [{ ...base, hour: 24 }, 'hour'],
    [{ ...base, hour: 1.5 }, 'hour'],
    [{ ...base, minute: -1 }, 'minute'],
    [{ ...base, title: '' }, 'title'],
    [{ ...base, days: [0] as never }, 'days'],
    [{ ...base, days: [8] as never }, 'days'],
    [{ ...base, payload: { a: 1 } as never }, 'payload'],
    [{ ...base, maxRingMs: 999 }, 'maxRingMs'],
    [{ ...base, maxRingMs: 3600001 }, 'maxRingMs'],
  ])('rejects %j on field %s', (input, field) => {
    expect(() => validateAlarmInput(input)).toThrow(WakeAlarmInputError);
    try {
      validateAlarmInput(input);
    } catch (e) {
      expect((e as WakeAlarmInputError).field).toBe(field);
      expect((e as WakeAlarmInputError).code).toBe('invalid_input');
    }
  });
});
